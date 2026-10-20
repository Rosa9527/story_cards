// ===== 剧情抽卡（Story Cards）构建脚本 =====
// 职责：
//   1. 扫描 cards/<分类>/<卡组>/<主题>/<卡号>-<卡名>.md，解析成卡库数据；
//   2. 生成 js/cards-data.js（卡库数据源，勿手改）；
//   3. 把 js/ 下的源码按依赖顺序拼接成宿主加载的单文件 index.js。
//
// 为什么需要它：TauriTavern 的 manifest 只接受单个 JS 文件（"js" 必须是字符串或
// 单元素数组），不支持多文件数组。所以源码拆在 js/ 下便于维护，发布时拼回一个
// index.js 交给宿主加载。卡牌也走同一条路：运行时读不到扩展目录里的 .md，
// 必须在构建期把卡面正文编进数据表。
//
// 用法：
//   node build.js          一次性构建（含卡库重新扫描）
//   node build.js --cards  只重新生成 js/cards-data.js，不拼 index.js
//   node build.js --check  校验磁盘上的 index.js 与当前源码是否一致（提交前跑）
//   node build.js --watch  监听 js/ 与 cards/ 的变化，自动重建（Ctrl+C 退出）
//   node build.js --stdout 不写盘，把两个产物打到 stdout（供 build.ps1 落地）
//
// 为什么有 --stdout：某些运行环境（带文件沙箱的宿主、被安全软件托管的进程）
// 会拦住 node 自己的写盘（EPERM），而 shell 写盘正常。此时由 build.ps1 调
// --stdout 拿内容、再由 shell 落盘，构建照样可用。
//
// 依赖：仅 Node 内置模块，无第三方依赖。
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { parseCard } = require('./tools/card-parse.js');

const root = __dirname;
const cardsRoot = path.join(root, 'cards');
const cardsDataPath = path.join(root, 'js', 'cards-data.js');
const outPath = path.join(root, 'index.js');

// --stdout 模式下，卡库内容在这里生成后直接参与拼接（不依赖磁盘上的产物）。
let inMemoryCardsText = '';

// 拼接顺序必须与依赖关系一致：常量 → 工具 → 宿主 → 卡库数据 →
// 卡库逻辑 → 导入导出 → 注入 → 发送 → UI → 入口。每个文件都是普通脚本
// （非 ES module），顶层 const/function 进入全局作用域，顺序保证「被调用时已定义」即可。
const FILES = [
  'js/constants.js',
  'js/utils.js',
  'js/host.js',
  'js/cards-data.js',
  'js/cards.js',
  'js/card-io.js',
  'js/inject.js',
  'js/send.js',
  'js/ui-shell.js',
  'js/main.js',
];

// ---------- 卡库扫描 ----------

// 递归收集 cards/ 下的 .md 文件，返回相对 cards/ 的路径片段数组。
function walkCards(dir, prefix, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const parts = prefix.concat(entry.name);
    if (entry.isDirectory()) {
      walkCards(full, parts, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push({ full, parts });
    }
  }
  return out;
}

// 主题排序：名字里带中文数字的（如「第一回」）按数值排，其余退回原串比较。
// 现在的主题名一般不带数字，这段主要是给从旧结构导入的卡兜底。
const CN_DIGITS = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function chineseNumberToInt(text) {
  const raw = String(text || '').replace(/[^〇零一二三四五六七八九十百]/g, '');
  if (!raw) return null;
  if (raw === '十') return 10;
  let total = 0;
  let section = 0;
  let seen = false;
  for (const ch of raw) {
    if (ch === '百') { total += (section || 1) * 100; section = 0; seen = true; continue; }
    if (ch === '十') { section = (section || 1) * 10; seen = true; continue; }
    const digit = CN_DIGITS[ch];
    if (digit === undefined) continue;
    section = section * 10 + digit;
    seen = true;
  }
  return seen ? total + section : null;
}

// 卡号排序：C1-03 / F16-01 里的「分类字母 + 回次 + 序号」。
function cardSortKey(card) {
  const match = String(card.number || card.id || '').match(/^([A-Za-z]*)(\d+)(?:-(\d+))?/);
  if (!match) return [1, 0, 0, String(card.id || '')];
  return [0, Number(match[2]) || 0, Number(match[3]) || 0, String(card.id || '')];
}

