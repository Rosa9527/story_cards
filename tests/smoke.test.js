// ===== 剧情抽卡（Story Cards）冒烟测试 =====
// 在 Node 里用最小 DOM / 宿主上下文替身跑一遍 index.js，验证：
//   1. 卡库构建结果（138 张、字段完整、卡面/注意事项解析正确）；
//   2. 范围树与勾选（勾回目 / 勾分类 / 勾卡组、三态统计、未勾=全库）；
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
    return { left, top, right: left + 46, bottom: top + 46, width: 46, height: 46, x: left, y: top };
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
  return { sandbox, document, host, menu, textarea, sendButton };
}

// ---------- 1. 卡库 ----------
section('卡库构建结果');
const env = boot();
const library = env.sandbox.STORY_CARDS_LIBRARY;
check('卡库存在且为数组', Array.isArray(library));
check('卡牌数量 = 138', library && library.length === 138, library && String(library.length));
const sample = library.find((card) => card.id === 'C1-03-半盏灯');
check('能按 id 找到 C1-03-半盏灯', Boolean(sample));
if (sample) {
  check('卡名解析正确', sample.name === '半盏灯', sample.name);
  check('卡号解析正确', sample.number === 'C1-03', sample.number);
  check('卡组/分类/回目解析正确', sample.deck === '红楼梦' && sample.category === '现实类' && sample.chapter === '第一回',
    [sample.deck, sample.category, sample.chapter].join('/'));
  check('类型解析正确', sample.type === '失去 / 疏忽', sample.type);
  check('卡面非空且含正文', sample.face.includes('烧了一半的灯') && sample.face.includes('孩子不见了'),
    sample.face.slice(0, 40));
  check('注意事项非空', sample.notes.includes('合理化'));
  check('注意事项条目已结构化', Array.isArray(sample.noteItems) && sample.noteItems.length >= 4,
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
const tree = env.sandbox.scBuildScopeTree();
check('只有一个卡组：红楼梦', tree.length === 1 && tree[0].name === '红楼梦');
check('卡组张数 = 138', tree[0] && tree[0].total === 138, tree[0] && String(tree[0].total));
const categoryNames = tree[0].categories.map((c) => c.name).sort();
check('两个分类：奇幻类 / 现实类', categoryNames.join(',') === '奇幻类,现实类', categoryNames.join(','));
const fantasy = tree[0].categories.find((c) => c.name === '奇幻类');
const reality = tree[0].categories.find((c) => c.name === '现实类');
check('类型与分类齐全', fantasy && reality && fantasy.total === 7 && reality.total === 131,
  (fantasy && fantasy.total) + '/' + (reality && reality.total));
// 回目叶子 = (分类, 回目) 组合数：现实类 20 回 + 奇幻类 7 回 = 27。
const leafCount = fantasy.chapters.length + reality.chapters.length;
check('回目叶子数 = 27（现实类 20 + 奇幻类 7）', leafCount === 27, String(leafCount));

const settings = env.sandbox.scGetSettings();
let stats = env.sandbox.scSummarizeSelection(settings);
check('初始未勾选时 selectedLeaves = 0', stats.selectedLeaves === 0);
let pool = env.sandbox.scFilterBySelection(settings);
check('未勾选时抽卡范围 = 全库（unrestricted）', pool.unrestricted === true && pool.cards.length === 138,
  String(pool.cards.length));

// 勾一个回目
env.sandbox.scSetLeafSelected(settings, '红楼梦', '奇幻类', '第一回', true);
stats = env.sandbox.scSummarizeSelection(settings);
check('勾「奇幻类/第一回」后 selectedLeaves = 1', stats.selectedLeaves === 1, String(stats.selectedLeaves));
check('勾「奇幻类/第一回」后覆盖 1 张', stats.selectedCards === 1, String(stats.selectedCards));
pool = env.sandbox.scFilterBySelection(settings);
check('抽卡范围收敛到 1 张', pool.unrestricted === false && pool.cards.length === 1, String(pool.cards.length));
check('这一张就是 C1-01-要孩子的人', pool.cards[0].id === 'C1-01-要孩子的人', pool.cards[0].id);

// 勾整个分类
const fantasyChapters = fantasy.chapters.map((c) => c.name);
env.sandbox.scSetSubtreeSelected(settings, '红楼梦', '奇幻类', fantasyChapters, true);
stats = env.sandbox.scSummarizeSelection(settings);
check('勾整个奇幻类后覆盖 7 张', stats.selectedCards === 7, String(stats.selectedCards));

// 勾整个卡组
for (const category of tree[0].categories) {
  env.sandbox.scSetSubtreeSelected(settings, '红楼梦', category.name, category.chapters.map((c) => c.name), true);
}
stats = env.sandbox.scSummarizeSelection(settings);
check('勾整个卡组后覆盖 138 张 / 27 回', stats.selectedCards === 138 && stats.selectedLeaves === 27,
  stats.selectedCards + '/' + stats.selectedLeaves);

// 全部取消 → 回到全库
for (const category of tree[0].categories) {
  env.sandbox.scSetSubtreeSelected(settings, '红楼梦', category.name, category.chapters.map((c) => c.name), false);
}
stats = env.sandbox.scSummarizeSelection(settings);
check('全部取消后回到 0 勾选', stats.selectedLeaves === 0, String(stats.selectedLeaves));

// ---------- 3. 抽卡与抽过不重复 ----------
section('抽卡与抽过不重复');
// 只勾「奇幻类/第一回」（1 张），验证抽完不重复 + 抽完回退。
env.sandbox.scSetLeafSelected(settings, '红楼梦', '奇幻类', '第一回', true);
settings.avoidRepeat = true;
let draw = env.sandbox.scDrawCard(settings, 'test-chat');
check('能抽到卡', Boolean(draw.card));
check('抽到的是范围内那张', draw.card && draw.card.id === 'C1-01-要孩子的人', draw.card && draw.card.id);
check('首次抽卡未抽过', draw.drawnInPool === 0);
env.sandbox.scCommitDraw(draw.card, 'test-chat');
check('落账后 chatMetadata 里有记录',
  Boolean(env.host.chatMetadata.story_cards_drawn?.['test-chat']?.['C1-01-要孩子的人']));
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

// 大范围随机：抽 200 次应覆盖多张且都在范围内
env.sandbox.scSetLeafSelected(settings, '红楼梦', '奇幻类', '第一回', false);
env.sandbox.scSetSubtreeSelected(settings, '红楼梦', '现实类', reality.chapters.map((c) => c.name), true);
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
env.sandbox.scSetLeafSelected(settings, '红楼梦', '现实类', '第一回', false);
env.sandbox.scSetLeafSelected(settings, '红楼梦', '奇幻类', '第一回', true);
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
check('带卡 id / 卡名', injectText.includes('id="C1-03-半盏灯"') && injectText.includes('name="半盏灯"'));
check('带类型与分类', injectText.includes('type="失去 / 疏忽"') && injectText.includes('category="现实类"'));
check('带卡面正文', injectText.includes('孩子不见了'));
check('带注意事项（落地调整规则）', injectText.includes('注意事项（落地调整规则）') && injectText.includes('【合理化】'));
check('注意事项条目逐条列出', injectText.includes('【甲是谁】') && injectText.includes('【玩家在哪】'));
check('不含设计底稿', !injectText.includes('设计底稿'));

// 注入写入宿主槽位
const applied = env.sandbox.scApplyInjection(sample, env.host);
check('scApplyInjection 成功', applied === true);
const slot = env.host.extensionPrompts['story-cards-draw'];
check('注入写入 story-cards-draw 槽位', Boolean(slot));
check('注入位置为 IN_CHAT(1)', slot && slot.position === 1, slot && String(slot.position));
check('注入深度为 0', slot && slot.depth === 0, slot && String(slot.depth));
check('注入角色为 SYSTEM(0)', slot && slot.role === 0, slot && String(slot.role));
check('槽位内容含卡面', slot && slot.value.includes('孩子不见了'));

// 清理
env.sandbox.scClearInjection(env.host);
check('清理后槽位为空', env.host.extensionPrompts['story-cards-draw'].value === '');

// 重新生成重放
env.sandbox.scCommitDraw(sample, 'test-chat');
env.sandbox.scReplayInjectionForRetry(env.host);
check('重新生成能重放同一张卡的注入',
  env.host.extensionPrompts['story-cards-draw'].value.includes('C1-03-半盏灯'));

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

  // ---------- 7. 范围树交互（勾选 + 展开） ----------
  section('范围树交互');
  const treeEl = () => env.document.getElementById('sc-scope-tree');
  const deckRows = () => treeEl().children.filter((node) => node.classList.contains('sc-tree__deck'));
  const chapterRows = () => {
    const out = [];
    treeEl().walk((node) => {
      if (node.classList.contains('sc-tree__row--chapter')) out.push(node);
    });
    return out;
  };

  // 默认必须全部收起
  env.sandbox.scClosePanel();
  env.sandbox.scOpenPanel();
  check('默认不展开：没有可见的回目行', chapterRows().length === 0, String(chapterRows().length));
  check('默认不展开：卡组行还在', deckRows().length === 1, String(deckRows().length));

  // 点卡组行的空白处 → 展开
  const deckRow = deckRows()[0];
  deckRow.dispatch('click', { type: 'click', target: deckRow, stopPropagation() {}, preventDefault() {} });
  check('点卡组行空白处会展开', chapterRows().length > 0, String(chapterRows().length));
  const expandedChapters = chapterRows().length;

  // 点勾选框：状态要变，而且不能连带收起
  const deckBox = findToggles(deckRow)[0];
  check('卡组行里有勾选框', Boolean(deckBox));
  check('勾选框是自绘按钮（不是原生 input）', deckBox && deckBox.tagName === 'BUTTON',
    deckBox && deckBox.tagName);
  clickCheckbox(deckBox);
  const afterCheck = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings());
  check('点勾选框真的勾上了（138 张）', afterCheck.selectedCards === 138, String(afterCheck.selectedCards));
  check('点勾选框不会连带收起/展开', chapterRows().length === expandedChapters,
    chapterRows().length + ' vs ' + expandedChapters);
  const deckBox2 = findToggles(deckRows()[0])[0];
  check('重渲染后勾选框显示为已勾上',
    deckBox2 && deckBox2.dataset.state === 'all' && deckBox2.getAttribute('aria-checked') === 'true',
    deckBox2 && (deckBox2.dataset.state + '/' + deckBox2.getAttribute('aria-checked')));

  // 取消勾选
  clickCheckbox(deckBox2);
  const afterUncheck = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings());
  check('再点一次取消勾选', afterUncheck.selectedCards === 0, String(afterUncheck.selectedCards));

  // 回目级勾选
  const chapterBox = findToggles(chapterRows()[0])[0];
  clickCheckbox(chapterBox);
  const afterChapter = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings());
  check('点回目勾选框勾上该回目', afterChapter.selectedLeaves === 1 && afterChapter.selectedCards > 0,
    afterChapter.selectedLeaves + '/' + afterChapter.selectedCards);
  // 只勾了一部分时，父级（分类 / 卡组）应显示为三态 partial
  const deckBoxPartial = findToggles(deckRows()[0])[0];
  check('部分勾选时卡组框显示三态 partial',
    deckBoxPartial && deckBoxPartial.dataset.state === 'partial'
      && deckBoxPartial.getAttribute('aria-checked') === 'mixed',
    deckBoxPartial && (deckBoxPartial.dataset.state + '/' + deckBoxPartial.getAttribute('aria-checked')));
  // 三态框再点一下 = 全选
  clickCheckbox(deckBoxPartial);
  const afterPartialClick = env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings());
  check('三态框点一下变全选（138 张）', afterPartialClick.selectedCards === 138,
    String(afterPartialClick.selectedCards));
  // 再点一下 = 全不选，回到干净状态
  clickCheckbox(findToggles(deckRows()[0])[0]);
  check('全选框再点一下变全不选',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedCards === 0);
  // 收起来再展开，勾选状态要留着：先勾上一个回目，再收起 / 展开
  clickCheckbox(findToggles(chapterRows()[0])[0]);
  check('重新勾上一个回目',
    env.sandbox.scSummarizeSelection(env.sandbox.scGetSettings()).selectedLeaves === 1);
  const deckRow2 = deckRows()[0];
  deckRow2.dispatch('click', { type: 'click', target: deckRow2, stopPropagation() {}, preventDefault() {} });
  check('再点卡组行会收起', chapterRows().length === 0, String(chapterRows().length));
  const deckRow3 = deckRows()[0];
  deckRow3.dispatch('click', { type: 'click', target: deckRow3, stopPropagation() {}, preventDefault() {} });
  const chapterBox2 = findToggles(chapterRows()[0])[0];
  check('收起再展开后勾选状态还在',
    chapterBox2 && chapterBox2.dataset.state === 'all', chapterBox2 && chapterBox2.dataset.state);
  // 收尾：清空勾选，免得影响后面的用例
  clickCheckbox(findToggles(deckRows()[0])[0]);
  clickCheckbox(findToggles(deckRows()[0])[0]);

  // ---------- 8. 加载卡牌 ----------
  section('加载卡牌');
  check('「加载卡牌」按钮存在', Boolean(env.document.getElementById('sc-load-cards')));
  check('「移除加载」按钮存在', Boolean(env.document.getElementById('sc-clear-cards')));
  check('卡库状态行显示张数', env.document.getElementById('sc-card-status').textContent.includes('138'),
    env.document.getElementById('sc-card-status').textContent);

  // 解析一个卡牌文件夹结构（模拟 webkitRelativePath）
  const fakeFile = (name, relativePath, text) => ({
    name, webkitRelativePath: relativePath, size: text.length, text: async () => text,
  });
  const newCardText = [
    '# X1-01 试作卡',
    '',
    '**类型**：测试 / 加载',
    '**分类**：现实类',
    '',
    '## 卡面',
    '',
    '这是从磁盘加载进来的试作卡卡面。',
    '',
    '## 注意事项',
    '',
    '**合理化**：测试用。',
    '',
    '## 设计底稿',
    '',
    '不该出现在注入里。',
  ].join('\n');
  const files = [
    fakeFile('X1-01-试作卡.md', '新卡组/现实类/第一回/X1-01-试作卡.md', newCardText),
    fakeFile('说明.txt', '新卡组/说明.txt', '不是卡牌'),
  ];
  const parsedFiles = env.sandbox.scFilterCardFiles(files);
  check('过滤只留 .md', parsedFiles.usable.length === 1 && parsedFiles.skippedCount === 1,
    parsedFiles.usable.length + '/' + parsedFiles.skippedCount);
  const parsed = await env.sandbox.scParseCardFiles(parsedFiles.usable);
  check('解析出 1 张卡', parsed.cards.length === 1, String(parsed.cards.length));
  const loaded = parsed.cards[0];
  check('层级从路径推断：新卡组/现实类/第一回',
    loaded.deck === '新卡组' && loaded.category === '现实类' && loaded.chapter === '第一回',
    [loaded.deck, loaded.category, loaded.chapter].join('/'));
  check('卡面解析正确', loaded.face.includes('试作卡卡面'));
  check('设计底稿不进卡面', !loaded.face.includes('设计底稿') && !loaded.notes.includes('设计底稿'));

  // 入库
  const addResult = env.sandbox.scAddCustomCards(parsed.cards);
  check('入库新增 1 张', addResult.added === 1 && addResult.total === 1, JSON.stringify(addResult));
  check('合并后卡库 = 139 张', env.sandbox.scGetLibrary().length === 139,
    String(env.sandbox.scGetLibrary().length));
  check('新卡组出现在范围树里',
    env.sandbox.scBuildScopeTree().some((deck) => deck.name === '新卡组'));
  check('新卡能被抽到', env.sandbox.scGetLibrary().some((card) => card.id === 'X1-01-试作卡'));

  // 覆盖同 id：自己改卡面后即时生效
  const overwriteText = newCardText.replace('试作卡卡面', '改过的卡面');
  const overwrite = await env.sandbox.scParseCardFiles([
    fakeFile('X1-01-试作卡.md', '新卡组/现实类/第一回/X1-01-试作卡.md', overwriteText),
  ]);
  const overwriteResult = env.sandbox.scAddCustomCards(overwrite.cards);
  check('同 id 覆盖而不是新增', overwriteResult.added === 0 && overwriteResult.replaced === 1,
    JSON.stringify(overwriteResult));
  check('覆盖后卡面已更新',
    env.sandbox.scGetLibrary().find((card) => card.id === 'X1-01-试作卡').face.includes('改过的卡面'));
  check('覆盖后总数仍是 139', env.sandbox.scGetLibrary().length === 139,
    String(env.sandbox.scGetLibrary().length));

  // 加载的卡能正常参与抽卡与注入
  const loadSettings = env.sandbox.scGetSettings();
  loadSettings.selectedLeaves = {};
  env.sandbox.scSetLeafSelected(loadSettings, '新卡组', '现实类', '第一回', true);
  const loadDraw = env.sandbox.scDrawCard(loadSettings, 'load-chat');
  check('能在新卡组范围里抽到加载的卡', loadDraw.card && loadDraw.card.id === 'X1-01-试作卡',
    loadDraw.card && loadDraw.card.id);
  const loadInject = env.sandbox.scBuildInjectionText(loadDraw.card);
  check('加载的卡也能拼注入块', loadInject.includes('X1-01-试作卡') && loadInject.includes('改过的卡面'));
  loadSettings.selectedLeaves = {};

  // 清空
  const clearedCustom = env.sandbox.scClearCustomCards();
  check('移除加载的卡牌返回张数', clearedCustom === 1, String(clearedCustom));
  check('移除后回到 138 张', env.sandbox.scGetLibrary().length === 138,
    String(env.sandbox.scGetLibrary().length));
  check('移除后新卡组从范围树消失',
    !env.sandbox.scBuildScopeTree().some((deck) => deck.name === '新卡组'));

  // ---------- 9. 勾选框实现契约 ----------
  section('勾选框：不依赖原生勾选框行为');
  env.sandbox.scRenderScopeTree();
  const firstToggle = findToggles(deckRows()[0])[0];
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
  // 视口 1280x800、按钮 46px、贴边留白 8px → 可放置范围 x∈[8,1226]、y∈[8,746]。
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
  check('默认位置在视口内且偏右下', defLeft > 0 && defTop > 0 && defLeft <= 1226 && defTop <= 746,
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

  // 拖出视口要被夹回来：右下角贴 1226/746，左上角贴 8/8
  dragBall(200, 200, 5000, 5000);
  check('拖出右下角会被夹在视口内', ballPos()[0] === 1226 && ballPos()[1] === 746, ballPos().join(','));
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
  const resized = env.sandbox.scApplyFloatPosition(1226, 746);
  check('视口变小后位置被夹进新视口', resized.x === 346 && resized.y === 246,
    resized.x + ',' + resized.y);
  env.sandbox.innerWidth = 1280;
  env.sandbox.innerHeight = 800;

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

  // 勾一个回目：写入必须落在宿主共享的 extensionSettings 上，
  // 否则下次渲染读到的是空对象，界面看起来「点了没反应」。
  const tauriSettings = tauri.sandbox.scGetSettings();
  tauri.sandbox.scSetLeafSelected(tauriSettings, '红楼梦', '奇幻类', '第一回', true);
  tauri.sandbox.scSaveSettings();
  check('设置写进了宿主共享的 extensionSettings',
    Boolean(tauriHost.extensionSettings.storyCards));
  check('重新读取设置仍能拿到同一份勾选',
    tauri.sandbox.scIsLeafSelected(tauri.sandbox.scGetSettings(), '红楼梦', '奇幻类', '第一回') === true);

  // 走真实渲染 + 点击路径：必须重渲染成新状态。
  tauri.sandbox.scOpenPanel();
  const tauriTree = tauri.document.getElementById('sc-scope-tree');
  const tauriDeckRow = tauriTree.children[0];
  const tauriBox = findToggles(tauriDeckRow)[0];
  check('驼峰设置下勾选框渲染为 partial（只勾了一回）',
    tauriBox && tauriBox.dataset.state === 'partial', tauriBox && tauriBox.dataset.state);
  clickCheckbox(tauriBox);
  const tauriDeckBoxAfter = findToggles(tauriTree.children[0])[0];
  check('点一下后卡组框变成全选', tauriDeckBoxAfter && tauriDeckBoxAfter.dataset.state === 'all',
    tauriDeckBoxAfter && tauriDeckBoxAfter.dataset.state);
  check('点一下后设置里 27 个回目全勾上',
    Object.values((tauriHost.extensionSettings.storyCards.selectedLeaves['红楼梦'] || {})).reduce(
      (sum, chapters) => sum + Object.keys(chapters).length, 0) === 27);

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
