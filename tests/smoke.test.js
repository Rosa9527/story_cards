// ===== 剧情抽卡（Story Cards）冒烟测试 =====
// 在 Node 里用最小 DOM / 宿主上下文替身跑一遍 index.js，验证：
//   1. 卡库构建结果（结构完整、字段解析正确；张数从卡库动态推，不写死）；
//   2. 范围树与勾选（勾主题 / 勾分类 / 勾卡组、三态统计、未勾=全库）；
//   3. 抽卡与「抽过不重复」（含抽完回退重抽）；
//   4. 注入文本形态（<Story_Card_Draw> 块、卡面与注意事项都在、无正文泄漏）；
//   5. 发送链路（填输入框 → 点发送按钮 → chat 变长 → 落账）。
//
// 用法：node tests/smoke.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

let failures = 0;
let checks = 0;
// 触发短语：源码里是顶层 const（脚本作用域，不挂在 globalThis 上），
// 测试里按同样的值传参即可，顺便锁住这个对外契约。
const TRIGGER_TEXT = '【剧情抽卡】';
function check(name, condition, detail) {
  checks += 1;
  if (condition) {
    console.log('  ok   ' + name);
  } else {
    failures += 1;
    console.log('  FAIL ' + name + (detail ? '  → ' + detail : ''));
  }
}
function section(title) {
  console.log('\n== ' + title + ' ==');
}

// 点一下自绘勾选框：走元素上的测试桥（等价于真实浏览器里的 click → onToggle），
// 并且把 click 冒泡到祖先，用来验证「点勾选框不会连带展开/收起」。
function clickCheckbox(box) {
  if (typeof box.__scToggle === 'function') box.__scToggle();
  box.dispatch('click', { type: 'click', target: box, stopPropagation() {}, preventDefault() {} });
  let node = box.parentNode;
  while (node) {
    node.dispatch('click', { type: 'click', target: box, stopPropagation() {}, preventDefault() {} });
    node = node.parentNode;
  }
}

// 找出范围树里所有勾选框按钮（自绘，不再是 input）。
function findToggles(rootEl) {
  const out = [];
  rootEl.walk((node) => {
    if (node.classList.contains('sc-tree__checkbox')) out.push(node);
  });
  return out;
}