function buildCardsData() {
  const found = walkCards(cardsRoot, [], []);
  const cards = [];
  const skipped = [];
  for (const item of found) {
    const parts = item.parts;
    // 目录层级不足（分类/卡组/主题/文件）时跳过，避免把随手放的说明文件当卡。
    if (parts.length < 4) {
      skipped.push(parts.join('/'));
      continue;
    }
    const fileName = parts[parts.length - 1];
    // 目录结构：cards/<分类>/<卡组>/<主题>/<卡号>-<卡名>.md
    const category = parts[0];
    const deck = parts[1];
    const chapter = parts[2];
    const stem = fileName.replace(/\.md$/i, '');
    let text = '';
    try {
      text = fs.readFileSync(item.full, 'utf8');
    } catch (error) {
      skipped.push(parts.join('/') + '（读取失败）');
      continue;
    }
    const parsed = parseCard(text, stem);
    cards.push({
      id: parsed.id,
      number: parsed.number,
      name: parsed.name,
      type: parsed.type,
      deck,
      category,
      chapter,
      rel: parts.join('/'),
      face: parsed.face,
      notes: parsed.notes,
      noteItems: parsed.noteItems,
    });
  }
  cards.sort((a, b) => {
    if (a.deck !== b.deck) return a.deck < b.deck ? -1 : 1;
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    const ca = chineseNumberToInt(a.chapter);
    const cb = chineseNumberToInt(b.chapter);
    if (ca !== null && cb !== null && ca !== cb) return ca - cb;
    if (a.chapter !== b.chapter) return a.chapter < b.chapter ? -1 : 1;
    const ka = cardSortKey(a);
    const kb = cardSortKey(b);
    for (let i = 0; i < 3; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return ka[3] < kb[3] ? -1 : (ka[3] > kb[3] ? 1 : 0);
  });
  return { cards, skipped };
}

function renderCardsData(cards) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const header = [
    '// ===== 剧情抽卡（Story Cards）卡库数据 · 构建产物，勿手改 =====',
    `// 生成时间: ${stamp} · 卡牌数: ${cards.length}`,
    '// 来源: cards/<分类>/<卡组>/<主题>/<卡号>-<卡名>.md',
    '// 重新生成: node build.js（或 node build.js --cards）',
    '// 卡面解析规则见 tools/card-parse.js（构建期使用）。',
  ].join('\n');
  const json = JSON.stringify(cards, null, 2);
  return `${header}\n(function () {\n  const cards = ${json};\n  for (const card of cards) Object.freeze(card);\n  globalThis.STORY_CARDS_LIBRARY = Object.freeze(cards);\n})();\n`;
}

function writeCardsData() {
  const { cards, skipped } = buildCardsData();
  fs.mkdirSync(path.dirname(cardsDataPath), { recursive: true });
  fs.writeFileSync(cardsDataPath, renderCardsData(cards), 'utf8');
  const decks = new Set(cards.map((card) => card.deck));
  console.log(`[build] 卡库已生成：${cards.length} 张，卡组 ${decks.size} 个 → js/cards-data.js`);
  if (skipped.length) {
    console.warn(`[build] 跳过 ${skipped.length} 个不符合 卡组/分类/回目/文件 层级的文件：`);
    for (const item of skipped.slice(0, 10)) console.warn('        ' + item);
  }
  return cards.length;
}

// ---------- 源码拼接 ----------

// FNV-1a 32 位指纹：拼接内容有任何变化，指纹即变。
function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildParts() {
  const parts = FILES.map((file) => {
    // 卡库数据是构建期生成的，磁盘上可能还没有（首次构建、或被沙箱挡住写盘的
    // 环境）；--stdout 模式下直接在内存里生成同一份内容，避免依赖磁盘产物。
    if (file === 'js/cards-data.js' && inMemoryCardsText) {
      return `// ===== ${file} =====\n${inMemoryCardsText}`;
    }
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      console.error(`[build] 缺少文件: ${file}`);
      process.exit(1);
    }
    const content = fs.readFileSync(full, 'utf8');
    return `// ===== ${file} =====\n${content}`;
  });
  // 防呆：js/ 下新增文件忘记加入 FILES 时报警（只警告不中断，可能是临时脚本）。
  // cards-data.js 是构建产物，不算「忘记加入」。
  const listed = new Set(FILES.map((file) => path.basename(file)));
  for (const name of fs.readdirSync(path.join(root, 'js'))) {
    if (name.endsWith('.js') && !listed.has(name) && name !== 'cards-data.js') {
      console.error(`[build] 警告: js/${name} 未加入 FILES，不会被拼进 index.js！`);
    }
  }
  return parts;
}

// 正文与头部拆开：正文是「一致性判断」的对象，头部只带构建时间等元数据。
// 这样 --check 能只看正文逐字节比对，不会因为两次构建时间不同而误报。
function buildBody() {
  return buildParts().join('\n\n') + '\n';
}

