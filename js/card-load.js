// ===== 剧情抽卡（Story Cards）加载卡牌：从磁盘选卡牌文件夹 / 文件，解析后并入卡库 =====
// 浏览器不能随便读磁盘，所以只能由玩家主动选：
//   1. showDirectoryPicker()（Chromium 内核支持，一次选整个卡牌文件夹，保留层级）；
//   2. <input type="file" webkitdirectory>（老一点的实现，同样保留层级）；
//   3. <input type="file" multiple>（最后兜底：选一批 .md，卡组/分类/回目从卡面里读）。
//
// 解析规则与构建期完全一致（共用 tools/card-parse.js，构建时已编进 index.js）。
// 层级推断：<卡组>/<分类>/<回目>/<卡号>-<卡名>.md；层级不足时用卡面里的
// 「**分类**：」与「# 标题」里的回目兜底，再不行就归到「未分组」。

// 从相对路径里推层级。parts 形如 ['红楼梦','现实类','第一回','C1-03-半盏灯.md']。
function scDeckFromPath(parts) {
  const dirs = parts.slice(0, Math.max(0, parts.length - 1));
  return {
    deck: dirs.length >= 1 && dirs[0] ? dirs[0] : '',
    category: dirs.length >= 2 && dirs[1] ? dirs[1] : '',
    chapter: dirs.length >= 3 && dirs[2] ? dirs[2] : '',
  };
}

// 层级不足时的兜底：卡组用「未分组」，分类优先取卡面里的「**分类**：」，
// 回目从「# C1-03 半盏灯」的卡号前缀里猜不出来（那是回次不是回目），一律归「未分回」。
function scFillMissingScope(card, parsed, fromPath) {
  const deck = fromPath.deck || '未分组';
  const category = fromPath.category || parsed.category || '未分类';
  const chapter = fromPath.chapter || '未分回';
  return Object.assign({}, card, { deck, category, chapter });
}

// 解析一个文件的内容成卡库条目。
function scParseCardContent(text, stem, relativePath) {
  const parts = String(relativePath || stem).split('/').filter(Boolean);
  const fromPath = scDeckFromPath(parts);
  const parser = globalThis.SC_CARD_PARSE;
  let parsed;
  if (parser && typeof parser.parseCard === 'function') {
    parsed = parser.parseCard(text, stem);
  } else {
    // 解析器缺失时的极简兜底：至少让标题能用。
    parsed = { id: stem, number: '', name: stem, type: '', category: '', face: text, notes: '', noteItems: [] };
  }
  return scFillMissingScope({
    id: parsed.id || stem,
    number: parsed.number || '',
    name: parsed.name || stem,
    type: parsed.type || '',
    category: parsed.category || '',
    rel: parts.join('/'),
    face: parsed.face || '',
    notes: parsed.notes || '',
    noteItems: parsed.noteItems || [],
  }, parsed, fromPath);
}