// ---------- 最小 DOM ----------
class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...names) { for (const n of names) this.set.add(n); }
  remove(...names) { for (const n of names) this.set.delete(n); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const want = force === undefined ? !this.set.has(name) : Boolean(force);
    if (want) this.set.add(name); else this.set.delete(name);
    return want;
  }
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new FakeClassList();
    this.style = { setProperty() {}, display: '' };
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this._text = '';
    this._html = '';
    this.value = '';
    this.checked = false;
    this.indeterminate = false;
    this.disabled = false;
    this.offsetParent = {};
    this.id = '';
    this.title = '';
    this.type = '';
    this.tabIndex = 0;
  }
  get className() { return Array.from(this.classList.set).join(' '); }
  set className(value) {
    this.classList.set = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join('');
    return this._text;
  }
  set textContent(value) {
    this._text = String(value == null ? '' : value);
    this.children = [];
  }
  get innerHTML() { return this._html; }
  set innerHTML(value) { this._html = String(value == null ? '' : value); }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  prepend(child) {
    child.parentNode = this;
    this.children.unshift(child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    const list = this.parentNode.children;
    const index = list.indexOf(this);
    if (index >= 0) list.splice(index, 1);
    this.parentNode = null;
  }
  removeChild(child) {
    child.remove();
    return child;
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }
  dispatch(type, event) {
    const list = this.listeners.get(type) || [];
    for (const handler of list) handler(event || { type, stopPropagation() {}, preventDefault() {} });
  }
  // 浏览器 API：代码里用的是 dispatchEvent(new Event(...))。
  dispatchEvent(event) {
    const type = event && event.type ? event.type : String(event || '');
    this.dispatch(type, event);
    return true;
  }
  click() {
    this.dispatch('click', { type: 'click', stopPropagation() {}, preventDefault() {} });
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; }
  // 真实浏览器语义：event.target.closest(selector) 会沿祖先链找匹配元素。
  // 只支持逗号分隔的简单标签名选择器（插件里用的就是这一种）。
  closest(selector) {
    const tags = String(selector || '').split(',').map((part) => part.trim().toUpperCase()).filter(Boolean);
    let node = this;
    while (node) {
      if (tags.includes(node.tagName)) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getClientRects() { return [{}]; }
  // 悬浮按钮拖动靠它取当前位置；按 style.left/top 还原成视口坐标。
  getBoundingClientRect() {
    const parse = (value) => {
      const n = parseFloat(String(value || ''));
      return Number.isFinite(n) ? n : 0;
    };
    const left = parse(this.style.left);
    const top = parse(this.style.top);
    // 与 SC_FLOAT_SIZE（constants.js）保持一致。
    return { left, top, right: left + 38, bottom: top + 38, width: 38, height: 38, x: left, y: top };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
  // 深度遍历（含自身），用于按 id 找节点。
  walk(visit) {
    visit(this);
    for (const child of this.children) child.walk(visit);
  }
  find(predicate) {
    let found = null;
    this.walk((node) => { if (!found && predicate(node)) found = node; });
    return found;
  }
}

function createFakeDocument() {
  const byId = new Map();
  const body = new FakeElement('body');
  const document = {
    body,
    getElementById(id) { return byId.get(id) || null; },
    createElement(tag) { return new FakeElement(tag); },
    addEventListener() {},
    createEvent() { return { initKeyboardEvent() {} }; },
    _register(element) { if (element.id) byId.set(element.id, element); },
    _reset() { byId.clear(); body.children = []; },
  };
  // 任何 appendChild 都自动登记 id，模拟浏览器的 id 索引。
  const originalAppend = FakeElement.prototype.appendChild;
  FakeElement.prototype.appendChild = function (child) {
    const result = originalAppend.call(this, child);
    if (child.id) byId.set(child.id, child);
    return result;
  };
  const originalRemove = FakeElement.prototype.remove;
  FakeElement.prototype.remove = function () {
    if (this.id) byId.delete(this.id);
    return originalRemove.call(this);
  };
  return document;
}

// ---------- 最小宿主上下文 ----------
function createHost() {
  const chat = [];
  const listeners = new Map();
  const extensionPrompts = {};
  const context = {
    chat,
    chatMetadata: {},
    extension_settings: {},
    extensionPrompts,
    event_types: {
      APP_READY: 'app_ready',
      CHAT_CHANGED: 'chat_changed',
      GENERATION_STARTED: 'generation_started',
      GENERATION_ENDED: 'generation_ended',
      GENERATION_STOPPED: 'generation_stopped',
      MESSAGE_SENT: 'message_sent',
    },
    eventSource: {
      on(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      },
      removeListener(type, handler) {
        const list = listeners.get(type) || [];
        const index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
      },
      emit(type, ...args) {
        for (const handler of (listeners.get(type) || []).slice()) handler(...args);
      },
    },
    setExtensionPrompt(key, value, position, depth, scan, role) {
      extensionPrompts[key] = { value, position, depth, scan, role };
    },
    getCurrentChatId() { return 'test-chat'; },
    saveSettingsDebounced() { context._settingsSaves = (context._settingsSaves || 0) + 1; },
    saveMetadata() { context._metadataSaves = (context._metadataSaves || 0) + 1; },
    isGenerating() { return Boolean(context._generating); },
    _emit(type, ...args) { context.eventSource.emit(type, ...args); },
    _listeners: listeners,
  };
  return context;
}

// ---------- 装配运行环境 ----------
// options.tauriContext：模拟 TauriTavern 的 getContext()——只有驼峰 extensionSettings，
// 且每次调用都返回一个新的外壳对象（底层设置 / chat 仍是共享引用）。
function boot(options = {}) {
  const document = createFakeDocument();
  const host = createHost();
  let getContext = () => host;
  if (options.tauriContext) {
    delete host.extension_settings;
    host.extensionSettings = {};
    const shared = host;
    getContext = () => Object.assign({}, shared);
  }

  // 宿主界面元素：扩展菜单 + 输入框 + 发送按钮。
  const menu = new FakeElement('div');
  menu.id = 'extensionsMenu';
  document.body.appendChild(menu);

  const textarea = new FakeElement('textarea');
  textarea.id = 'send_textarea';
  document.body.appendChild(textarea);

  const sendButton = new FakeElement('div');
  sendButton.id = 'send_but';
  // 点发送 = 宿主把输入框内容提交成一条用户消息（模拟宿主行为）。
  sendButton.addEventListener('click', () => {
    const text = String(textarea.value || '').trim();
    if (!text) return;
    host.chat.push({ is_user: true, name: '玩家', mes: text, id: host.chat.length });
    textarea.value = '';
    host._emit(host.event_types.MESSAGE_SENT, text);
  });
  document.body.appendChild(sendButton);
  document._register(menu);
  document._register(textarea);
  document._register(sendButton);

  // 导出的下载链路：Blob + createObjectURL + <a download>。
  const downloads = [];
  const sandbox = {
    console,
    document,
    window: null,
    // 视口尺寸：悬浮按钮的位置夹取要用（默认 1280x800）。
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    RegExp,
    Map,
    Set,
    WeakMap,
    Blob: class Blob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = (options && options.type) || '';
        this.text = String((parts || []).join(''));
      }
    },
    URL: {
      createObjectURL(blob) { downloads.push(blob); return 'blob:mock/' + downloads.length; },
      revokeObjectURL() {},
    },
    Event: class Event { constructor(type, options) { this.type = type; this.bubbles = Boolean(options && options.bubbles); } },
    KeyboardEvent: class KeyboardEvent {
      constructor(type, options) { this.type = type; Object.assign(this, options || {}); }
    },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
    toastr: null,
    SillyTavern: { getContext },
    navigator: { userAgent: 'node' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(indexSource, sandbox, { filename: 'index.js' });
  return { sandbox, document, host, menu, textarea, sendButton, downloads };
}

// ---------- 1. 卡库 ----------
section('卡库构建结果');
const env = boot();
const library = env.sandbox.STORY_CARDS_LIBRARY;
// 卡库是持续在写的，张数会变；测试只锁「结构」，不锁具体数字。
const TOTAL = library.length;
const FANTASY_TOTAL = library.filter((card) => card.category === '奇幻类').length;
const REALITY_TOTAL = library.filter((card) => card.category === '现实类').length;
const LEAF_COUNT = new Set(library.map((card) => [card.category, card.deck, card.chapter].join('\u0001'))).size;
check('卡库存在且为数组', Array.isArray(library));
check('卡库非空', TOTAL > 0, String(TOTAL));
const sample = library.find((card) => card.id === 'C1-03-半盏灯') || library[0];
check('能按 id 找到样例卡 C1-03-半盏灯', Boolean(library.find((card) => card.id === 'C1-03-半盏灯')));
if (sample) {
  check('卡名解析正确', Boolean(sample.name) && sample.name === String(sample.name), sample.name);
  check('卡号解析正确', /^[A-Za-z]*\d+(-\d+)?$/.test(String(sample.number || sample.id)),
    sample.number || sample.id);
  check('卡组/分类/主题解析正确（三段都非空）',
    Boolean(sample.deck && sample.category && sample.chapter),
    [sample.deck, sample.category, sample.chapter].join('/'));
  check('卡面非空且含正文', String(sample.face || '').trim().length > 0,
    String(sample.face || '').slice(0, 40));
  check('注意事项非空', String(sample.notes || '').includes('合理化'));
  check('注意事项条目已结构化', Array.isArray(sample.noteItems) && sample.noteItems.length >= 1,
    sample.noteItems && String(sample.noteItems.length));
  check('设计底稿不进入卡面', !sample.face.includes('设计底稿') && !sample.notes.includes('设计底稿'));
}
const allHaveFace = library.every((card) => String(card.face || '').trim().length > 0);
const allHaveNotes = library.every((card) => String(card.notes || '').trim().length > 0);
check('每张卡都有卡面', allHaveFace);
check('每张卡都有注意事项', allHaveNotes);
const ids = new Set(library.map((card) => card.id));
check('卡 id 无重复', ids.size === library.length);
const draftCards = library.filter((card) => card.face.includes('设计底稿'));
check('没有卡把设计底稿混进卡面', draftCards.length === 0, draftCards.map((c) => c.id).join(','));

// ---------- 2. 范围树与勾选 ----------
section('范围树与勾选');
// 范围树必须与 cards/<分类>/<卡组>/<主题>/ 目录一一对应：顶层分类、第二层卡组、第三层主题。
const tree = env.sandbox.scBuildScopeTree();
const categoryNames = tree.map((c) => c.name).sort();
check('顶层是两个分类：奇幻类 / 现实类', categoryNames.join(',') === '奇幻类,现实类', categoryNames.join(','));
const fantasy = tree.find((c) => c.name === '奇幻类');
const reality = tree.find((c) => c.name === '现实类');
check('分类张数与卡库一致',
  fantasy && reality && fantasy.total === FANTASY_TOTAL && reality.total === REALITY_TOTAL,
  (fantasy && fantasy.total) + '/' + (reality && reality.total)
    + ' 期望 ' + FANTASY_TOTAL + '/' + REALITY_TOTAL);
check('每个分类下都是卡组「红楼梦」',
  tree.every((c) => c.decks.length === 1 && c.decks[0].name === '红楼梦'),
  tree.map((c) => c.decks.map((d) => d.name).join('+')).join(' | '));
const fantasyDeck = fantasy.decks[0];
const realityDeck = reality.decks[0];
check('卡组张数之和 = 全库张数',
  fantasyDeck.total + realityDeck.total === TOTAL,
  fantasyDeck.total + '/' + realityDeck.total + ' 期望 ' + TOTAL);
// 主题叶子 = (分类, 卡组, 主题) 组合数，直接从卡库推。
const leafCount = fantasyDeck.chapters.length + realityDeck.chapters.length;
check('主题叶子数与卡库一致', leafCount === LEAF_COUNT, leafCount + ' 期望 ' + LEAF_COUNT);

// 挑一个只含 1 张卡的主题做「勾一个叶子」的精确断言；找不到就跳过这组。
const singleCardTopic = (() => {
  for (const category of tree) {
    for (const deck of category.decks) {
      const hit = deck.chapters.find((chapter) => chapter.total === 1);
      if (hit) return { category: category.name, deck: deck.name, chapter: hit.name, card: hit.cards[0] };
    }
  }
  return null;
})();
check('卡库里存在单张卡的主题（供精确断言）', Boolean(singleCardTopic),
  singleCardTopic && [singleCardTopic.category, singleCardTopic.deck, singleCardTopic.chapter].join('/'));

const settings = env.sandbox.scGetSettings();
let stats = env.sandbox.scSummarizeSelection(settings);
check('初始未勾选时 selectedLeaves = 0', stats.selectedLeaves === 0);
let pool = env.sandbox.scFilterBySelection(settings);
check('未勾选时抽卡范围 = 全库（unrestricted）', pool.unrestricted === true && pool.cards.length === TOTAL,
  String(pool.cards.length));

// 勾一个主题（参数顺序 = 分类 / 卡组 / 主题）
env.sandbox.scSetLeafSelected(settings, singleCardTopic.category, singleCardTopic.deck, singleCardTopic.chapter, true);
stats = env.sandbox.scSummarizeSelection(settings);
check('勾一个主题后 selectedLeaves = 1', stats.selectedLeaves === 1, String(stats.selectedLeaves));
check('勾一个主题后覆盖 1 张', stats.selectedCards === 1, String(stats.selectedCards));
pool = env.sandbox.scFilterBySelection(settings);
check('抽卡范围收敛到 1 张', pool.unrestricted === false && pool.cards.length === 1, String(pool.cards.length));
check('这一张就是该主题下的卡', pool.cards[0].id === singleCardTopic.card.id, pool.cards[0].id);

// 勾整个卡组（分类下的红楼梦）
const fantasyChapters = fantasyDeck.chapters.map((c) => c.name);
env.sandbox.scSetSubtreeSelected(settings, '奇幻类', '红楼梦', fantasyChapters, true);
stats = env.sandbox.scSummarizeSelection(settings);
check('勾整个奇幻类/红楼梦后覆盖奇幻类张数', stats.selectedCards === FANTASY_TOTAL, String(stats.selectedCards));

// 勾整个分类（把两个卡组的主题都勾上）
for (const deck of fantasy.decks) {
  env.sandbox.scSetSubtreeSelected(settings, '奇幻类', deck.name, deck.chapters.map((c) => c.name), true);
}
stats = env.sandbox.scSummarizeSelection(settings);
check('勾整个奇幻类分类后覆盖奇幻类张数', stats.selectedCards === FANTASY_TOTAL, String(stats.selectedCards));

// 勾全部（两个分类）
for (const category of tree) {
  for (const deck of category.decks) {
    env.sandbox.scSetSubtreeSelected(settings, category.name, deck.name, deck.chapters.map((c) => c.name), true);
  }
}
stats = env.sandbox.scSummarizeSelection(settings);
check('勾全部分类后覆盖全库张数 / 全部主题',
  stats.selectedCards === TOTAL && stats.selectedLeaves === LEAF_COUNT,
  stats.selectedCards + '/' + stats.selectedLeaves + ' 期望 ' + TOTAL + '/' + LEAF_COUNT);

// 全部取消 → 回到全库
for (const category of tree) {
  for (const deck of category.decks) {
    env.sandbox.scSetSubtreeSelected(settings, category.name, deck.name, deck.chapters.map((c) => c.name), false);
  }
}
stats = env.sandbox.scSummarizeSelection(settings);
check('全部取消后回到 0 勾选', stats.selectedLeaves === 0, String(stats.selectedLeaves));

// 换卡库 / 目录改版后残留的旧勾选必须被清掉，否则「勾了却抽不到」。
// 模拟旧结构（卡组在顶层 + 回目名）留在设置里、新卡库里已经没有这些键。
settings.selectedLeaves = {
  红楼梦: { 奇幻类: { 第一回: true, 丧葬礼仪: true }, 现实类: { 第三回: true } },
  奇幻类: { 红楼梦: { 丧葬礼仪: true, 第一回: true } },
};
const pruned = env.sandbox.scPruneStaleSelection(settings);
// 4 个失效键：旧顶层块「红楼梦」下 3 个叶子键（奇幻类 2 + 现实类 1）+ 新块里 1 个旧主题「第一回」。
check('清理掉失效勾选（旧顶层块 3 个叶子键 + 1 个旧主题）', pruned === 4, String(pruned));
check('有效勾选（奇幻类/红楼梦/丧葬礼仪）被保留',
  env.sandbox.scIsLeafSelected(settings, '奇幻类', '红楼梦', '丧葬礼仪') === true);
check('失效的旧主题键被删掉',
  !settings.selectedLeaves['奇幻类'].红楼梦['第一回'], JSON.stringify(settings.selectedLeaves));
check('不存在的旧卡组整块被删掉', !settings.selectedLeaves['红楼梦']);
check('清理后抽卡范围收敛到剩下那张', env.sandbox.scFilterBySelection(settings).cards.length === 1,
  String(env.sandbox.scFilterBySelection(settings).cards.length));
// 干净的设置不该被误改
settings.selectedLeaves = {};
check('没有失效勾选时返回 0', env.sandbox.scPruneStaleSelection(settings) === 0);

// ---------- 3. 抽卡与抽过不重复 ----------
section('抽卡与抽过不重复');
// 只勾一个「单张卡的主题」，验证抽完不重复 + 抽完回退。
env.sandbox.scSetLeafSelected(settings, singleCardTopic.category, singleCardTopic.deck, singleCardTopic.chapter, true);
settings.avoidRepeat = true;
let draw = env.sandbox.scDrawCard(settings, 'test-chat');
check('能抽到卡', Boolean(draw.card));
check('抽到的是范围内那张', draw.card && draw.card.id === singleCardTopic.card.id, draw.card && draw.card.id);
check('首次抽卡未抽过', draw.drawnInPool === 0);
env.sandbox.scCommitDraw(draw.card, 'test-chat');
check('落账后 chatMetadata 里有记录',
  Boolean(env.host.chatMetadata.story_cards_drawn?.['test-chat']?.[singleCardTopic.card.id]));
check('落账写了 chatMetadata', (env.host._metadataSaves || 0) > 0);

draw = env.sandbox.scDrawCard(settings, 'test-chat');
check('范围内抽完后 exhausted = true', draw.exhausted === true);
check('抽完后仍给出一张（允许重复）', Boolean(draw.card));
check('抽完后候选池 = 范围本身', draw.candidates.length === 1, String(draw.candidates.length));

// 换一个聊天：记录互不干扰
const freshDraw = env.sandbox.scDrawCard(settings, 'another-chat');
check('换聊天后记录独立（未抽过）', freshDraw.exhausted === false && freshDraw.drawnInPool === 0);

// 关掉「抽过不重复」后不再剔除
settings.avoidRepeat = false;
draw = env.sandbox.scDrawCard(settings, 'test-chat');
check('关掉不重复后不标记 exhausted', draw.exhausted === false);
settings.avoidRepeat = true;

// 大范围随机：抽 300 次应覆盖多张且都在范围内
env.sandbox.scSetLeafSelected(settings, singleCardTopic.category, singleCardTopic.deck, singleCardTopic.chapter, false);
env.sandbox.scSetSubtreeSelected(settings, '现实类', '红楼梦', realityDeck.chapters.map((c) => c.name), true);
const seen = new Set();
let outOfScope = 0;
for (let i = 0; i < 300; i++) {
  const pick = env.sandbox.scDrawCard(settings, 'random-chat-' + i);
  if (!pick.card) continue;
  if (pick.card.category !== '现实类') outOfScope += 1;
  seen.add(pick.card.id);
}
check('300 次抽卡都在范围内（无越界）', outOfScope === 0, String(outOfScope));
check('300 次抽卡覆盖了多张卡（随机性正常）', seen.size > 50, String(seen.size));

// 重置记录
env.sandbox.scSetLeafSelected(settings, '现实类', '红楼梦', '市井生计', false);
env.sandbox.scSetLeafSelected(settings, singleCardTopic.category, singleCardTopic.deck, singleCardTopic.chapter, true);
const cleared = env.sandbox.scResetDrawn('test-chat');
check('重置返回清掉的条数', cleared === 1, String(cleared));
check('重置后记录为空', Object.keys(env.host.chatMetadata.story_cards_drawn['test-chat']).length === 0);

// ---------- 4. 注入文本 ----------
section('注入文本形态');
const injectText = env.sandbox.scBuildInjectionText(sample);
check('以 <Story_Card_Draw> 开头', injectText.startsWith('<Story_Card_Draw>'));
check('以 </Story_Card_Draw> 结尾', injectText.endsWith('</Story_Card_Draw>'));
check('声明了「不是剧情正文」', injectText.includes('不是剧情正文'));
check('带强制执行规则', injectText.includes('强制指令') && injectText.includes('不得整段弃用')
  && injectText.includes('直接驱动') && injectText.includes('冲突裁决'));
check('合理化排在第一条且标注最重要',
  injectText.includes('1. 合理化（最重要）'), injectText.split('\n').find((l) => l.startsWith('1. ')));
check('合理化要求「宁可玩家不出场，也不硬塞」',
  injectText.includes('宁可让玩家完全不出场') && injectText.includes('也不要把玩家硬塞进场景'));
check('合理化允许「宁编新人物，不套已有角色」',
  injectText.includes('宁可新编一个人物') && injectText.includes('也不要把卡强行套在已有角色身上'));
check('文字风格服从正文既有文风',
  injectText.includes('文字风格') && injectText.includes('不要照搬它的文风')
    && injectText.includes('不改变正文风格'));
check('衔接允许推进时间 / 切场景（不要求无缝）',
  injectText.includes('可以推进时间') && injectText.includes('切到下一个场景')
    && !injectText.includes('无缝衔接'));
check('冲突裁决以卡为准（覆盖惯性理解）',
  injectText.includes('以本卡为准') && injectText.includes('惯性理解'));
check('不再出现旧的「优先级」条目', !injectText.includes('5. 优先级'));
check('带卡 id / 卡名',
  injectText.includes(`id="${sample.id}"`) && injectText.includes(`name="${sample.name}"`),
  `${sample.id} / ${sample.name}`);
if (sample.type) {
  check('带类型', injectText.includes(`type="${sample.type}"`), sample.type);
}
check('带分类', injectText.includes(`category="${sample.category}"`), sample.category);
check('带卡面正文', injectText.includes(sample.face.slice(0, 20)), sample.face.slice(0, 20));
check('带注意事项（落地调整规则）', injectText.includes('注意事项（落地调整规则）'));
if (sample.noteItems.length > 0) {
  check('注意事项条目逐条列出', injectText.includes(`【${sample.noteItems[0].key}】`),
    sample.noteItems[0].key);
}
check('不含设计底稿', !injectText.includes('设计底稿'));

// 注入写入宿主槽位
const applied = env.sandbox.scApplyInjection(sample, env.host);
check('scApplyInjection 成功', applied === true);
const slot = env.host.extensionPrompts['story-cards-draw'];
check('注入写入 story-cards-draw 槽位', Boolean(slot));
check('注入位置为 IN_CHAT(1)', slot && slot.position === 1, slot && String(slot.position));
check('注入深度为 0', slot && slot.depth === 0, slot && String(slot.depth));
check('注入角色为 SYSTEM(0)', slot && slot.role === 0, slot && String(slot.role));
check('槽位内容含卡面', slot && slot.value.includes(sample.face.slice(0, 20)));

// 「查看注入的提示词」：注入后要能取回原文与落点参数。
const lastInject = env.sandbox.scGetLastInjection();
check('注入后能取回最近一次注入记录', Boolean(lastInject));
check('记录原文与槽位一致', lastInject && lastInject.text === slot.value);
check('记录带卡 id / 卡名',
  lastInject && lastInject.cardId === sample.id && lastInject.cardName === sample.name,
  lastInject && (lastInject.cardId + '/' + lastInject.cardName));
check('记录带落点参数（IN_CHAT / depth 0 / SYSTEM）',
  lastInject && lastInject.inChat === 1 && lastInject.depth === 0 && lastInject.systemRole === 0,
  lastInject && [lastInject.inChat, lastInject.depth, lastInject.systemRole].join(','));

// 清理
env.sandbox.scClearInjection(env.host);
check('清理后槽位为空', env.host.extensionPrompts['story-cards-draw'].value === '');

// 重新生成重放：只有「刚抽完、没走远」的那一轮才允许重放。
// 造一个真实形态的聊天：... + 触发短语（最后一条）。
env.host.chat.push({ is_user: true, mes: TRIGGER_TEXT });
env.sandbox.scCommitDraw(sample, 'test-chat');
env.sandbox.scReplayInjectionForRetry(env.host);
check('重新生成能重放同一张卡的注入',
  env.host.extensionPrompts['story-cards-draw'].value.includes(sample.id));

// 生成结束 → 槽位清空
env.sandbox.scClearInjection(env.host);
check('生成结束后槽位为空', env.host.extensionPrompts['story-cards-draw'].value === '');

// 关键回归：生成结束之后，聊天往下走了几步，再点「重新生成」不应把旧卡捞回来。
env.host.chat.push({ is_ai: true, mes: 'AI 第一轮回复' });
env.host.chat.push({ is_user: true, mes: '玩家又聊了一句' });
env.host.chat.push({ is_ai: true, mes: 'AI 第二轮回复' });
const replayedFar = env.sandbox.scReplayInjectionForRetry(env.host);
check('聊天已经往下走时，重新生成不再重放旧卡', replayedFar === false,
  '返回值 ' + replayedFar);
check('不重放时槽位保持为空',
  env.host.extensionPrompts['story-cards-draw'].value === '',
  env.host.extensionPrompts['story-cards-draw'].value.slice(0, 40));

// 过期记录也不重放
env.host.chat.length = 0;
env.host.chat.push({ is_user: true, mes: TRIGGER_TEXT });
env.sandbox.scCommitDraw(sample, 'test-chat');
env.sandbox.__story_cards_last_draw__ = Object.assign(
  {}, env.sandbox.__story_cards_last_draw__, { at: new Date(Date.now() - 11 * 60 * 1000).toISOString() });
const replayedStale = env.sandbox.scReplayInjectionForRetry(env.host);
check('超过有效期的记录不再重放', replayedStale === false, '返回值 ' + replayedStale);

// 换聊天不重放
env.host.chat.length = 0;
env.host.chat.push({ is_user: true, mes: TRIGGER_TEXT });
env.sandbox.scCommitDraw(sample, 'test-chat');
const originalChatId = env.host.getCurrentChatId;
env.host.getCurrentChatId = () => 'other-chat';
const replayedOtherChat = env.sandbox.scReplayInjectionForRetry(env.host);
env.host.getCurrentChatId = originalChatId;
check('换聊天后不重放上一轮的卡', replayedOtherChat === false, '返回值 ' + replayedOtherChat);

// 触发短语被同位置的别的消息顶掉（聊天被裁剪 / 编辑）时不重放
env.host.chat.length = 0;
env.host.chat.push({ is_user: true, mes: TRIGGER_TEXT });
env.sandbox.scCommitDraw(sample, 'test-chat');
env.host.chat[0] = { is_user: true, mes: '玩家手动打的一句别的话' };
const replayedMoved = env.sandbox.scReplayInjectionForRetry(env.host);
check('触发短语不在原处时不重放', replayedMoved === false, '返回值 ' + replayedMoved);

// 切聊天必须主动清槽位（宿主不保证会清）
env.sandbox.scApplyInjection(sample, env.host);
check('切聊天前槽位有内容',
  env.host.extensionPrompts['story-cards-draw'].value.includes(sample.name));
env.host._emit(env.host.event_types.CHAT_CHANGED);
check('切聊天后槽位被清空',
  env.host.extensionPrompts['story-cards-draw'].value === '',
  env.host.extensionPrompts['story-cards-draw'].value.slice(0, 40));
check('切聊天后重放记录被清掉', !env.sandbox.__story_cards_last_draw__);

// 注入超时兜底：宿主要是压根没开始生成，generationEnded 就不来，
// 槽位里的卡面会一直挂着、被之后某条无关消息带出去。到点必须自己清。
env.sandbox.scApplyInjection(sample, env.host);
check('注入后排上了超时清理定时器',
  Boolean(env.sandbox.__story_cards_inject_expiry__));
check('超时前槽位有内容',
  env.host.extensionPrompts['story-cards-draw'].value.includes(sample.name));
env.sandbox.scExpireInjection();
check('超时后槽位被清空',
  env.host.extensionPrompts['story-cards-draw'].value === '',
  env.host.extensionPrompts['story-cards-draw'].value.slice(0, 40));
check('超时后定时器句柄已释放',
  env.sandbox.__story_cards_inject_expiry__ === null);

// 正常清理也要取消定时器，别让它在后面莫名其妙再清一次。
env.sandbox.scApplyInjection(sample, env.host);
env.sandbox.scClearInjection(env.host);
check('主动清理会取消超时定时器',
  env.sandbox.__story_cards_inject_expiry__ === null);

// ---------- 5. 发送链路 ----------
section('发送链路（填输入框 → 发送 → 落账）');

// 后面的用例要 await 宿主异步确认，包在 async main 里跑（CommonJS 不能顶层 await）。
async function main() {
  env.sandbox.scClearInjection(env.host);
  const chatBefore = env.host.chat.length;
  const sendResult = await env.sandbox.scFillAndSend(TRIGGER_TEXT);
  check('scFillAndSend 成功', sendResult.ok === true, sendResult.reason);
  check('用了发送按钮路径', sendResult.strategy === 'send_but.click', sendResult.strategy);
  check('chat 多了一条消息', env.host.chat.length === chatBefore + 1,
    chatBefore + ' → ' + env.host.chat.length);
  check('发出去的就是触发短语', env.host.chat[env.host.chat.length - 1].mes === '【剧情抽卡】',
    env.host.chat[env.host.chat.length - 1].mes);
  check('发送后输入框已清空', env.textarea.value === '');

  // 生成中不允许发送
  env.host._generating = true;
  const busy = await env.sandbox.scFillAndSend(TRIGGER_TEXT);
  check('生成中拒绝发送', busy.ok === false && busy.reason.includes('生成中'), busy.reason);
  env.host._generating = false;

  // ---------- 6. UI 挂载 ----------
  section('UI 挂载');
  check('面板已创建', Boolean(env.document.getElementById('sc-panel')));
  check('悬浮按钮已创建', Boolean(env.document.getElementById('sc-floating-button')));
  check('扩展菜单项已注入', Boolean(env.document.getElementById('sc-menu-item')));
  env.sandbox.scOpenPanel();
  check('面板可打开', env.document.getElementById('sc-panel').classList.contains('sc-panel--open'));
  env.sandbox.scRenderScopeTree();
  const treeHost = env.document.getElementById('sc-scope-tree');
  check('范围树渲染出节点', treeHost.children.length > 0, String(treeHost.children.length));
  const checkboxCount = findToggles(treeHost).length;
  check('范围树有勾选框', checkboxCount > 0, String(checkboxCount));
  const avoidRepeatBox = env.document.getElementById('sc-avoid-repeat');
  check('「抽过不重复」开关存在且默认勾上', Boolean(avoidRepeatBox) && avoidRepeatBox.checked === true);
  // 取消勾选应写进设置
  avoidRepeatBox.checked = false;
  avoidRepeatBox.dispatchEvent({ type: 'change' });
  check('取消勾选写进设置', env.sandbox.scGetSettings().avoidRepeat === false);
  avoidRepeatBox.checked = true;
  avoidRepeatBox.dispatchEvent({ type: 'change' });
  check('重新勾上写进设置', env.sandbox.scGetSettings().avoidRepeat === true);

  // 点「剧情抽卡」按钮走完整流程
  const drawButton = env.document.getElementById('sc-draw-button');
  const beforeClick = env.host.chat.length;
  drawButton.click();
  await new Promise((resolve) => setTimeout(resolve, 900));
  check('点抽卡按钮后发出了一条消息', env.host.chat.length === beforeClick + 1,
    beforeClick + ' → ' + env.host.chat.length);
  check('点抽卡按钮后注入了卡面',
    String(env.host.extensionPrompts['story-cards-draw'].value || '').includes('卡面：'));
  const resultBox = env.document.getElementById('sc-result');
  check('结果显示抽到的卡名', resultBox.textContent.trim().length > 0, resultBox.textContent.trim());

  // 「查看注入的提示词」：标题栏按钮在，点一下整屏切到查看界面，再点「返回」回主界面。
  const mainView = env.document.getElementById('sc-main-view');
  const injectView = env.document.getElementById('sc-inject-view');
  const viewInjectButton = env.document.getElementById('sc-view-inject');
  const backButton = env.document.getElementById('sc-inject-back');
  check('主界面与查看界面都存在', Boolean(mainView) && Boolean(injectView));
  check('「查看注入的提示词」按钮存在（标题栏）', Boolean(viewInjectButton));
  check('「返回」按钮存在', Boolean(backButton));
  check('默认停在主界面（查看界面隐藏）',
    mainView.hidden === false && injectView.hidden === true);
  viewInjectButton.click();
  check('点眼睛按钮切到查看界面',
    mainView.hidden === true && injectView.hidden === false);
  const injectPreview = env.document.getElementById('sc-inject-preview');
  const previewText = injectPreview.find((node) => node.classList.contains('sc-inject__text'));
  check('查看界面里有注入原文', Boolean(previewText) && previewText.textContent.length > 0,
    previewText && String(previewText.textContent.length));
  check('预览原文与槽位一致',
    previewText && previewText.textContent === env.host.extensionPrompts['story-cards-draw'].value,
    previewText && previewText.textContent.slice(0, 30));
  check('预览带落点参数说明',
    injectPreview.find((node) => node.classList.contains('sc-inject__meta')) !== null);
  check('预览有复制按钮', Boolean(env.document.getElementById('sc-inject-copy')));
  backButton.click();
  check('点「返回」回主界面',
    mainView.hidden === false && injectView.hidden === true);
  // 没抽过卡时，查看界面显示空态提示而不是崩掉。
  env.sandbox.__story_cards_last_inject__ = null;
  viewInjectButton.click();
  check('无注入记录时查看界面显示空态',
    injectView.find((node) => node.classList.contains('sc-inject__empty')) !== null);
  backButton.click();

  // ---------- 7. 范围树交互（勾选 + 展开） ----------
  // 树三层与目录一致：分类 → 卡组 → 主题。顶层分类行常显，卡组行要展开分类才出，
  // 主题行要再展开卡组才出。
  section('范围树交互');
  const treeEl = () => env.document.getElementById('sc-scope-tree');
  const rowsOf = (cls) => {
    const out = [];
    treeEl().walk((node) => { if (node.classList.contains(cls)) out.push(node); });
    return out;
  };
  const categoryRows = () => rowsOf('sc-tree__row--category');
  const deckRows = () => rowsOf('sc-tree__row--deck');
  const chapterRows = () => rowsOf('sc-tree__row--chapter');
  // 展开/收起的监听挂在「整块」（sc-tree__category / sc-tree__deck）上，
  // 行只占内容宽度；点行空白处等价于点整块，所以派发到行的父节点。
  const clickBlank = (row) => row.parentNode.dispatch('click',
    { type: 'click', target: row, stopPropagation() {}, preventDefault() {} });

  // 从干净状态开始：前面几节留下的勾选先清掉，免得干扰本节计数断言。
  env.sandbox.scGetSettings().selectedLeaves = {};
  env.sandbox.scClosePanel();
  env.sandbox.scOpenPanel();
  check('默认不展开：没有可见的主题行', chapterRows().length === 0, String(chapterRows().length));
  check('默认不展开：没有可见的卡组行', deckRows().length === 0, String(deckRows().length));
  check('顶层分类行常显（2 个）', categoryRows().length === 2, String(categoryRows().length));

  // 点分类行的空白处 → 展开出卡组行
  const categoryRow = categoryRows()[0];
  clickBlank(categoryRow);
  check('点分类行空白处展开出卡组行', deckRows().length === 1, String(deckRows().length));
  check('分类展开后主题行仍收起', chapterRows().length === 0, String(chapterRows().length));

  // 点卡组行的空白处 → 展开出主题行
  const deckRow = deckRows()[0];
  clickBlank(deckRow);
  check('点卡组行空白处展开出主题行', chapterRows().length > 0, String(chapterRows().length));
  const expandedChapters = chapterRows().length;

  // 回归：真实浏览器里点击会冒泡，点卡组行也会触发外层分类块的监听器。
  // 必须保证「点卡组行」只切换卡组，不会连带把分类收起。
  const bubbleClick = (node) => {
    const event = { type: 'click', target: node, stopPropagation() {}, preventDefault() {} };
    let current = node;
    while (current) {
      current.dispatch('click', event);
      current = current.parentNode;
    }
  };
  // 先收起，回到「分类展开、卡组收起」，再点卡组行（带冒泡）。
  clickBlank(deckRows()[0]);
  check('点卡组行收起主题', chapterRows().length === 0, String(chapterRows().length));
  bubbleClick(deckRows()[0]);
  check('点卡组行（带冒泡）只展开卡组', chapterRows().length > 0, String(chapterRows().length));
  check('点卡组行（带冒泡）不会连带收起分类', deckRows().length === 1, String(deckRows().length));
  // 再点一次带冒泡的卡组行：只应收起主题，分类仍展开。
  bubbleClick(deckRows()[0]);
  check('再点卡组行（带冒泡）只收起主题', chapterRows().length === 0, String(chapterRows().length));
  check('再点卡组行（带冒泡）分类仍展开', deckRows().length === 1, String(deckRows().length));
  // 回到展开状态，供后续断言使用。
  clickBlank(deckRows()[0]);
  const expandedChapters2 = chapterRows().length;
  check('恢复展开后主题行数量一致', expandedChapters2 === expandedChapters,
    expandedChapters2 + ' vs ' + expandedChapters);

  // 点分类勾选框：勾上整个分类（奇幻类），而且不能连带收起
  const categoryBox = findToggles(categoryRow)[0];
  check('分类行里有勾选框', Boolean(categoryBox));
  check('勾选框是自绘按钮（不是原生 input）', categoryBox && categoryBox.tagName === 'BUTTON',
    categoryBox && categoryBox.tagName);
  clickCheckbox(categoryBox);
  const afterCheck = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings());
  check('点分类勾选框勾上整个分类（奇幻类）', afterCheck.selectedCards === FANTASY_TOTAL,
    afterCheck.selectedCards + ' 期望 ' + FANTASY_TOTAL);
  check('点勾选框不会连带收起/展开', chapterRows().length === expandedChapters,
    chapterRows().length + ' vs ' + expandedChapters);
  const categoryBox2 = findToggles(categoryRows()[0])[0];
  check('重渲染后勾选框显示为已勾上',
    categoryBox2 && categoryBox2.dataset.state === 'all' && categoryBox2.getAttribute('aria-checked') === 'true',
    categoryBox2 && (categoryBox2.dataset.state + '/' + categoryBox2.getAttribute('aria-checked')));

  // 取消勾选
  clickCheckbox(categoryBox2);
  check('再点一次取消勾选',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards === 0);

  // 主题级勾选：只勾一张，父级卡组 / 分类应显示三态 partial
  const chapterBox = findToggles(chapterRows()[0])[0];
  clickCheckbox(chapterBox);
  const afterChapter = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings());
  check('点主题勾选框勾上该主题', afterChapter.selectedLeaves === 1 && afterChapter.selectedCards > 0,
    afterChapter.selectedLeaves + '/' + afterChapter.selectedCards);
  const deckBoxPartial = findToggles(deckRows()[0])[0];
  check('部分勾选时卡组框显示三态 partial',
    deckBoxPartial && deckBoxPartial.dataset.state === 'partial'
      && deckBoxPartial.getAttribute('aria-checked') === 'mixed',
    deckBoxPartial && (deckBoxPartial.dataset.state + '/' + deckBoxPartial.getAttribute('aria-checked')));
  const categoryBoxPartial = findToggles(categoryRows()[0])[0];
  check('部分勾选时分类框也显示三态 partial',
    categoryBoxPartial && categoryBoxPartial.dataset.state === 'partial',
    categoryBoxPartial && categoryBoxPartial.dataset.state);
  // 卡组三态框点一下 = 全选该卡组（奇幻类/红楼梦）
  clickCheckbox(deckBoxPartial);
  check('卡组三态框点一下变全选（奇幻类）',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards === FANTASY_TOTAL,
    String(env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards));
  // 再点一下 = 全不选，回到干净状态
  clickCheckbox(findToggles(deckRows()[0])[0]);
  check('全选框再点一下变全不选',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards === 0);
  // 两个分类都勾上 = 全库张数
  clickCheckbox(findToggles(categoryRows()[0])[0]);
  clickCheckbox(findToggles(categoryRows()[1])[0]);
  check('两个分类都勾上 = 全库张数',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards === TOTAL,
    String(env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards));
  clickCheckbox(findToggles(categoryRows()[0])[0]);
  clickCheckbox(findToggles(categoryRows()[1])[0]);
  check('取消两个分类后回到 0',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards === 0);

  // 收起来再展开，勾选状态要留着：先勾上一个主题，再收起 / 展开卡组
  clickCheckbox(findToggles(chapterRows()[0])[0]);
  check('重新勾上一个主题',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedLeaves === 1);
  const deckRow2 = deckRows()[0];
  clickBlank(deckRow2);
  check('再点卡组行会收起主题', chapterRows().length === 0, String(chapterRows().length));
  const deckRow3 = deckRows()[0];
  clickBlank(deckRow3);
  const chapterBox2 = findToggles(chapterRows()[0])[0];
  check('收起再展开后勾选状态还在',
    chapterBox2 && chapterBox2.dataset.state === 'all', chapterBox2 && chapterBox2.dataset.state);
  // 收尾：清空勾选，免得影响后面的用例
  clickCheckbox(findToggles(deckRows()[0])[0]);
  clickCheckbox(findToggles(deckRows()[0])[0]);

  // ---------- 7.5 计数一律「x张/x张」 ----------
  section('计数显示');
  env.sandbox.scOpenPanel();
  const countOfRow = (node) => (node
    ? node.find((child) => child.classList.contains('sc-tree__count'))
    : null);
  const allCountTexts = () => {
    const out = [];
    treeEl().walk((node) => {
      if (node.classList.contains('sc-tree__count')) out.push(node.textContent);
    });
    return out;
  };

  // 分类行常显，未勾选时显示 0张/总数
  const categoryCountTexts = () => categoryRows().map((row) => countOfRow(row)).filter(Boolean)
    .map((node) => node.textContent);
  const collapsedCategoryCounts = categoryCountTexts();
  check('分类行计数是「x张/x张」格式',
    collapsedCategoryCounts.length === 2
      && collapsedCategoryCounts.every((text) => /^\d+张\/\d+张$/.test(text)),
    collapsedCategoryCounts.join(' | '));
  check('分类行计数不带「回」',
    collapsedCategoryCounts.every((text) => !text.includes('回')), collapsedCategoryCounts.join(' | '));
  check('未勾选时分类行合计 0张/全库张数',
    collapsedCategoryCounts.every((text) => text.startsWith('0张/'))
      && collapsedCategoryCounts.reduce((sum, text) => sum + Number(text.split('/')[1].replace('张', '')), 0) === TOTAL,
    collapsedCategoryCounts.join(' | '));

  // 展开分类 → 卡组行；展开卡组 → 主题行
  if (deckRows().length === 0) clickBlank(categoryRows()[0]);
  const deckCountText = countOfRow(deckRows()[0]);
  check('卡组行计数是「x张/x张」格式',
    deckCountText && /^\d+张\/\d+张$/.test(deckCountText.textContent),
    deckCountText && deckCountText.textContent);
  if (chapterRows().length === 0) clickBlank(deckRows()[0]);
  const chapterCounts = chapterRows().map((row) => countOfRow(row)).filter(Boolean)
    .map((node) => node.textContent);
  check('主题行计数都是「x张/x张」',
    chapterCounts.length > 0 && chapterCounts.every((text) => /^\d+张\/\d+张$/.test(text)),
    chapterCounts.slice(0, 3).join(' | '));

  // 勾上一个主题后，各级计数应同步变化（选中数跟着张数走，不是主题数）
  const firstChapterRow = chapterRows()[0];
  clickCheckbox(findToggles(firstChapterRow)[0]);
  const selectedCards = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards;
  const summaryText = env.document.getElementById('sc-scope-summary').textContent;
  check('概况行是「x张/x张」格式', /^\d+张\/\d+张/.test(summaryText), summaryText);
  check('概况行不含「回」字', !summaryText.includes('回'), summaryText);
  const summarySelected = Number(summaryText.split('/')[0].replace('张', ''));
  check('概况行选中张数与统计一致', summarySelected === selectedCards, summaryText + ' vs ' + selectedCards);
  const deckAfterCheck = countOfRow(deckRows()[0]);
  check('勾选后卡组行计数同步', deckAfterCheck && deckAfterCheck.textContent.split('/')[0]
    === selectedCards + '张', deckAfterCheck && deckAfterCheck.textContent);
  const categoryAfterCheck = countOfRow(categoryRows()[0]);
  check('勾选后分类行计数同步', categoryAfterCheck && categoryAfterCheck.textContent.split('/')[0]
    === selectedCards + '张', categoryAfterCheck && categoryAfterCheck.textContent);
  check('整棵树里没有残留的「回」计数',
    allCountTexts().every((text) => !text.includes('回')), allCountTexts().join(' | '));
  // 收尾：清空勾选
  clickCheckbox(findToggles(categoryRows()[0])[0]);
  clickCheckbox(findToggles(categoryRows()[0])[0]);

  // ---------- 8. 导入 / 导出卡片 ----------
  section('导入 / 导出卡片');
  check('「导入卡片」按钮存在', Boolean(env.document.getElementById('sc-import-cards')));
  check('「导出卡片」按钮存在', Boolean(env.document.getElementById('sc-export-cards')));
  check('旧的加载 / 移除按钮已不在',
    !env.document.getElementById('sc-load-cards') && !env.document.getElementById('sc-clear-cards'));
  check('卡库状态行显示张数', env.document.getElementById('sc-card-status').textContent.includes(String(TOTAL)),
    env.document.getElementById('sc-card-status').textContent);

  const newCard = {
    id: 'X1-01-试作卡',
    number: 'X1-01',
    name: '试作卡',
    type: '测试 / 导入',
    deck: '新卡组',
    category: '现实类',
    chapter: '市井生计',
    rel: '现实类/新卡组/市井生计/X1-01-试作卡',
    face: '这是导入进来的试作卡卡面。',
    notes: '**合理化**：测试用。',
    noteItems: [{ key: '合理化', value: '测试用。' }],
  };
  const importText = JSON.stringify({ format: 'story-cards', version: 1, cards: [newCard] });
  const importResult = env.sandbox.scImportCardsFromText(importText);
  check('导入 1 张（新增 1）', importResult.ok && importResult.added === 1 && importResult.replaced === 0,
    JSON.stringify(importResult));
  check('导入后卡库 = 全库 + 1', env.sandbox.scGetLibrary().length === TOTAL + 1,
    String(env.sandbox.scGetLibrary().length));
  check('新卡组出现在范围树里',
    env.sandbox.scBuildScopeTree().some((category) => category.decks.some((deck) => deck.name === '新卡组')));
  check('新卡能被抽到', env.sandbox.scGetLibrary().some((card) => card.id === 'X1-01-试作卡'));
  check('导入结果写进状态行', env.document.getElementById('sc-card-status').textContent.includes('导入'),
    env.document.getElementById('sc-card-status').textContent);

  // 覆盖同 id：自己改卡面后重新导入即时生效
  const changedCard = Object.assign({}, newCard, { face: '改过的卡面' });
  const overwriteResult = env.sandbox.scImportCardsFromText(JSON.stringify([changedCard]));
  check('裸数组也能导入，且同 id 覆盖而不是新增',
    overwriteResult.ok && overwriteResult.added === 0 && overwriteResult.replaced === 1,
    JSON.stringify(overwriteResult));
  check('覆盖后卡面已更新',
    env.sandbox.scGetLibrary().find((card) => card.id === 'X1-01-试作卡').face.includes('改过的卡面'));
  check('覆盖后总数仍是 全库 + 1', env.sandbox.scGetLibrary().length === TOTAL + 1,
    String(env.sandbox.scGetLibrary().length));

  // 缺层级字段：兜底到未分组 / 未分类 / 未分主题，而不是被丢弃
  const bareResult = env.sandbox.scImportCardsFromText(JSON.stringify({ cards: [{ id: 'bare-1', name: '光板卡' }] }));
  const bareCard = env.sandbox.scGetLibrary().find((card) => card.id === 'bare-1');
  check('缺层级字段的卡归到未分组', bareResult.ok && bareCard
    && bareCard.deck === '未分组' && bareCard.category === '未分类' && bareCard.chapter === '未分主题',
    bareCard && [bareCard.deck, bareCard.category, bareCard.chapter].join('/'));
  check('层级兜底后总数 = 全库 + 2', env.sandbox.scGetLibrary().length === TOTAL + 2,
    String(env.sandbox.scGetLibrary().length));

  // 坏文件不能把卡库搞乱
  const beforeBad = env.sandbox.scGetLibrary().length;
  const badJson = env.sandbox.scImportCardsFromText('{ 这不是 json');
  check('非法 JSON 被拒绝且卡库不变',
    badJson.ok === false && env.sandbox.scGetLibrary().length === beforeBad, JSON.stringify(badJson));
  const noCards = env.sandbox.scImportCardsFromText(JSON.stringify({ hello: 'world' }));
  check('没有 cards 数组的文件被拒绝', noCards.ok === false && /cards/.test(noCards.error), noCards.error);
  const emptyList = env.sandbox.scImportCardsFromText('[]');
  check('空数组被拒绝', emptyList.ok === false && env.sandbox.scGetLibrary().length === beforeBad,
    emptyList.error);

  // 导入的卡能正常参与抽卡与注入
  const loadSettings = env.sandbox.scGetSettings();
  loadSettings.selectedLeaves = {};
  env.sandbox.scSetLeafSelected(loadSettings, '现实类', '新卡组', '市井生计', true);
  const loadDraw = env.sandbox.scDrawCard(loadSettings, 'load-chat');
  check('能在新卡组范围里抽到导入的卡', loadDraw.card && loadDraw.card.id === 'X1-01-试作卡',
    loadDraw.card && loadDraw.card.id);
  const loadInject = env.sandbox.scBuildInjectionText(loadDraw.card);
  check('导入的卡也能拼注入块', loadInject.includes('X1-01-试作卡') && loadInject.includes('改过的卡面'));
  loadSettings.selectedLeaves = {};

  // 导出：快照 → JSON → 能原样再导入
  const exportJson = env.sandbox.scBuildExportJson();
  const exportData = JSON.parse(exportJson);
  check('导出 JSON 带格式标识与版本',
    exportData.format === 'story-cards' && exportData.version === 1, exportData.format + '/' + exportData.version);
  check('导出张数与卡库一致', exportData.count === TOTAL + 2 && exportData.cards.length === TOTAL + 2,
    exportData.count + '/' + exportData.cards.length);
  check('导出条目含卡面与层级', exportData.cards.every((card) => card.id && card.deck && card.category
    && card.chapter && typeof card.face === 'string'));
  check('导出条目不带运行期标记 custom', exportData.cards.every((card) => card.custom === undefined));
  const exportedCustom = env.sandbox.scGetCustomCards();
  check('导出时自定义卡都在', exportedCustom.length === 2, String(exportedCustom.length));

  // 下载链路：Blob → createObjectURL → <a download> → click
  const downloadsBefore = env.downloads.length;
  const fileName = env.sandbox.scExportFileName(new Date(2026, 9, 20, 15, 30, 45));
  check('导出文件名带时间戳', fileName === 'story-cards-20261020-153045.json', fileName);
  const downloaded = env.sandbox.scDownloadTextFile(exportJson, fileName);
  check('导出触发了下载', downloaded === true && env.downloads.length === downloadsBefore + 1);
  const downloadedBlob = env.downloads[env.downloads.length - 1];
  check('下载内容是完整 JSON',
    downloadedBlob.type.includes('application/json') && JSON.parse(downloadedBlob.text).count === TOTAL + 2);

  env.sandbox.scHandleExportCards();
  check('点导出会更新状态行', env.document.getElementById('sc-card-status').textContent.includes('已导出'),
    env.document.getElementById('sc-card-status').textContent);

  // 与内置完全一致的卡不重复写进设置：导出再导入一遍不会让卡库膨胀
  const beforeReimport = env.sandbox.scGetCustomCards().length;
  const reimport = env.sandbox.scImportCardsFromText(exportJson);
  check('重复导入同一份导出不会新增自定义卡',
    reimport.ok && env.sandbox.scGetCustomCards().length === beforeReimport, JSON.stringify(reimport));
  check('重复导入时内置卡被识别为「与内置一致」', reimport.unchanged === TOTAL, String(reimport.unchanged));
  check('重复导入后总数仍是 全库 + 2', env.sandbox.scGetLibrary().length === TOTAL + 2,
    String(env.sandbox.scGetLibrary().length));

  // 文件入口：大小上限与正常读取
  await env.sandbox.scHandlePickedJsonFile({
    name: 'huge.json', size: 17 * 1024 * 1024, text: async () => '[]',
  });
  check('超大 JSON 文件被拒绝',
    env.document.getElementById('sc-card-status').textContent.includes('文件太大'),
    env.document.getElementById('sc-card-status').textContent);
  await env.sandbox.scHandlePickedJsonFile({
    name: 'ok.json', size: 100, text: async () => JSON.stringify({ cards: [newCard] }),
  });
  check('文件入口能导入 JSON', env.sandbox.scGetLibrary().some((card) => card.id === 'X1-01-试作卡'));

  // 清空导入，回到构建期卡库（数据层）
  env.sandbox.scGetSettings().customCards = [];
  check('清空导入后回到全库张数', env.sandbox.scGetLibrary().length === TOTAL,
    String(env.sandbox.scGetLibrary().length));
  check('清空导入后新卡组从范围树消失',
    !env.sandbox.scBuildScopeTree().some((category) => category.decks.some((deck) => deck.name === '新卡组')));

  // ---------- 9. 勾选框实现契约 ----------
  section('勾选框：不依赖原生勾选框行为');
  env.sandbox.scRenderScopeTree();
  const firstToggle = findToggles(categoryRows()[0])[0];
  check('勾选框是 <button role="checkbox">（无原生激活时序）',
    firstToggle && firstToggle.tagName === 'BUTTON' && firstToggle.getAttribute('role') === 'checkbox',
    firstToggle && (firstToggle.tagName + '/' + firstToggle.getAttribute('role')));
  check('勾选框带 aria-checked 状态',
    firstToggle && ['true', 'false', 'mixed'].includes(firstToggle.getAttribute('aria-checked')),
    firstToggle && firstToggle.getAttribute('aria-checked'));
  check('勾选框外面套了 label（点文字也能勾）',
    Boolean(firstToggle.parentNode) && firstToggle.parentNode.tagName === 'LABEL',
    firstToggle.parentNode && firstToggle.parentNode.tagName);
  // 契约：源码里不得再出现原生 checkbox / preventDefault 依赖
  const boxSource = String(env.sandbox.scBuildCheckbox);
  check('不再使用原生 input checkbox', !boxSource.includes("'checkbox'") || boxSource.includes('role'));
  check('不再依赖 preventDefault 拦默认行为', !boxSource.includes('preventDefault'));

  // ---------- 10. 悬浮按钮拖动 ----------
  section('悬浮按钮拖动');
  const ball = env.document.getElementById('sc-floating-button');
  check('悬浮按钮存在', Boolean(ball));
  const pointerEvent = (x, y, id) => ({ clientX: x, clientY: y, pointerId: id || 1, button: 0, preventDefault() {} });
  // 视口 1280x800、按钮 38px、贴边留白 8px → 可放置范围 x∈[8,1234]、y∈[8,754]。
  const placeBall = (x, y) => {
    env.sandbox.scApplyFloatPosition(x, y);
  };
  const ballPos = () => [parseFloat(ball.style.left), parseFloat(ball.style.top)];
  // 完整拖一手：把按钮放在 (startX,startY)，指针按下并移动到 (endX,endY)。
  const dragBall = (startX, startY, endX, endY) => {
    placeBall(startX, startY);
    ball.dispatch('pointerdown', pointerEvent(startX, startY));
    ball.dispatch('pointermove', pointerEvent(endX, endY));
  };

  // 默认位置：右下角，且在视口内
  env.sandbox.scClosePanel();
  ball.style.left = '';
  ball.style.top = '';
  env.sandbox.scRestoreFloatPosition();
  const [defLeft, defTop] = ballPos();
  check('默认位置在视口内且偏右下', defLeft > 0 && defTop > 0 && defLeft <= 1234 && defTop <= 754,
    defLeft + ',' + defTop);

  // 拖动：指针从 (200,200) 移到 (700,500)，位移 (+500,+300) 全在界内，应精确跟随
  dragBall(200, 200, 700, 500);
  check('拖动后位置跟着指针走', ballPos()[0] === 700 && ballPos()[1] === 500, ballPos().join(','));
  check('拖动中清掉了 right/bottom（否则和 left/top 打架）',
    ball.style.right === 'auto' && ball.style.bottom === 'auto',
    ball.style.right + '/' + ball.style.bottom);
  ball.dispatch('pointerup', pointerEvent(700, 500));
  check('拖动结束后位置写进设置',
    env.sandbox.scGetSettings().floatX === 700 && env.sandbox.scGetSettings().floatY === 500,
    env.sandbox.scGetSettings().floatX + ',' + env.sandbox.scGetSettings().floatY);

  // 拖动过之后的那一次 click 不应打开面板
  ball.dispatch('click', { type: 'click', preventDefault() {} });
  check('拖动后的 click 不打开面板', env.sandbox.scIsPanelOpen() === false);
  // 再点一次（没拖动）应该打开面板
  ball.dispatch('click', { type: 'click', preventDefault() {} });
  check('普通点击打开面板', env.sandbox.scIsPanelOpen() === true);
  env.sandbox.scClosePanel();

  // 微小位移算点击，不算拖动
  placeBall(300, 300);
  ball.dispatch('pointerdown', pointerEvent(300, 300));
  ball.dispatch('pointermove', pointerEvent(302, 301));
  check('微小位移不算拖动（位置没变）', ballPos()[0] === 300 && ballPos()[1] === 300, ballPos().join(','));
  ball.dispatch('pointerup', pointerEvent(302, 301));
  check('微小位移不写设置', env.sandbox.scGetSettings().floatX === 700,
    String(env.sandbox.scGetSettings().floatX));

  // 拖出视口要被夹回来：右下角贴 1234/754，左上角贴 8/8
  dragBall(200, 200, 5000, 5000);
  check('拖出右下角会被夹在视口内', ballPos()[0] === 1234 && ballPos()[1] === 754, ballPos().join(','));
  ball.dispatch('pointermove', pointerEvent(-500, -500));
  check('拖出左上角会被夹在视口内', ballPos()[0] === 8 && ballPos()[1] === 8, ballPos().join(','));
  ball.dispatch('pointerup', pointerEvent(-500, -500));
  check('夹取后的坐标也写进设置',
    env.sandbox.scGetSettings().floatX === 8 && env.sandbox.scGetSettings().floatY === 8,
    env.sandbox.scGetSettings().floatX + ',' + env.sandbox.scGetSettings().floatY);

  // 位置持久化：重新夹取后仍用设置里的值
  placeBall(100, 100);
  env.sandbox.scRestoreFloatPosition();
  check('位置能从设置里恢复', ballPos()[0] === 8 && ballPos()[1] === 8, ballPos().join(','));

  // 视口变化后不会跑出去：把视口缩到 400x300，位置应被夹进新视口
  env.sandbox.innerWidth = 400;
  env.sandbox.innerHeight = 300;
  const resized = env.sandbox.scApplyFloatPosition(1234, 754);
  check('视口变小后位置被夹进新视口', resized.x === 354 && resized.y === 254,
    resized.x + ',' + resized.y);
  env.sandbox.innerWidth = 1280;
  env.sandbox.innerHeight = 800;

  // ---------- 10b. 长按隐藏悬浮球 ----------
  section('长按隐藏悬浮球');
  // 长按计时是 650ms，等真实时钟会让测试变慢。这里把 setTimeout 包一层：
  // 只截住长按计时（650ms），把它存起来由测试手动触发；其余定时器照旧执行。
  const realSetTimeout = env.sandbox.setTimeout;
  const realClearTimeout = env.sandbox.clearTimeout;
  let longPressTimers = [];
  env.sandbox.setTimeout = (fn, ms) => {
    if (ms === 650) {
      const handle = { fn };
      longPressTimers.push(handle);
      return handle;
    }
    return realSetTimeout(fn, ms);
  };
  env.sandbox.clearTimeout = (handle) => {
    if (handle && longPressTimers.includes(handle)) {
      longPressTimers = longPressTimers.filter((h) => h !== handle);
      return;
    }
    realClearTimeout(handle);
  };
  const fireLongPress = () => {
    const timers = longPressTimers;
    longPressTimers = [];
    timers.forEach((h) => h.fn());
  };

  env.sandbox.scShowFloatingButton();
  check('长按前悬浮球可见',
    env.sandbox.scGetSettings().showFloatingButton === true
      && ball.style.display !== 'none');
  placeBall(400, 400);
  ball.dispatch('pointerdown', pointerEvent(400, 400));
  check('按下后排上了长按计时', longPressTimers.length === 1, String(longPressTimers.length));
  // 容差内（< 8px）的抖动仍算长按，不该取消
  ball.dispatch('pointermove', pointerEvent(403, 402));
  check('容差内的微小抖动不取消长按', longPressTimers.length === 1, String(longPressTimers.length));
  fireLongPress();
  check('长按到点后悬浮球被隐藏',
    env.sandbox.scGetSettings().showFloatingButton === false,
    String(env.sandbox.scGetSettings().showFloatingButton));

  // 长按之后松开，不应顺带打开面板
  ball.dispatch('pointerup', pointerEvent(403, 402));
  check('长按收起后松开不会打开面板', env.sandbox.scIsPanelOpen() === false);

  // 面板里的「显示悬浮球」可以把它找回来
  env.sandbox.scOpenPanel();
  const floatBox = env.document.getElementById('sc-show-float');
  check('面板里有「显示悬浮球」开关', Boolean(floatBox));
  env.sandbox.scShowFloatingButton();
  env.sandbox.scRefreshSummary();
  check('重新打开后设置与勾选框同步',
    env.sandbox.scGetSettings().showFloatingButton === true && floatBox.checked === true,
    String(env.sandbox.scGetSettings().showFloatingButton) + '/' + floatBox.checked);
  env.sandbox.scClosePanel();

  // 拖动不算长按：移动超过阈值就该取消计时
  placeBall(400, 400);
  longPressTimers = [];
  ball.dispatch('pointerdown', pointerEvent(400, 400));
  ball.dispatch('pointermove', pointerEvent(500, 500));
  check('拖动会取消长按计时', longPressTimers.length === 0, String(longPressTimers.length));
  ball.dispatch('pointerup', pointerEvent(500, 500));
  check('拖完悬浮球仍在',
    env.sandbox.scGetSettings().showFloatingButton === true,
    String(env.sandbox.scGetSettings().showFloatingButton));

  // 还原计时器，别影响后面的用例
  env.sandbox.setTimeout = realSetTimeout;
  env.sandbox.clearTimeout = realClearTimeout;
  env.sandbox.scShowFloatingButton();
  env.sandbox.scClosePanel();

  // ---------- 11. TauriTavern 式宿主上下文（回归） ----------
  // 真实 TauriTavern 的 getContext() 有两个特点，之前任一都会让勾选「点了没反应」：
  //   1. 只给 extensionSettings（驼峰），没有 extension_settings；
  //   2. 每次调用都返回一个**新对象**。
  // 所以设置必须落在宿主共享的 extensionSettings 上，而不是临时对象上。
  section('TauriTavern 式宿主上下文');
  const tauri = boot({ tauriContext: true });
  const tauriHost = tauri.host;
  check('沙箱建出来了驼峰 extensionSettings 的宿主', Boolean(tauriHost.extensionSettings));
  check('每次 getContext() 返回的是不同对象',
    tauri.sandbox.SillyTavern.getContext() !== tauri.sandbox.SillyTavern.getContext());
  check('驼峰 extensionSettings 能被识别',
    tauri.sandbox.scFindSettingsStore(tauri.sandbox.SillyTavern.getContext()) === tauriHost.extensionSettings);
  check('找不到设置容器时返回 null', tauri.sandbox.scFindSettingsStore({}) === null);

  // 勾一个主题：写入必须落在宿主共享的 extensionSettings 上，
  // 否则下次渲染读到的是空对象，界面看起来「点了没反应」。
  const tauriSettings = tauri.sandbox.scGetSettings();
  tauri.sandbox.scSetLeafSelected(tauriSettings, '奇幻类', '红楼梦', '丧葬礼仪', true);
  tauri.sandbox.scSaveSettings();
  check('设置写进了宿主共享的 extensionSettings',
    Boolean(tauriHost.extensionSettings.storyCards));
  check('重新读取设置仍能拿到同一份勾选',
    tauri.sandbox.scIsLeafSelected(tauri.sandbox.scGetSettings(), '奇幻类', '红楼梦', '丧葬礼仪') === true);

  // 走真实渲染 + 点击路径：必须重渲染成新状态。
  tauri.sandbox.scOpenPanel();
  const tauriTree = tauri.document.getElementById('sc-scope-tree');
  // 顶层是分类行，勾了一个主题后应为 partial。
  const tauriCategoryRow = tauriTree.children[0].children[0];
  const tauriBox = findToggles(tauriCategoryRow)[0];
  check('驼峰设置下勾选框渲染为 partial（只勾了一个主题）',
    tauriBox && tauriBox.dataset.state === 'partial', tauriBox && tauriBox.dataset.state);
  clickCheckbox(tauriBox);
  const tauriBoxAfter = findToggles(tauriTree.children[0].children[0])[0];
  check('点一下后分类框变成全选', tauriBoxAfter && tauriBoxAfter.dataset.state === 'all',
    tauriBoxAfter && tauriBoxAfter.dataset.state);
  // 顶层是分类：点「奇幻类」整块 = 勾上它下面 3 个主题。
  check('点一下后设置里奇幻类的 3 个主题全勾上',
    Object.values(tauriHost.extensionSettings.storyCards.selectedLeaves['奇幻类'] || {}).reduce(
      (sum, chapters) => sum + Object.keys(chapters).length, 0) === 3);

  // ---------- 汇总 ----------
  console.log('\n============================');
  console.log(`检查 ${checks} 项，失败 ${failures} 项`);
  // 插件自带的事件源看门狗是 setInterval，会一直 ref 住事件循环；
  // 测试跑完必须显式退出，否则进程永远不结束。
  if (failures > 0) process.exit(1);
  console.log('全部通过。');
  process.exit(0);
}

main().catch((error) => {
  console.error('测试自身异常：', error);
  process.exit(1);
});