function buildHeader(body) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return [
    '// ===== 剧情抽卡（Story Cards）index.js — 构建产物，勿手改 =====',
    `// 构建时间: ${stamp} · 文件数: ${FILES.length} · 指纹: ${fingerprint(body)}`,
  ].join('\n');
}

function assemble(body) {
  return `${buildHeader(body)}\n\n${body}`;
}

function buildOnce() {
  writeCardsData();
  const output = assemble(buildBody());
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`[build] 已生成 index.js（${FILES.length} 个文件，${output.split('\n').length} 行）`);
  return output;
}

// --stdout：把两个产物打到 stdout，交给 shell 落盘。
// 某些运行环境（带文件沙箱的宿主、被安全软件托管的进程）会拦住 node 自己的写盘
// （EPERM），而 shell 写盘正常；此时由 build.ps1 调本模式拿内容、再由 shell 落盘。
// 标记行必须独占一行，内容里不会出现，切分才可靠。
const STDOUT_MARK_CARDS = '<<<STORY_CARDS_FILE:js/cards-data.js>>>';
const STDOUT_MARK_INDEX = '<<<STORY_CARDS_FILE:index.js>>>';
const STDOUT_MARK_END = '<<<STORY_CARDS_END>>>';

function emitToStdout() {
  const { cards, skipped } = buildCardsData();
  const cardsText = renderCardsData(cards);
  // 先把卡库放进内存，再拼正文（buildParts 会用它替代磁盘上的 cards-data.js）。
  inMemoryCardsText = cardsText;
  const indexText = assemble(buildBody());
  // 末尾统一带一个换行：调用方按标记切分后不用再猜结尾。
  process.stdout.write([
    STDOUT_MARK_CARDS, cardsText,
    STDOUT_MARK_INDEX, indexText,
    STDOUT_MARK_END, '',
  ].join('\n'));
  if (skipped.length) console.error(`[build] 跳过 ${skipped.length} 个不符合 卡组/分类/回目/文件 层级的文件`);
  console.error(`[build] --stdout 已输出：卡库 ${cards.length} 张 + index.js（${indexText.split('\n').length} 行）`);
}

// 提交前校验：磁盘上的 index.js 正文必须与当前源码逐字节一致（容忍 CRLF 差异）。
// 头部（构建时间戳 + 指纹）是元数据，不参与一致性判断；正文与头部之间以空行分隔。
function checkOnce() {
  let onDisk;
  try {
    onDisk = fs.readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    console.error('[build] --check 失败：index.js 不存在，请先运行 node build.js');
    process.exit(1);
  }
  const norm = (text) => text.replace(/\r/g, '');
  const diskBody = (() => {
    const sep = onDisk.indexOf('\n\n');
    return sep === -1 ? onDisk : onDisk.slice(sep + 2);
  })();
  if (norm(diskBody) === norm(buildBody())) {
    console.log('[build] --check 通过：index.js 与当前源码一致');
    return;
  }
  console.error('[build] --check 失败：index.js 与当前源码不一致！');
  console.error('[build] 请运行 node build.js 重建后重新提交。');
  process.exit(1);
}

const watchMode = process.argv.includes('--watch');
const checkMode = process.argv.includes('--check');
const cardsOnly = process.argv.includes('--cards');
const stdoutMode = process.argv.includes('--stdout');

if (checkMode) {
  checkOnce();
} else if (stdoutMode) {
  emitToStdout();
} else if (cardsOnly) {
  writeCardsData();
} else if (watchMode) {
  // 启动先构建一次，保证产物始终是最新的（不会因为上次忘记构建而落后）。
  try {
    buildOnce();
  } catch (error) {
    console.error('[build] 首次构建失败', error);
  }
  const rebuild = () => {
    try {
      buildOnce();
    } catch (error) {
      console.error('[build] 重建失败', error);
    }
  };
  let timer = null;
  const debounce = (fn) => {
    clearTimeout(timer);
    timer = setTimeout(fn, 200);
  };
  // js/ 源码变更 → 重建；cards/ 卡牌变更 → 也重建（卡库要重新扫描）。
  fs.watch(path.join(root, 'js'), { persistent: true }, () => debounce(rebuild));
  try {
    fs.watch(cardsRoot, { persistent: true, recursive: true }, () => debounce(rebuild));
  } catch (error) {
    console.warn('[build] cards/ 递归监听不可用，卡牌改动需手动重建：', error.message);
  }
  console.log('[build] watch 模式：监听 js/ 与 cards/，Ctrl+C 退出');
} else {
  buildOnce();
}