// 从一个 File 读出文本（宿主 / 浏览器差异都兜住）。
function scReadFileText(file) {
  if (file && typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

// 挑出可用的卡牌文件：只认 .md，跳过隐藏文件、超大文件与超出数量上限的部分。
function scFilterCardFiles(fileList) {
  const all = Array.from(fileList || []);
  const md = all.filter((file) => file && /\.md$/i.test(String(file.name || '')));
  const skippedCount = all.length - md.length;
  const usable = [];
  let skippedBig = 0;
  for (const file of md) {
    if (usable.length >= SC_CARD_FILE_MAX_COUNT) break;
    if (Number(file.size) > SC_CARD_FILE_MAX_BYTES) {
      skippedBig += 1;
      continue;
    }
    usable.push(file);
  }
  return {
    usable,
    skippedCount,
    skippedBig,
    truncated: Math.max(0, md.length - skippedBig - usable.length),
  };
}

// 读 + 解析一批文件，返回 { cards, failed, skipped }。
async function scParseCardFiles(files) {
  const cards = [];
  const failed = [];
  for (const file of files) {
    const relativePath = String(file.webkitRelativePath || file.relativePath || file.name || '');
    const stem = String(file.name || '').replace(/\.md$/i, '');
    try {
      const text = await scReadFileText(file);
      const card = scParseCardContent(text, stem, relativePath);
      if (card && card.id) cards.push(card);
      else failed.push(file.name);
    } catch (error) {
      failed.push(file.name);
    }
  }
  return { cards, failed };
}

// 解析完统一入库 + 刷新界面。
function scApplyLoadedCards(cards, meta) {
  const result = scAddCustomCards(cards);
  const parts = [`加载 ${cards.length} 张（新增 ${result.added}，覆盖 ${result.replaced}）`];
  if (meta && meta.skippedCount) parts.push(`跳过非 .md ${meta.skippedCount} 个`);
  if (meta && meta.skippedBig) parts.push(`跳过超大文件 ${meta.skippedBig} 个`);
  if (meta && meta.truncated) parts.push(`超出上限未处理 ${meta.truncated} 个`);
  if (meta && meta.failed) parts.push(`读取失败 ${meta.failed} 个`);
  if (result.truncated) parts.push(`卡库超上限，丢弃最早 ${result.truncated} 张`);
  const summary = parts.join('；');
  // 先重画范围树（新卡组要出现在树里），再写状态行——反过来会被概况覆盖掉。
  scRenderScopeTree();
  scSetCardStatus(summary, cards.length > 0 ? 'ok' : 'error');
  scToast(cards.length > 0 ? 'success' : 'warning', summary);
  return result;
}

// 清空玩家加载的卡牌。
function scHandleClearCustomCards() {
  const count = scClearCustomCards();
  scRenderScopeTree();
  scSetCardStatus(count > 0 ? `已移除加载的 ${count} 张` : '没有加载过卡牌', count > 0 ? 'ok' : 'muted');
  scToast('info', count > 0 ? `已移除加载的 ${count} 张卡牌` : '没有加载过卡牌');
}

// 第 1 招：目录选择器（一次选整个文件夹，保留层级）。
async function scPickViaDirectoryPicker() {
  const picker = globalThis.showDirectoryPicker;
  if (typeof picker !== 'function') return false;
  let handle;
  try {
    handle = await picker.call(globalThis, { mode: 'read' });
  } catch (error) {
    if (error && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
      scSetCardStatus('已取消', 'muted');
      return true;
    }
    // 不是用户取消，说明这条路走不通，交给下一个方案。
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 目录选择器不可用，改用文件选择`, error);
    return false;
  }
  scSetCardStatus('正在读取文件夹…', 'muted');
  const files = [];
  const walk = async (dir) => {
    for await (const entry of dir.values()) {
      if (files.length >= SC_CARD_FILE_MAX_COUNT) return;
      if (entry.kind === 'file') {
        if (/\.md$/i.test(entry.name)) {
          const file = await entry.getFile();
          // 补一个 webkitRelativePath，让层级推断和 input 方案走同一条路。
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: dir.name + '/' + entry.name, configurable: true,
            });
          } catch (error) { /* 定义不上也不影响：兜底用文件名 */ }
          files.push(file);
        }
      } else if (entry.kind === 'directory') {
        await walk(entry);
      }
    }
  };
  try {
    await walk(handle);
  } catch (error) {
    console.error(`[${SC_MODULE_DISPLAY_NAME}] 遍历文件夹失败`, error);
    scSetCardStatus('读取文件夹失败：' + String(error?.message || error), 'error');
    return true;
  }
  return scHandlePickedFiles(files, true);
}

// 第 2 / 3 招：隐藏的 <input type="file">，先试目录、不行再试多选文件。
function scEnsureFileInput(useDirectory) {
  let input = scEl(SC_FILE_INPUT_ID);
  if (!input) {
    input = scCreate('input', 'sc-file-input');
    input.type = 'file';
    input.id = SC_FILE_INPUT_ID;
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = input.files;
      input.value = '';
      if (!files || files.length === 0) return;
      scHandlePickedFiles(Array.from(files), false);
    });
    document.body.appendChild(input);
  }
  if (useDirectory) {
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  } else {
    input.removeAttribute('webkitdirectory');
    input.removeAttribute('directory');
  }
  return input;
}

// 统一入口：点「加载卡牌」走这里。
async function scHandleLoadCards() {
  try {
    const handled = await scPickViaDirectoryPicker();
    if (handled) return;
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 目录选择失败`, error);
  }
  // 回退：优先目录选择，宿主不支持 webkitdirectory 时退化成多选文件。
  const input = scEnsureFileInput(true);
  const supportsDirectory = 'webkitdirectory' in input || 'directory' in input;
  if (!supportsDirectory) scEnsureFileInput(false);
  scSetCardStatus(supportsDirectory ? '请选择卡牌文件夹…' : '请选择卡牌 .md 文件…', 'muted');
  input.click();
}

// 收到文件后：过滤 → 读取 → 解析 → 入库。
async function scHandlePickedFiles(fileList, fromDirectoryPicker) {
  const filtered = scFilterCardFiles(fileList);
  if (filtered.usable.length === 0) {
    scSetCardStatus('没找到 .md 卡牌文件', 'error');
    scToast('warning', '没找到 .md 卡牌文件');
    return;
  }
  scSetCardStatus(`正在解析 ${filtered.usable.length} 个文件…`, 'muted');
  const { cards, failed } = await scParseCardFiles(filtered.usable);
  scApplyLoadedCards(cards, {
    skippedCount: filtered.skippedCount,
    skippedBig: filtered.skippedBig,
    truncated: filtered.truncated,
    failed: failed.length,
  });
}
