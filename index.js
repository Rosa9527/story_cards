// ===== 剧情抽卡（Story Cards）index.js — 构建产物，勿手改 =====
// 构建时间: 2026-10-20 00:44:02 · 文件数: 11 · 指纹: af07b4c2

// ===== js/constants.js =====
// ===== 剧情抽卡（Story Cards）全局常量 =====
// 命名前缀统一 sc / SC_ / storyCards，避免与其他扩展的全局作用域撞名
// （js/ 下所有文件共享全局作用域）。
const SC_MODULE_NAME = 'StoryCards';
const SC_MODULE_DISPLAY_NAME = '剧情抽卡';
const SC_MODULE_VERSION = '1.0.0';

// ---------- DOM ID / class ----------
const SC_MENU_ITEM_ID = 'sc-menu-item';
const SC_MENU_API_ID = 'sc-menu-api';
const SC_FLOATING_BUTTON_ID = 'sc-floating-button';
const SC_PANEL_ID = 'sc-panel';
const SC_SCOPE_TREE_ID = 'sc-scope-tree';
const SC_DRAW_BUTTON_ID = 'sc-draw-button';
const SC_SUMMARY_ID = 'sc-scope-summary';
const SC_AVOID_REPEAT_ID = 'sc-avoid-repeat';
const SC_LOAD_CARDS_BUTTON_ID = 'sc-load-cards';
const SC_CLEAR_CARDS_BUTTON_ID = 'sc-clear-cards';
const SC_CARD_STATUS_ID = 'sc-card-status';
const SC_FILE_INPUT_ID = 'sc-file-input';
const SC_RESULT_ID = 'sc-result';
const SC_MENU_ICON_CLASS = 'fa-solid fa-clone';
const SC_DRAW_ICON_CLASS = 'fa-solid fa-dice';

// ---------- 设置存储 ----------
// 存在宿主的 extension_settings 下（随酒馆设置持久化）。
const SC_SETTINGS_NAMESPACE = 'storyCards';
// 宿主读不到设置容器时的兜底存储，挂 globalThis（刷新即失效）。
// 不能挂 context：TauriTavern 的 getContext() 每次返回新对象，挂上去等于没存。
const SC_FALLBACK_SETTINGS_KEY = '__sc_fallback_settings__';

const SC_DEFAULT_SETTINGS = Object.freeze({
  // 已勾选的抽卡范围：{ [卡组]: { [分类]: { [回目]: true } } }
  // 只记录被勾上的叶子（回目）；卡组 / 分类的勾选状态由叶子推导，避免三处状态打架。
  selectedLeaves: {},
  // 悬浮按钮开关（手机端面板入口）。
  showFloatingButton: true,
  // 「抽过不重复」开关。
  avoidRepeat: true,
  // 悬浮按钮位置（视口坐标，左上角）。null = 用默认位置（右下角）。
  floatX: null,
  floatY: null,
});

// 悬浮按钮拖动：尺寸与贴边留白（与 style.css 里的 .sc-floating-button 保持一致）。
const SC_FLOAT_SIZE = 46;
const SC_FLOAT_MARGIN = 8;
// 判定「这是一次拖动」而不是「点击」的位移阈值（像素）。
const SC_FLOAT_DRAG_THRESHOLD = 5;

// 按聊天记录已抽卡 ID 的存储位置（chatMetadata），每个聊天各记一份。
const SC_CHAT_DRAWN_META_KEY = 'story_cards_drawn';

// ---------- 注入 ----------
// 注入槽位 key：与其它扩展不冲突即可，宿主按 key 覆盖同一槽位。
const SC_INJECT_KEY = 'story-cards-draw';
// extension_prompt_types: NONE=-1, IN_PROMPT=0, IN_CHAT=1, BEFORE_PROMPT=2
// extension_prompt_roles: SYSTEM=0, USER=1, ASSISTANT=2
// TauriTavern 2.x 不提供这两个枚举对象，按已知数值常量兜底（与 Kaleidoscope 同款）。
const SC_INJECT_TYPE_IN_CHAT = 1;
const SC_INJECT_ROLE_SYSTEM = 0;
// 注入深度：0 = 贴在最后一条消息（刚发出去的抽卡触发短语）正下方。
const SC_INJECT_DEPTH = 0;

// ---------- 发送 ----------
// 点「剧情抽卡」后，输入框里填的触发短语。刻意极短：聊天记录干净、上下文零负担，
// 真正的卡面内容走系统导演注注入。
const SC_TRIGGER_TEXT = '【剧情抽卡】';
// 发送确认轮询：等宿主把消息提交进 chat。
const SC_SEND_CONFIRM_TIMEOUT_MS = 6000;
const SC_SEND_CONFIRM_INTERVAL_MS = 120;
// 填完输入框到点发送之间的等待：给宿主自己的输入监听（自动补全、字数统计）留一拍。
const SC_SEND_SETTLE_MS = 60;

// ---------- 加载卡牌 ----------
// 玩家在面板里临时加载的卡牌存在设置里（随酒馆设置持久化），与构建期编进
// index.js 的卡库合并；同 id 时以玩家加载的为准。
const SC_CUSTOM_CARDS_LIMIT = 5000;
// 单个卡牌文件大小上限（1 MB）：正常卡面 1~3 KB，超过这个量级基本是选错了文件。
const SC_CARD_FILE_MAX_BYTES = 1024 * 1024;
// 一次最多处理多少个文件（防止误选整个磁盘目录把页面卡死）。
const SC_CARD_FILE_MAX_COUNT = 3000;

// ---------- 菜单 / 启动 ----------
const SC_MENU_RETRY_COUNT = 40;
const SC_BOOTSTRAP_RETRY_COUNT = 60;
const SC_BOOTSTRAP_RETRY_INTERVAL_MS = 500;

// ---------- 全局标记 key（防止重复挂载 / 重复 bootstrap） ----------
const SC_BOOTSTRAP_RUNTIME_KEY = '__story_cards_bootstrapped__';
const SC_MENU_RECOVERY_OBSERVER_KEY = '__story_cards_menu_observer__';
const SC_HOST_EVENT_WATCHDOG_KEY = '__story_cards_event_watchdog__';
const SC_HOST_EVENT_WATCHDOG_INTERVAL_MS = 2000;
const SC_APP_READY_HANDLER_KEY = '__story_cards_app_ready__';
const SC_GEN_ENDED_HANDLER_KEY = '__story_cards_gen_ended__';
const SC_GEN_STOPPED_HANDLER_KEY = '__story_cards_gen_stopped__';
const SC_GEN_STARTED_HANDLER_KEY = '__story_cards_gen_started__';
const SC_CHAT_CHANGED_HANDLER_KEY = '__story_cards_chat_changed__';
// 悬浮按钮的窗口 resize 监听（挂一次就够，避免重复 bootstrap 时叠加）。
const SC_FLOAT_RESIZE_HOOK_KEY = '__story_cards_float_resize__';

// 本轮抽卡记录（内存态，供重新生成时重放注入）。
const SC_LAST_DRAW_KEY = '__story_cards_last_draw__';


// ===== js/utils.js =====
// ===== 剧情抽卡（Story Cards）工具层：设置读写 / 提示 / DOM 小助手 =====

// 宿主保存扩展设置的那个容器。标准 SillyTavern 叫 extension_settings，
// TauriTavern 的 getContext() 只给 extensionSettings（驼峰）。
const SC_SETTINGS_STORE_KEYS = ['extension_settings', 'extensionSettings'];

// 逐个候选键找可写的设置容器；宿主某些字段是 getter，读它可能抛错，所以都包住。
function scFindSettingsStore(ctx) {
  for (const key of SC_SETTINGS_STORE_KEYS) {
    try {
      const store = ctx?.[key];
      if (store && typeof store === 'object') return store;
    } catch (error) {
      /* 读不到就试下一个 */
    }
  }
  try {
    if (globalThis.extension_settings && typeof globalThis.extension_settings === 'object') {
      return globalThis.extension_settings;
    }
  } catch (error) {
    /* 忽略 */
  }
  return null;
}

// 兜底容器必须挂在稳定的全局上：TauriTavern 的 getContext() 每次返回全新对象，
// 缓存在 context 上等于每次都是空的（勾选写了立刻丢，表现为「点了没反应」）。
function scGetFallbackSettingsStore() {
  if (!globalThis[SC_FALLBACK_SETTINGS_KEY] || typeof globalThis[SC_FALLBACK_SETTINGS_KEY] !== 'object') {
    try {
      Object.defineProperty(globalThis, SC_FALLBACK_SETTINGS_KEY, {
        value: {}, writable: true, configurable: true, enumerable: false,
      });
    } catch (error) {
      globalThis[SC_FALLBACK_SETTINGS_KEY] = {};
    }
  }
  return globalThis[SC_FALLBACK_SETTINGS_KEY];
}

// 设置读取：宿主设置容器不可用时回退到全局兜底，保证任何宿主上都不会崩，
// 也保证同一页面内多次读写拿到的是同一份状态。
function scGetSettings() {
  const ctx = scGetContextSafe();
  const store = scFindSettingsStore(ctx) || scGetFallbackSettingsStore();
  if (!store[SC_SETTINGS_NAMESPACE] || typeof store[SC_SETTINGS_NAMESPACE] !== 'object') {
    store[SC_SETTINGS_NAMESPACE] = { ...SC_DEFAULT_SETTINGS, selectedLeaves: {} };
  }
  const settings = store[SC_SETTINGS_NAMESPACE];
  // 自动补齐缺省字段（老版本设置升级）。
  if (!settings.selectedLeaves || typeof settings.selectedLeaves !== 'object') settings.selectedLeaves = {};
  if (typeof settings.showFloatingButton !== 'boolean') settings.showFloatingButton = SC_DEFAULT_SETTINGS.showFloatingButton;
  if (typeof settings.avoidRepeat !== 'boolean') settings.avoidRepeat = SC_DEFAULT_SETTINGS.avoidRepeat;
  if (!Number.isFinite(settings.floatX)) settings.floatX = null;
  if (!Number.isFinite(settings.floatY)) settings.floatY = null;
  return settings;
}

// 设置落盘：优先宿主提供的防抖保存，其次立即保存，都没有就只留内存态。
function scSaveSettings() {
  const ctx = scGetContextSafe();
  try {
    if (ctx && typeof ctx.saveSettingsDebounced === 'function') {
      ctx.saveSettingsDebounced();
      return;
    }
    if (ctx && typeof ctx.saveSettings === 'function') {
      ctx.saveSettings();
    }
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 保存设置失败`, error);
  }
}

// 当前聊天 ID：用作「抽过不重复」记录的分区键。
function scGetChatId() {
  const ctx = scGetContextSafe();
  try {
    if (ctx && typeof ctx.getCurrentChatId === 'function') {
      const id = ctx.getCurrentChatId();
      if (id !== undefined && id !== null && String(id).trim() !== '') return String(id);
    }
    if (ctx && ctx.chatId !== undefined && ctx.chatId !== null) return String(ctx.chatId);
  } catch (error) {
    /* 忽略，返回空 */
  }
  return '';
}

// chatMetadata 读写：宿主不提供时静默降级为空对象，绝不影响抽卡主流程。
function scGetChatMetadata() {
  const ctx = scGetContextSafe();
  try {
    if (ctx && ctx.chatMetadata && typeof ctx.chatMetadata === 'object') return ctx.chatMetadata;
  } catch (error) {
    /* 忽略 */
  }
  return null;
}

function scSaveChatMetadata() {
  const ctx = scGetContextSafe();
  try {
    if (ctx && typeof ctx.saveMetadata === 'function') {
      ctx.saveMetadata();
      return;
    }
    if (ctx && typeof ctx.saveChatConditional === 'function') {
      ctx.saveChatConditional();
    }
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 保存聊天元数据失败`, error);
  }
}

// ---------- 提示 ----------
// 统一走宿主的 toastr；没有时退回 console，绝不让提示失败打断流程。
function scToast(level, message) {
  const text = '[' + SC_MODULE_DISPLAY_NAME + '] ' + String(message || '');
  try {
    const toastr = globalThis.toastr;
    if (toastr && typeof toastr[level] === 'function') {
      toastr[level](message, '[' + SC_MODULE_DISPLAY_NAME + ']');
      return;
    }
  } catch (error) {
    /* 落到 console */
  }
  const logger = level === 'error' ? console.error : (level === 'warning' || level === 'warn' ? console.warn : console.info);
  logger(text);
}

function scLogInfo(message, detail) {
  if (detail === undefined) console.info(`[${SC_MODULE_DISPLAY_NAME}] ${message}`);
  else console.info(`[${SC_MODULE_DISPLAY_NAME}] ${message}`, detail);
}

// ---------- DOM 小助手 ----------
function scEl(id) {
  try {
    return document.getElementById(id);
  } catch (error) {
    return null;
  }
}

function scCreate(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

// 输入框：宿主固定用 #send_textarea。
function scGetTextarea() {
  return scEl('send_textarea');
}

function scIsGenerating() {
  const ctx = scGetContextSafe();
  try {
    if (ctx && typeof ctx.isGenerating === 'function') return Boolean(ctx.isGenerating());
  } catch (error) {
    /* 忽略 */
  }
  try {
    if (globalThis.is_send_press === true) return true;
  } catch (error) {
    /* 忽略 */
  }
  // 兜底：发送按钮被宿主切成停止按钮时，说明正在生成。
  const stop = scEl('mes_stop');
  if (stop && stop.offsetParent !== null) return true;
  return false;
}

function scSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

// 文本归一化：去掉首尾空白，折叠多余空行（注入块里不留大片空白）。
function scNormalizeText(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


// ===== js/host.js =====
// ===== 剧情抽卡（Story Cards）宿主适配层：SillyTavern / TauriTavern =====
// 与 Kaleidoscope 同构：宿主上下文只走 Luker.getContext / SillyTavern.getContext，
// 事件名统一经 ctx.event_types 解析（TauriTavern 的 eventSource 需要枚举值，
// 标准 SillyTavern 的值则是 snake_case），挂载以全局 key 去重。

function scGetContextSafe() {
  try {
    return globalThis.Luker?.getContext?.() || globalThis.SillyTavern?.getContext?.() || null;
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 无法读取宿主上下文`, error);
    return null;
  }
}

// 宿主事件名 → ctx.event_types 键 的映射。
const SC_HOST_EVENT_TYPE_KEYS = Object.freeze({
  appReady: 'APP_READY',
  chatChanged: 'CHAT_CHANGED',
  groupSelected: 'GROUP_SELECTED',
  messageSent: 'MESSAGE_SENT',
  messageReceived: 'MESSAGE_RECEIVED',
  generationStarted: 'GENERATION_STARTED',
  generationEnded: 'GENERATION_ENDED',
  generationStopped: 'GENERATION_STOPPED',
  messageDeleted: 'MESSAGE_DELETED',
});

function scResolveHostEventType(ctx, eventName) {
  const typeKey = SC_HOST_EVENT_TYPE_KEYS[eventName];
  if (typeKey && ctx?.event_types && ctx.event_types[typeKey] !== undefined && ctx.event_types[typeKey] !== null) {
    return ctx.event_types[typeKey];
  }
  return eventName;
}

// 统一挂载宿主事件订阅：以全局 key 去重，重挂时先移除旧监听，避免重复触发。
function scOnHostEvent(ctx, eventName, handler, key) {
  const eventSource = ctx?.eventSource;
  if (!eventSource || typeof eventSource.on !== 'function' || typeof handler !== 'function') return;
  const eventType = scResolveHostEventType(ctx, eventName);
  if (globalThis[key] && typeof eventSource.removeListener === 'function') {
    eventSource.removeListener(eventType, globalThis[key]);
    globalThis[key] = null;
  }
  const wrapped = (...args) => {
    try {
      const result = handler(...args);
      if (result && typeof result.catch === 'function') {
        result.catch((error) => console.error(`[${SC_MODULE_DISPLAY_NAME}] 宿主事件 ${eventName} 处理失败`, error));
      }
    } catch (error) {
      console.error(`[${SC_MODULE_DISPLAY_NAME}] 宿主事件 ${eventName} 处理失败`, error);
    }
  };
  globalThis[key] = wrapped;
  eventSource.on(eventType, wrapped);
}

// 宿主注入 API 适配：标准 SillyTavern 的 getContext() 会提供 extension_prompt_types /
// extension_prompt_roles；TauriTavern 2.x 不提供这两个对象，因此只把 setExtensionPrompt
// 作为必需项，枚举值按已知数值常量兜底（见 constants.js）。
function scGetExtensionPromptApi(ctx) {
  const context = ctx || scGetContextSafe();
  if (!context) return null;
  const setExtensionPrompt = typeof context.setExtensionPrompt === 'function'
    ? context.setExtensionPrompt
    : (typeof globalThis.setExtensionPrompt === 'function' ? globalThis.setExtensionPrompt : null);
  if (typeof setExtensionPrompt !== 'function') return null;
  const types = context.extension_prompt_types || globalThis.extension_prompt_types || null;
  const roles = context.extension_prompt_roles || globalThis.extension_prompt_roles || null;
  const inChat = (types && Number.isFinite(types.IN_CHAT)) ? types.IN_CHAT : SC_INJECT_TYPE_IN_CHAT;
  const systemRole = (roles && Number.isFinite(roles.SYSTEM)) ? roles.SYSTEM : SC_INJECT_ROLE_SYSTEM;
  return { setExtensionPrompt, inChat, systemRole };
}

// 当前聊天条数：用于「发送是否真的落地」的确认。
function scGetChatLength() {
  const ctx = scGetContextSafe();
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;
  return chat ? chat.length : -1;
}


// ===== tools/card-parse.js =====
// ===== 剧情抽卡（Story Cards）卡牌解析器（构建期与运行期共用）=====
// 卡牌 Markdown 的结构（cards/<卡组>/<分类>/<回目>/<卡号>-<卡名>.md）：
//
//   # C1-03 半盏灯
//
//   **类型**：失去 / 疏忽
//   **分类**：现实类
//
//   ## 卡面
//
//   <卡面正文……>
//
//   ## 注意事项
//
//   **合理化**：……
//   **甲是谁**：……
//
//   ## 设计底稿        ← 可选，不参与抽卡内容
//
// 解析约定：
// - 卡面 = 「## 卡面」段正文，是注入给主模型的场景内容；
// - 注意事项 = 「## 注意事项」段整体，是给主模型的合理化/替换说明，必须一起带上，
//   否则卡面里那些「甲」「那两个人」会在具体世界观里落不了地；
// - 设计底稿等其它段落一律丢弃（那是给作者看的，不是给主模型的）；
// - 段落缺失时降级为空串，绝不因为一张卡格式不标准就让整次构建失败。
//
// 本文件是普通脚本（非 ES module）：浏览器里由 index.js 直接拼接使用，Node 里由
// build.js 通过 require 使用。两种环境共用同一份解析逻辑，保证「构建期写进数据的
// 字段」与「运行期读数据的字段」永远同构。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.SC_CARD_PARSE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CARD_FACE_HEADING = '卡面';
  const CARD_NOTES_HEADING = '注意事项';
  const CARD_DRAFT_HEADING = '设计底稿';

  // 卡片 ID：取文件名主干（如 C1-03-半盏灯）。卡面标题里的卡号写法不统一
  // （C1-03 / F16-01 混用），文件名主干才是唯一稳定的标识。
  function parseCardId(stem) {
    return String(stem || '').trim();
  }

  // 卡面标题行（# C1-03 半盏灯）→ { number, name }。缺标题时回退文件名。
  function parseCardTitle(text, stem) {
    const match = String(text || '').match(/^#\s+(.+?)\s*$/m);
    const raw = match ? match[1].trim() : String(stem || '').trim();
    // 「C1-03 半盏灯」→ number=C1-03, name=半盏灯；没有空格时整串当名字。
    const split = raw.match(/^([A-Za-z]+\d+(?:-\d+)?)\s+(.+)$/);
    if (split) return { number: split[1], name: split[2].trim() };
    return { number: '', name: raw };
  }

  // 取「## <标题>」段落的正文，直到下一个同级或更高级标题为止。
  function extractSection(text, heading) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const target = String(heading || '').trim();
    let start = -1;
    let level = 0;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!match) continue;
      if (match[2].trim() === target) {
        start = i + 1;
        level = match[1].length;
        break;
      }
    }
    if (start === -1) return '';
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+/);
      if (match && match[1].length <= level) break;
      out.push(lines[i]);
    }
    return out.join('\n').trim();
  }

  // 「**键**：值」行 → { key, value }，非此格式返回 null。
  function parseMetaLine(line) {
    const match = String(line || '').match(/^\*\*(.+?)\*\*\s*[：:]\s*(.*)$/);
    if (!match) return null;
    return { key: match[1].trim(), value: match[2].trim() };
  }

  // 从「注意事项」段里抽「**键**：值」条目；返回 [{ key, value }]。
  // 连续多行（值里带换行）会并入上一条，保证长说明不被截断。
  function parseNoteItems(notesText) {
    const items = [];
    const lines = String(notesText || '').replace(/\r\n?/g, '\n').split('\n');
    for (const line of lines) {
      const meta = parseMetaLine(line);
      if (meta) {
        items.push(meta);
        continue;
      }
      if (!items.length) continue;
      const trimmed = line.trim();
      if (!trimmed) continue;
      // 段落里的普通行（不是「**键**：」开头）续到上一条的值里。
      items[items.length - 1].value += '\n' + trimmed;
    }
    return items;
  }

  // 解析一张卡：输入 Markdown 原文与文件名主干，输出卡库条目。
  function parseCard(text, stem) {
    const source = String(text || '');
    const title = parseCardTitle(source, stem);
    let type = '';
    let category = '';
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    for (const line of lines) {
      const meta = parseMetaLine(line);
      if (!meta) continue;
      if (meta.key === '类型' && !type) type = meta.value;
      if (meta.key === '分类' && !category) category = meta.value;
    }
    const face = extractSection(source, CARD_FACE_HEADING);
    const notes = extractSection(source, CARD_NOTES_HEADING);
    return {
      id: parseCardId(stem),
      number: title.number,
      name: title.name,
      type,
      category,
      face,
      notes,
      noteItems: parseNoteItems(notes),
      // 设计底稿刻意不保留：它只服务作者，进提示词会干扰主模型。
      hasDraft: extractSection(source, CARD_DRAFT_HEADING) !== '',
    };
  }

  return {
    parseCard,
    parseCardId,
    parseCardTitle,
    extractSection,
    parseNoteItems,
    CARD_FACE_HEADING,
    CARD_NOTES_HEADING,
    CARD_DRAFT_HEADING,
  };
});


// ===== js/cards-data.js =====
// ===== 剧情抽卡（Story Cards）卡库数据 · 构建产物，勿手改 =====
// 生成时间: 2026-10-20 00:44:02 · 卡牌数: 138
// 来源: cards/<卡组>/<分类>/<回目>/<卡号>-<卡名>.md
// 重新生成: node build.js（或 node build.js --cards）
// 卡面解析规则见 tools/card-parse.js，构建期与运行期共用同一份实现。
(function () {
  const cards = [
  {
    "id": "C1-01-要孩子的人",
    "number": "C1-01",
    "name": "要孩子的人",
    "type": "预兆",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第一回",
    "rel": "红楼梦/奇幻类/第一回/C1-01-要孩子的人.md",
    "face": "那是一个再普通不过的午后。甲抱着孩子在门口，做着些寻常的事，或者只是站着。\n\n路那头来了两个人。他们的样子有些古怪，衣裳脏得看不出颜色，走路却比谁都稳。他们本来在说话，走过甲身边时，忽然都停了。\n\n其中一人盯着甲怀里的孩子。他脸上的笑一点点垮下去，最后变成一种甲从未见过的悲恸。他放声大哭。\n\n“这孩子，”他说，“留不住，还会拖累你们。”\n\n他伸出手：“把他给我。把他给我。”",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友，或者玩家关系网里的任何一个人。最好让甲和玩家有关系——玩家越在乎甲，这张卡越重。如果玩家就是甲，把“甲”读成“你”。\n\n**玩家在哪**：玩家可以在现场，看着这件事发生；也可以不在场，事后从甲、家人、仆从、路人的口中听说。若玩家不在场，卡的重点就从“当时的反应”变成“事后怎么处理”。\n\n**那两个人是谁**：不必是算命先生，也不必是乞丐。他们可以是游方人、异乡客、疯子、传教士、先知——任何“不该知道这件事的人”。他们的共同点只有两个：看起来不该知道，却偏偏知道；他们要的不是钱，是孩子。他们对甲的称呼也随设定换：“这位”“朋友”“旅人”“客人”，或者干脆不称呼。\n\n**这是哪**：时间、地点、时代、孩子的年龄、甲的身份，都可以随设定替换。唯一不能换的是：一个普通人，抱着一个他珍爱的孩子，遇见一个说出不祥之言的人。\n\n这张卡归在奇幻类：他们真的知道一些事。若你要放进现实类故事，把他们改成“碰巧说中”或“另有所图”的人即可。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友，或者玩家关系网里的任何一个人。最好让甲和玩家有关系——玩家越在乎甲，这张卡越重。如果玩家就是甲，把“甲”读成“你”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在现场，看着这件事发生；也可以不在场，事后从甲、家人、仆从、路人的口中听说。若玩家不在场，卡的重点就从“当时的反应”变成“事后怎么处理”。"
      },
      {
        "key": "那两个人是谁",
        "value": "不必是算命先生，也不必是乞丐。他们可以是游方人、异乡客、疯子、传教士、先知——任何“不该知道这件事的人”。他们的共同点只有两个：看起来不该知道，却偏偏知道；他们要的不是钱，是孩子。他们对甲的称呼也随设定换：“这位”“朋友”“旅人”“客人”，或者干脆不称呼。"
      },
      {
        "key": "这是哪",
        "value": "时间、地点、时代、孩子的年龄、甲的身份，都可以随设定替换。唯一不能换的是：一个普通人，抱着一个他珍爱的孩子，遇见一个说出不祥之言的人。\n这张卡归在奇幻类：他们真的知道一些事。若你要放进现实类故事，把他们改成“碰巧说中”或“另有所图”的人即可。"
      }
    ]
  },
  {
    "id": "C2-04-生了个怪孩子",
    "number": "C2-04",
    "name": "生了个怪孩子",
    "type": "异象 / 出生",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第二回",
    "rel": "红楼梦/奇幻类/第二回/C2-04-生了个怪孩子.md",
    "face": "甲家里添了一个孩子。\n\n孩子出生时，身上带着一样不该有的东西——一块玉、一个印记、一层膜、一道光。接生的人先看见，脸白了。\n\n消息传出去。有人说这是祥瑞，有人说这是妖异。\n\n孩子还在哭。家里人要决定，怎么对外说。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家刚添了一个孩子。\n\n**玩家在哪**：玩家可以在场，看见那样东西；也可以不在场，事后从接生的人、家人、邻居的口中听说。如果玩家就是那个孩子，卡的重点就变成“你一出生，就被当成了一个说法”。\n\n**孩子身上带的是什么**：一块玉、一个印记、一层膜、一道光、一个预言、一个胎记、一种不该有的天赋。\n\n**说祥瑞的是谁**：长辈、祭司、医生、邻居、教会。\n\n**说妖异的是谁**：另一派长辈、政敌、教会、官府。\n\n**这是哪**：任何有“异象”和“说法”的世界。\n\n**注意**：不要写家里最后怎么处置；那是家里人的决定。卡停在“孩子出生了，说法已经传开”这一刻。若放进现实类，把“异象”改成“孩子生来有某种缺陷、天赋或病”，说法仍然一样。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家刚添了一个孩子。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，看见那样东西；也可以不在场，事后从接生的人、家人、邻居的口中听说。如果玩家就是那个孩子，卡的重点就变成“你一出生，就被当成了一个说法”。"
      },
      {
        "key": "孩子身上带的是什么",
        "value": "一块玉、一个印记、一层膜、一道光、一个预言、一个胎记、一种不该有的天赋。"
      },
      {
        "key": "说祥瑞的是谁",
        "value": "长辈、祭司、医生、邻居、教会。"
      },
      {
        "key": "说妖异的是谁",
        "value": "另一派长辈、政敌、教会、官府。"
      },
      {
        "key": "这是哪",
        "value": "任何有“异象”和“说法”的世界。"
      },
      {
        "key": "注意",
        "value": "不要写家里最后怎么处置；那是家里人的决定。卡停在“孩子出生了，说法已经传开”这一刻。若放进现实类，把“异象”改成“孩子生来有某种缺陷、天赋或病”，说法仍然一样。"
      }
    ]
  },
  {
    "id": "C3-05-摔在地上",
    "number": "C3-05",
    "name": "摔在地上",
    "type": "发作 / 异象",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第三回",
    "rel": "红楼梦/奇幻类/第三回/C3-05-摔在地上.md",
    "face": "家里新来的那个孩子，和这家原来的孩子见了面。\n\n这家原来的孩子，从小身上戴着一件东西——一块玉、一枚牌、一个护符。家里说这是他的命，谁也碰不得。全家上下，只有他有。\n\n他先问她：你有这个吗？\n\n她答：没有。\n\n他愣了愣，忽然从脖子上把那件东西扯下来，用尽力气摔在地上。\n\n“你们都没有，就我有——那我不要它了。”\n\n屋里的人一起扑过去：有人去拾，有人去抱他，有人回头去看那个刚来的孩子。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这孩子的家里人——父母、祖辈、看顾他的人。若玩家是这个家里的人，卡的重点是“东西摔在地上，你先去拾，还是先去看那个新来的孩子”。\n\n**玩家在哪**：玩家可以在场；也可以就是刚来的那个孩子，卡的重点变成“你第一天就惹出这样的事”；也可以不在场，事后从满屋子人的嘴里听说。\n\n**那件东西是什么**：一块玉、一枚牌、一个护符、一个胎记、一份只有他有的天赋、一笔只给他一个人的家产。它要满足两点：全家都当它是这孩子的命；别人都没有。\n\n**摔得坏吗**：可以摔坏，也可以摔不坏。摔不坏更麻烦——它还在，事情就没有了结。\n\n**他为什么发作**：他发现自己和别人不一样；他想要一样东西；他想用摔掉它来证明自己不在乎；或者他是在试探这一家到底谁疼他。\n\n**哄的人是谁**：长辈、母亲、看顾他的人、仆人。哄的话可以是真的，也可以是编的；编的那一套，日后会变成他自己的心结。\n\n**分类**：归奇幻类，因为这件东西本身是有灵的、和命连着的。若放进现实类，把它改成“全家都当命的一件传家宝、一份凭据、一张单子”，骨架不变。\n\n**这是哪**：任何有“命物”和“说法”的世界。\n\n**注意**：卡停在“东西摔在地上，满屋子人扑过去”这一刻。不要写长辈怎么哄、事情怎么收场。若哄话是编的，记住它是编的——它会回来。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这孩子的家里人——父母、祖辈、看顾他的人。若玩家是这个家里的人，卡的重点是“东西摔在地上，你先去拾，还是先去看那个新来的孩子”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场；也可以就是刚来的那个孩子，卡的重点变成“你第一天就惹出这样的事”；也可以不在场，事后从满屋子人的嘴里听说。"
      },
      {
        "key": "那件东西是什么",
        "value": "一块玉、一枚牌、一个护符、一个胎记、一份只有他有的天赋、一笔只给他一个人的家产。它要满足两点：全家都当它是这孩子的命；别人都没有。"
      },
      {
        "key": "摔得坏吗",
        "value": "可以摔坏，也可以摔不坏。摔不坏更麻烦——它还在，事情就没有了结。"
      },
      {
        "key": "他为什么发作",
        "value": "他发现自己和别人不一样；他想要一样东西；他想用摔掉它来证明自己不在乎；或者他是在试探这一家到底谁疼他。"
      },
      {
        "key": "哄的人是谁",
        "value": "长辈、母亲、看顾他的人、仆人。哄的话可以是真的，也可以是编的；编的那一套，日后会变成他自己的心结。"
      },
      {
        "key": "分类",
        "value": "归奇幻类，因为这件东西本身是有灵的、和命连着的。若放进现实类，把它改成“全家都当命的一件传家宝、一份凭据、一张单子”，骨架不变。"
      },
      {
        "key": "这是哪",
        "value": "任何有“命物”和“说法”的世界。"
      },
      {
        "key": "注意",
        "value": "卡停在“东西摔在地上，满屋子人扑过去”这一刻。不要写长辈怎么哄、事情怎么收场。若哄话是编的，记住它是编的——它会回来。"
      }
    ]
  },
  {
    "id": "C8-01-像是成对的两句话",
    "number": "C8-01",
    "name": "像是成对的两句话",
    "type": "信物 / 说法",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第八回",
    "rel": "红楼梦/奇幻类/第八回/C8-01-像是成对的两句话.md",
    "face": "一个人病了好些天，一直在家养着，另一个人一直没来。\n\n这天他来了。两个人说了一回话，她忽然要看一看他身上那件东西——家里说那是他的命，成日带着，谁也不给细看。\n\n她把自己的那件托在掌上，念了上面的一行字；又把他的拿过去，念了那上面的一行。两行字，像是对着写出来的。\n\n旁边一个下人脱口说了一句：这两句，倒像是一对儿。\n\n她立刻把话岔开，打发那个下人出去倒茶。可这句话已经出来了。\n\n两件东西被放回原处。屋里只剩下那句话，和一个被赶出去的下人。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是带着旧物的那个人，也可以是凑过去看的人，也可以是那个脱口而出的下人。谁站在这场里，谁就要接住这句话。\n\n**玩家在哪**：玩家可以就是取出旧物的人——你要不要把她那件要过来看；可以是旁边看着的人；也可以是那个下人，一句实话出口，挨骂的、被打发走的都是你；也可以不在场，这句话日后由别人转述给你听。\n\n**两行字是什么**：两句吉祥话、两句祝词、两句箴言，各人对各人的。要紧的不是字，是：两句话长得像一对，而这两个人自己都从没把它当过一回事。\n\n**为什么是重的**：说出这句话之前，这只是两个亲戚家的孩子；说出来之后，这两件旧物、这两个人，都被别人放进了同一个说法里。往后他们做什么，旁人都要拿“一对”来量。\n\n**下人为什么说**：她只是说了她看见的。她挨的那顿骂、被支出去的那趟差事，也是这张卡的一部分。\n\n**旧物是什么**：一块玉、一枚牌、一个护符、一张纸、一串珠子、一个胎记。它可以真的是命物，也可以只是家里传下来的一句说法。\n\n**分类**：归奇幻类，因为“这两句话是一对”本身是一种谶——它会被当成预兆，迟早有人拿它安排这两个人的将来。若放进现实类，把它改成“两家人各有一句老话，正好配得上”，骨架不变。\n\n**这是哪**：任何有“信物”和“说法”的世界——家族、门派、婚约、结拜、公司里的两个继承人。\n\n**注意**：卡停在“这句话已经出来了”这一刻。不要写谁动了心，也不要写有没有人认这个说法。若这张卡演下去，记下这句话是谁说的、谁听见了——它会回来找你。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是带着旧物的那个人，也可以是凑过去看的人，也可以是那个脱口而出的下人。谁站在这场里，谁就要接住这句话。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是取出旧物的人——你要不要把她那件要过来看；可以是旁边看着的人；也可以是那个下人，一句实话出口，挨骂的、被打发走的都是你；也可以不在场，这句话日后由别人转述给你听。"
      },
      {
        "key": "两行字是什么",
        "value": "两句吉祥话、两句祝词、两句箴言，各人对各人的。要紧的不是字，是：两句话长得像一对，而这两个人自己都从没把它当过一回事。"
      },
      {
        "key": "为什么是重的",
        "value": "说出这句话之前，这只是两个亲戚家的孩子；说出来之后，这两件旧物、这两个人，都被别人放进了同一个说法里。往后他们做什么，旁人都要拿“一对”来量。"
      },
      {
        "key": "下人为什么说",
        "value": "她只是说了她看见的。她挨的那顿骂、被支出去的那趟差事，也是这张卡的一部分。"
      },
      {
        "key": "旧物是什么",
        "value": "一块玉、一枚牌、一个护符、一张纸、一串珠子、一个胎记。它可以真的是命物，也可以只是家里传下来的一句说法。"
      },
      {
        "key": "分类",
        "value": "归奇幻类，因为“这两句话是一对”本身是一种谶——它会被当成预兆，迟早有人拿它安排这两个人的将来。若放进现实类，把它改成“两家人各有一句老话，正好配得上”，骨架不变。"
      },
      {
        "key": "这是哪",
        "value": "任何有“信物”和“说法”的世界——家族、门派、婚约、结拜、公司里的两个继承人。"
      },
      {
        "key": "注意",
        "value": "卡停在“这句话已经出来了”这一刻。不要写谁动了心，也不要写有没有人认这个说法。若这张卡演下去，记下这句话是谁说的、谁听见了——它会回来找你。"
      }
    ]
  },
  {
    "id": "C12-05-只照背面",
    "number": "C12-05",
    "name": "只照背面",
    "type": "赠物 / 一个条件",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第十二回",
    "rel": "红楼梦/奇幻类/第十二回/C12-05-只照背面.md",
    "face": "药吃了不知多少服，人还是躺着。这天门口来了个过路的，讨一口饭，说专治这种治不好的病。\n\n屋里人正要打发他走，床上那个听见了，直着嗓子喊：快请进来。\n\n那人进来，看了一眼病人，说：你这病不是药吃得好的。我有一件东西给你，你天天看它，命就能保住。三天后我来取。\n\n他从随身的袋子里取出一件小东西，递给病人。这东西正反两面都能照人。他交代了一句：只能看背面，正面千万不要看。别的他没说。\n\n说完他就走了。\n\n病人把那件东西翻过来，先照了背面：里头立着一副骷髅。他骂了一声，把东西扣在手边。\n\n屋里的人端了饭进来，看他眼睛还睁着，就没说什么。那件东西就搁在枕头边上。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲就是床上那个人——可以是玩家，也可以是玩家的家人、朋友、下辈。甲不一定是个坏人，只要是**心里有一件放不下的事**的人。\n\n**玩家在哪**：玩家可以就是甲，东西在你手里，翻哪一面是你自己动手的事；可以是在旁边伺候的人，你看见了那件东西，要不要偷偷拿走、要不要告诉长辈；可以就是那个过路的人，你要不要多解释一句、三天后要不要真的回来；也可以不在场，事后听人说起“他手里那件东西邪门”。\n\n**来的人是谁**：过路的、化缘的、走江湖的、上门推销的、说能治的人。他可以真有本事，也可以是骗子——两种都成立，但那件东西得真的照出东西来，否则这张卡改归现实类（见下）。\n\n**那件东西是什么**：一面能照人的旧物、一块牌子、一张画、一封信、一个盒子、一段影像、一粒药。形状随便，要紧的是两条：**它有正反两面**，**只有一面是能救人的**。\n\n**那条规矩为什么要紧**：说的人越少解释，这张卡越冷。他不说正面有什么，只说不许看——规矩不解释，才有人想试。\n\n**他为什么偏要看**：因为背面里那样东西是他最不愿意认的：老、病、死、空、他自己。正面里是他想要的。卡不写他会不会看正面。\n\n**难受在哪里**：屋里的人都知道该看哪一面，谁也不敢替他扣住那件东西。这张卡的难受不在“他看了假的那一面”，在**“真的那一面就在反面，谁都看得见，只有他不肯看”**。\n\n**分类**：归奇幻类。那件东西真的照出东西、真的带着一条不能破的规矩、三天后真的有人来取；因果不全在人身上。若把这一层去掉——它只是一面普通镜子，病人自己在病里看花了眼——骨架不动，改归现实类。\n\n**这是哪**：任何有“偏方”和“一条不能破的规矩”的世界——病房、道观、门派、实验室、合同、许愿。\n\n**注意**：卡停在“东西搁在枕头边上，正面还没照”这一刻。不要写他照了哪一面，也不要写三天后那个人来没来。要留的只有一件：**救命的法子在他手里，他还没翻过来。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲就是床上那个人——可以是玩家，也可以是玩家的家人、朋友、下辈。甲不一定是个坏人，只要是**心里有一件放不下的事**的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，东西在你手里，翻哪一面是你自己动手的事；可以是在旁边伺候的人，你看见了那件东西，要不要偷偷拿走、要不要告诉长辈；可以就是那个过路的人，你要不要多解释一句、三天后要不要真的回来；也可以不在场，事后听人说起“他手里那件东西邪门”。"
      },
      {
        "key": "来的人是谁",
        "value": "过路的、化缘的、走江湖的、上门推销的、说能治的人。他可以真有本事，也可以是骗子——两种都成立，但那件东西得真的照出东西来，否则这张卡改归现实类（见下）。"
      },
      {
        "key": "那件东西是什么",
        "value": "一面能照人的旧物、一块牌子、一张画、一封信、一个盒子、一段影像、一粒药。形状随便，要紧的是两条：**它有正反两面**，**只有一面是能救人的**。"
      },
      {
        "key": "那条规矩为什么要紧",
        "value": "说的人越少解释，这张卡越冷。他不说正面有什么，只说不许看——规矩不解释，才有人想试。"
      },
      {
        "key": "他为什么偏要看",
        "value": "因为背面里那样东西是他最不愿意认的：老、病、死、空、他自己。正面里是他想要的。卡不写他会不会看正面。"
      },
      {
        "key": "难受在哪里",
        "value": "屋里的人都知道该看哪一面，谁也不敢替他扣住那件东西。这张卡的难受不在“他看了假的那一面”，在**“真的那一面就在反面，谁都看得见，只有他不肯看”**。"
      },
      {
        "key": "分类",
        "value": "归奇幻类。那件东西真的照出东西、真的带着一条不能破的规矩、三天后真的有人来取；因果不全在人身上。若把这一层去掉——它只是一面普通镜子，病人自己在病里看花了眼——骨架不动，改归现实类。"
      },
      {
        "key": "这是哪",
        "value": "任何有“偏方”和“一条不能破的规矩”的世界——病房、道观、门派、实验室、合同、许愿。"
      },
      {
        "key": "注意",
        "value": "卡停在“东西搁在枕头边上，正面还没照”这一刻。不要写他照了哪一面，也不要写三天后那个人来没来。要留的只有一件：**救命的法子在他手里，他还没翻过来。**"
      }
    ]
  },
  {
    "id": "C13-01-心愿未了",
    "number": "C13-01",
    "name": "心愿未了",
    "type": "托付 / 谶",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第十三回",
    "rel": "红楼梦/奇幻类/第十三回/C13-01-心愿未了.md",
    "face": "半夜，灯还亮着。甲半梦半醒，看见一个人走进来——前些日子还见过的那一个，神色如常。\n\n来的人在甲旁边站下，含笑说：我今天要走了，你也不送我。咱们素日相好，我舍不得你，来别一别。还有一件心愿没了，非告诉你不可，别人未必中用。\n\n甲问是什么心愿。\n\n这人说：这个家如今热闹，已经快一百年了。可是什么样的热闹都长不了。趁现在还在盛时，把祖坟近旁的田庄、房舍、地亩多置一些——日后祭祖的钱粮、族学的供给都从这里出，合族定下规矩，按房轮着管。这样即便往后败了，子孙回家读书务农，也有个退步。\n\n又说：往后还有两件要紧的。一件是不久还有一桩喜事。一件是，这席，总有散的那天。\n\n临了留下两句话，叫甲记着。\n\n甲还想再问，外头传来了报丧的响声。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理，也要确认这是玩家这个世界里“死者能与活人说话”的那套机制（梦、显形、附身、临终的最后一封信、留在机器里的一段话都可以）。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是当家的人、管家里钱粮的人、新寡、掌着账本的那一个。来的人在甲心里必须有分量——甲要是根本不理会，这张卡就失效。\n\n**玩家在哪**：玩家可以就是甲，当场听见这些话，信、不信、记不记得住都在他；可以是那位已经不在的人，由玩家来决定到底说不说、说多少；可以不在场，日后只从别人嘴里听到“她临走还惦记着家里的事”。若玩家就是那位亡人，卡的重点变成“你醒着的时候没能说完的话，现在要不要说完”。\n\n**来的人是什么状态**：正史里她这时已经不在人世了。她可以是以梦来的、以影来的、借别人的口来的，也可以只是一封早已写好的东西。她不是来吓人的；她怕的是这个家散了之后，活着的人无路可退。\n\n**那件心愿是什么**：一件“趁家里还有的时候做、能长久供养一族人”的事。可以是置一份产业、立一份规矩、存一笔公账、写下一册该记下的东西。它必须是实的，看得见、管得着、分得出钱粮。\n\n**那两件事、那两句话**：两件事是临别交代的两句要紧话（一桩喜事、一场要散的席），都不必解释，也不必是诗——可以是一句俗语、一句断语、一句家常话。最后留下的那两句话只是叫甲记着的，卡不解释它，只看甲记不记得住、往不往心里去。\n\n**注意**：卡停在“报丧的响声传来，甲还想再问”这一刻。不要写甲信不信、办不办，也不要写那句“非常之喜”是什么、有没有应验——那件事本身是后面的一张卡。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理，也要确认这是玩家这个世界里“死者能与活人说话”的那套机制（梦、显形、附身、临终的最后一封信、留在机器里的一段话都可以）。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是当家的人、管家里钱粮的人、新寡、掌着账本的那一个。来的人在甲心里必须有分量——甲要是根本不理会，这张卡就失效。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场听见这些话，信、不信、记不记得住都在他；可以是那位已经不在的人，由玩家来决定到底说不说、说多少；可以不在场，日后只从别人嘴里听到“她临走还惦记着家里的事”。若玩家就是那位亡人，卡的重点变成“你醒着的时候没能说完的话，现在要不要说完”。"
      },
      {
        "key": "来的人是什么状态",
        "value": "正史里她这时已经不在人世了。她可以是以梦来的、以影来的、借别人的口来的，也可以只是一封早已写好的东西。她不是来吓人的；她怕的是这个家散了之后，活着的人无路可退。"
      },
      {
        "key": "那件心愿是什么",
        "value": "一件“趁家里还有的时候做、能长久供养一族人”的事。可以是置一份产业、立一份规矩、存一笔公账、写下一册该记下的东西。它必须是实的，看得见、管得着、分得出钱粮。"
      },
      {
        "key": "那两件事、那两句话",
        "value": "两件事是临别交代的两句要紧话（一桩喜事、一场要散的席），都不必解释，也不必是诗——可以是一句俗语、一句断语、一句家常话。最后留下的那两句话只是叫甲记着的，卡不解释它，只看甲记不记得住、往不往心里去。"
      },
      {
        "key": "注意",
        "value": "卡停在“报丧的响声传来，甲还想再问”这一刻。不要写甲信不信、办不办，也不要写那句“非常之喜”是什么、有没有应验——那件事本身是后面的一张卡。"
      }
    ]
  },
  {
    "id": "F16-01-不肯走",
    "number": "C16-10",
    "name": "不肯走",
    "type": "拘魂 / 最后一面",
    "deck": "红楼梦",
    "category": "奇幻类",
    "chapter": "第十六回",
    "rel": "红楼梦/奇幻类/第十六回/F16-01-不肯走.md",
    "face": "那个人的魂魄已经离了身，胸口只剩一口悠悠的气。持牌提索的差人已经到了床前，要拿他走。\n\n他不肯去。他求他们：家里没有人管，还有一个人下落不明，容他再留一留。差人们不肯徇私，反把他叱喝了一顿，说阴间上下铁面无私，不比阳间看情面。\n\n正闹着，门外进来一个人，走到床边，叫了一声他的名字。\n\n他的魂魄听见了，立刻又求：列位差人慈悲慈悲，让我回去，跟一个朋友说一句话就来。\n\n差人问他：又是什么朋友？\n\n他说出了那个名字。\n\n拿人的那位听见这个名字，脸色变了，慌了起来，回头骂手下的小鬼：我说放他回去走走，你们不依；如今闹得请出这个人来了。\n\n小鬼们也乱了手脚，一面抱怨：你老人家先前那么雷霆火炮，原来见不得这两个字。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是门外进来、叫出那个名字的人。他不必知道自己在做什么——他只是来看一个病人，叫了一声。\n\n**玩家在哪**：玩家可以就是甲，站在床边，不知道自己那一声有什么分量；可以是屋里守着的人，你眼睁睁看着一个人从咽气的边上被叫了回来；可以不在场，事后听说他醒了一下，说了一句话。\n\n**为什么归奇幻类**：因为这张卡的因果就架在这一件事上——**魂真的被拘住了，而那个名字真的让拿人的差人放了手**。把这层拆掉，剩下的只是一个病人回光返照，那张卡就变成《第三次醒》，不必另立一张。\n\n**要拆成现实版怎么办**：把差人写成一屋子围着的人，把\"拘魂\"写成他还有一口气吊着，把\"名字放行\"写成他一直在等这个人来。骨架不动，改归现实类。\n\n**那个名字为什么管用**：原作里连阴间的差人都怕它。卡不解释这个道理，只呈现效果：一个已经该被带走的人，被一个名字留了下来。\n\n**这是哪**：任何有\"生死之间\"的世界——只要这个世界里，人的魂是能被带走的，这张卡就成立。\n\n**注意**：卡停在\"小鬼们也乱了手脚\"这一刻。不要写他到底说成了那句话没有，也不要写差人最后放不放他。留在场上的是这件事：**有一个名字，能让拿人的差人放手。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是门外进来、叫出那个名字的人。他不必知道自己在做什么——他只是来看一个病人，叫了一声。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，站在床边，不知道自己那一声有什么分量；可以是屋里守着的人，你眼睁睁看着一个人从咽气的边上被叫了回来；可以不在场，事后听说他醒了一下，说了一句话。"
      },
      {
        "key": "为什么归奇幻类",
        "value": "因为这张卡的因果就架在这一件事上——**魂真的被拘住了，而那个名字真的让拿人的差人放了手**。把这层拆掉，剩下的只是一个病人回光返照，那张卡就变成《第三次醒》，不必另立一张。"
      },
      {
        "key": "要拆成现实版怎么办",
        "value": "把差人写成一屋子围着的人，把\"拘魂\"写成他还有一口气吊着，把\"名字放行\"写成他一直在等这个人来。骨架不动，改归现实类。"
      },
      {
        "key": "那个名字为什么管用",
        "value": "原作里连阴间的差人都怕它。卡不解释这个道理，只呈现效果：一个已经该被带走的人，被一个名字留了下来。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"生死之间\"的世界——只要这个世界里，人的魂是能被带走的，这张卡就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在\"小鬼们也乱了手脚\"这一刻。不要写他到底说成了那句话没有，也不要写差人最后放不放他。留在场上的是这件事：**有一个名字，能让拿人的差人放手。**"
      }
    ]
  },
  {
    "id": "C1-03-半盏灯",
    "number": "C1-03",
    "name": "半盏灯",
    "type": "失去 / 疏忽",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第一回",
    "rel": "红楼梦/现实类/第一回/C1-03-半盏灯.md",
    "face": "那是一个热闹的日子。甲把孩子交给一个信得过的人，让他带孩子出门。\n\n后来，听人说，他只是离开了一小会儿。他让孩子在原地等着，说“别动，我就回来”。\n\n周围很吵，人声像潮水。\n\n他回来的时候，孩子不见了。原地只剩一盏烧了一半的灯。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是孩子的父母、监护人，也可以是玩家的配偶、家人、亲戚、朋友。最好让甲和玩家有关系——玩家越在乎甲，这张卡越重。\n\n**玩家在哪**：玩家可以在场，和甲一起出门；也可以不在场，事后从甲、家人、仆从、路人的口中听说。如果玩家就是那个受托人，卡的重点就变成“孩子在你手里丢了，你回不回去”。\n\n**受托人是谁**：仆人、亲戚、朋友、邻居、年长的孩子——一个被信任的人，不是坏人。他的疏忽可以是因为内急、看热闹、被挤散、追小偷、遇到熟人。他后来是回来报信，还是跑了，不写在这张卡里，留给玩家去发现。\n\n**这是哪**：节庆、集市、夜市、游乐园、跨年、任何“人多、声音大、容易走散”的地方。那盏灯可以换成孩子手里的任何东西：面具、气球、玩偶、荧光棒、手机。\n\n**注意**：那个人不是坏人，只是那一刻没看住。不要写拐卖过程；留白比细节更可怕。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是孩子的父母、监护人，也可以是玩家的配偶、家人、亲戚、朋友。最好让甲和玩家有关系——玩家越在乎甲，这张卡越重。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，和甲一起出门；也可以不在场，事后从甲、家人、仆从、路人的口中听说。如果玩家就是那个受托人，卡的重点就变成“孩子在你手里丢了，你回不回去”。"
      },
      {
        "key": "受托人是谁",
        "value": "仆人、亲戚、朋友、邻居、年长的孩子——一个被信任的人，不是坏人。他的疏忽可以是因为内急、看热闹、被挤散、追小偷、遇到熟人。他后来是回来报信，还是跑了，不写在这张卡里，留给玩家去发现。"
      },
      {
        "key": "这是哪",
        "value": "节庆、集市、夜市、游乐园、跨年、任何“人多、声音大、容易走散”的地方。那盏灯可以换成孩子手里的任何东西：面具、气球、玩偶、荧光棒、手机。"
      },
      {
        "key": "注意",
        "value": "那个人不是坏人，只是那一刻没看住。不要写拐卖过程；留白比细节更可怕。"
      }
    ]
  },
  {
    "id": "C1-04-邻家的火",
    "number": "C1-04",
    "name": "邻家的火",
    "type": "灾变 / 失去",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第一回",
    "rel": "红楼梦/现实类/第一回/C1-04-邻家的火.md",
    "face": "甲的家，和另一户人家只隔着一道墙。\n\n那户人家一直有个隐患。甲提醒过，对方说“没事”。\n\n一天夜里，那个隐患出了事。火从墙那头烧过来。天亮时，甲的家没了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲有一个家，不算大富，但过得下去——这张卡的重点是“一夜之间，家没了”。\n\n**玩家在哪**：玩家可以在场，被火吵醒，决定先救什么；也可以不在场，事后赶回来，只看见一片焦黑。如果玩家就是那个邻居，卡的重点就变成“你的疏忽毁了别人的家”。\n\n**邻居是谁**：不是恶人，是怕麻烦、图省事、心存侥幸的人。可以是住户、铺子、作坊、仓库、工厂、实验室。\n\n**灾是什么**：火、水、气、塌、疫、乱——只要它是“从隔壁蔓延过来”的。火可以换成洪水、瓦斯、地基塌陷、传染病、骚乱。\n\n**这是哪**：任何有“邻居”和“家”的地方：房子、公寓、船、空间站、营地。\n\n**注意**：邻居不是坏人；灾难不是报应。不要写“善恶有报”；这张卡的力量在“谁都没想害人，但家就是没了”。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲有一个家，不算大富，但过得下去——这张卡的重点是“一夜之间，家没了”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，被火吵醒，决定先救什么；也可以不在场，事后赶回来，只看见一片焦黑。如果玩家就是那个邻居，卡的重点就变成“你的疏忽毁了别人的家”。"
      },
      {
        "key": "邻居是谁",
        "value": "不是恶人，是怕麻烦、图省事、心存侥幸的人。可以是住户、铺子、作坊、仓库、工厂、实验室。"
      },
      {
        "key": "灾是什么",
        "value": "火、水、气、塌、疫、乱——只要它是“从隔壁蔓延过来”的。火可以换成洪水、瓦斯、地基塌陷、传染病、骚乱。"
      },
      {
        "key": "这是哪",
        "value": "任何有“邻居”和“家”的地方：房子、公寓、船、空间站、营地。"
      },
      {
        "key": "注意",
        "value": "邻居不是坏人；灾难不是报应。不要写“善恶有报”；这张卡的力量在“谁都没想害人，但家就是没了”。"
      }
    ]
  },
  {
    "id": "C2-01-差人上门",
    "number": "C2-01",
    "name": "差人上门",
    "type": "上门 / 带走",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二回",
    "rel": "红楼梦/现实类/第二回/C2-01-差人上门.md",
    "face": "甲家里来了几个差人。他们嘴里喊着一个名字——不是甲家的人，是甲家认识的人。\n\n他们说，上头要见这个人；见不到，就带一个相关的人回去。\n\n他们看了看甲家里的人，挑了一个，推着就走。\n\n门在身后关上。剩下的人站在院子里，不知道出了什么事。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家最好和某个“上头要找的人”有关系——不一定是亲人，也可以是旧友、债主、同乡。\n\n**玩家在哪**：玩家可以在场，看着家里人被推走；也可以不在场，事后回来，只看见一院子慌乱的人。如果玩家就是被带走的人，卡的重点就变成“你被推进一间屋子，没人告诉你为什么”。\n\n**差人是谁**：官差、士兵、执法者、债主的打手、某个组织的办事人。他们不是恶人，只是办事。\n\n**要找的人是谁**：一个失踪的人、一个逃犯、一个旧友、一个欠债的人、一个“不应该被提起”的人。\n\n**这是哪**：任何有“上头”和“下面的人”的世界：官府、军队、公司、帮派、家族、殖民地的管理机构。\n\n**注意**：不要写差人当场打人，也不要写他们解释原因。卡停在“门在身后关上”这一刻；为什么带走、带走之后怎么办，留给桌上的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家最好和某个“上头要找的人”有关系——不一定是亲人，也可以是旧友、债主、同乡。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，看着家里人被推走；也可以不在场，事后回来，只看见一院子慌乱的人。如果玩家就是被带走的人，卡的重点就变成“你被推进一间屋子，没人告诉你为什么”。"
      },
      {
        "key": "差人是谁",
        "value": "官差、士兵、执法者、债主的打手、某个组织的办事人。他们不是恶人，只是办事。"
      },
      {
        "key": "要找的人是谁",
        "value": "一个失踪的人、一个逃犯、一个旧友、一个欠债的人、一个“不应该被提起”的人。"
      },
      {
        "key": "这是哪",
        "value": "任何有“上头”和“下面的人”的世界：官府、军队、公司、帮派、家族、殖民地的管理机构。"
      },
      {
        "key": "注意",
        "value": "不要写差人当场打人，也不要写他们解释原因。卡停在“门在身后关上”这一刻；为什么带走、带走之后怎么办，留给桌上的人。"
      }
    ]
  },
  {
    "id": "C2-02-讨人",
    "number": "C2-02",
    "name": "讨人",
    "type": "权势 / 索取",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二回",
    "rel": "红楼梦/现实类/第二回/C2-02-讨人.md",
    "face": "甲家里来了一个人，带来的不是坏消息，是礼物。\n\n来人客客气气，说上头的人看上了甲家的一个人——不是娶，是“要”。\n\n甲家里有人动了心：这是攀附的机会。那人开始劝，说这是福气，说这是为全家人好。\n\n被要的那个人，还没有开口。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家里有一个被看上的人——女儿、妹妹、养女、丫鬟、伴侣、下属。\n\n**玩家在哪**：玩家可以在场，看着礼物摆上桌；也可以不在场，事后从家里人的口中听说。如果玩家就是被要的那个人，卡的重点就变成“全家人都在看你，等你点头”。\n\n**要人的是谁**：有权有势的人、地方官、富商、军阀、家族长辈、上级。\n\n**劝说的人是谁**：家里想攀附的人、媒人、管事、亲戚。他真心觉得这是为全家好——不要把他写成纯恶人。\n\n**要的是什么**：做妾、做小、做随从、做养女、做“自己人”。名义可以好听，实质是被要走。\n\n**这是哪**：任何有“权势”和“依附”的世界。\n\n**注意**：卡停在“被要的人还没有开口”这一刻。她可以拒绝，也可以答应；卡不替她选。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家里有一个被看上的人——女儿、妹妹、养女、丫鬟、伴侣、下属。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，看着礼物摆上桌；也可以不在场，事后从家里人的口中听说。如果玩家就是被要的那个人，卡的重点就变成“全家人都在看你，等你点头”。"
      },
      {
        "key": "要人的是谁",
        "value": "有权有势的人、地方官、富商、军阀、家族长辈、上级。"
      },
      {
        "key": "劝说的人是谁",
        "value": "家里想攀附的人、媒人、管事、亲戚。他真心觉得这是为全家好——不要把他写成纯恶人。"
      },
      {
        "key": "要的是什么",
        "value": "做妾、做小、做随从、做养女、做“自己人”。名义可以好听，实质是被要走。"
      },
      {
        "key": "这是哪",
        "value": "任何有“权势”和“依附”的世界。"
      },
      {
        "key": "注意",
        "value": "卡停在“被要的人还没有开口”这一刻。她可以拒绝，也可以答应；卡不替她选。"
      }
    ]
  },
  {
    "id": "C2-03-丢官",
    "number": "C2-03",
    "name": "丢官",
    "type": "失势",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二回",
    "rel": "红楼梦/现实类/第二回/C2-03-丢官.md",
    "face": "甲的上司递来一纸公文。上面写着甲的名字，和几条甲不认的罪名。\n\n甲的位子没了。来传话的人面无表情，办完手续就走了。\n\n同僚们没有来送。甲站在空下来的位子上，天还没有黑。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲有一个位子、头衔或差事——不一定是官，也可以是职位、军衔、执照、身份。\n\n**玩家在哪**：玩家可以在场，看着公文被递过来；也可以不在场，事后从旁人、家人、旧同僚的口中听说。如果玩家是甲的家人，卡的重点就变成“家里的顶梁柱突然空了”。\n\n**怎么丢的**：被上司参了一本、被同僚排挤、一次举报、一场清算、一次站错队。\n\n**这是哪**：任何有“位子”和“上头”的世界：官场、军队、公司、教会、行会、殖民地。\n\n**注意**：不要写甲当场发怒，也不要写甲当场看破。那是甲的反应，不是卡的内容。卡停在“位子没了”这一刻。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲有一个位子、头衔或差事——不一定是官，也可以是职位、军衔、执照、身份。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，看着公文被递过来；也可以不在场，事后从旁人、家人、旧同僚的口中听说。如果玩家是甲的家人，卡的重点就变成“家里的顶梁柱突然空了”。"
      },
      {
        "key": "怎么丢的",
        "value": "被上司参了一本、被同僚排挤、一次举报、一场清算、一次站错队。"
      },
      {
        "key": "这是哪",
        "value": "任何有“位子”和“上头”的世界：官场、军队、公司、教会、行会、殖民地。"
      },
      {
        "key": "注意",
        "value": "不要写甲当场发怒，也不要写甲当场看破。那是甲的反应，不是卡的内容。卡停在“位子没了”这一刻。"
      }
    ]
  },
  {
    "id": "C2-05-女主人走了",
    "number": "C2-05",
    "name": "女主人走了",
    "type": "丧亲 / 留下",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二回",
    "rel": "红楼梦/现实类/第二回/C2-05-女主人走了.md",
    "face": "甲家里的女主人病了。病来得很急，没拖多久。\n\n她走的那天，家里的人都在。她留下一个孩子——还小，还不太明白发生了什么。\n\n丧事办完，屋子里安静下来。孩子站在门口，等一个不会回来的人。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家里有一个孩子，和一个刚走的女主人。\n\n**玩家在哪**：玩家可以在场，送她最后一程；也可以不在场，事后赶来，只看见一个还没回过神的孩子。如果玩家就是那个孩子，卡的重点就变成“你还不懂‘走了’是什么意思”。\n\n**走的是谁**：母亲、妻子、养母、姐姐、祖母——家里那个“撑着日常的人”。\n\n**孩子多大**：越小越难。但不能小到无法成为一张卡；至少要让旁人觉得“这孩子以后怎么办”。\n\n**这是哪**：任何世界。\n\n**注意**：不要写家里立刻决定把孩子送走还是留下；那是下一步。卡停在“屋子里安静下来”这一刻。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲家里有一个孩子，和一个刚走的女主人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，送她最后一程；也可以不在场，事后赶来，只看见一个还没回过神的孩子。如果玩家就是那个孩子，卡的重点就变成“你还不懂‘走了’是什么意思”。"
      },
      {
        "key": "走的是谁",
        "value": "母亲、妻子、养母、姐姐、祖母——家里那个“撑着日常的人”。"
      },
      {
        "key": "孩子多大",
        "value": "越小越难。但不能小到无法成为一张卡；至少要让旁人觉得“这孩子以后怎么办”。"
      },
      {
        "key": "这是哪",
        "value": "任何世界。"
      },
      {
        "key": "注意",
        "value": "不要写家里立刻决定把孩子送走还是留下；那是下一步。卡停在“屋子里安静下来”这一刻。"
      }
    ]
  },
  {
    "id": "C3-01-一封荐书",
    "number": "C3-01",
    "name": "一封荐书",
    "type": "举荐 / 人情",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第三回",
    "rel": "红楼梦/现实类/第三回/C3-01-一封荐书.md",
    "face": "一个人上门来，衣冠整齐，手里捏着一封封好的信。他不坐，也不多话，先把信递过去。\n\n信是甲的一个旧交写的——多年没来往，当年帮过甲，或者只是甲一直敬重的人。信里的话很短：这个人可用，请抬手照看。\n\n来人这才开口。他不求钱，不求住，只求一个位子。\n\n甲手里正好有一个位子——管账、教书、跑腿、看门，一个总得交给别人的差事。\n\n写这封信的人，一生没有为谁开过口。\n\n来人还站在门口，等一句话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是手里有那个位子的人——东家、管家、上司、族长、师长，也可以是玩家。若玩家手上没有位子，就把甲设成玩家的家人或朋友。\n\n**玩家在哪**：玩家可以是甲，当场决定给不给；也可以是那个求位子的人，站在门口等一句话；也可以不在场，事后从甲、家里人或同僚口中听说。\n\n**求位子的人是谁**：落魄的读书人、失业的旧部、亲戚家的孩子、被上一家赶出来的人。他体面，但没路走；他手里那封信，是他唯一的本钱。\n\n**写信的人是谁**：甲敬重的人、欠过情的人、得罪不起的人、多年不来往的故人。他的分量，决定这封信有多重。\n\n**那个位子是什么**：账房、教席、铺面管事、一个编制、一份差事、一间分店、一个名额。位子可以很小，但它是别人活下去的依靠。\n\n**这是哪**：只要有“举荐”和“位子”的世界都成立——官府、商号、公司、门派、船队、家族。信可以是信、帖子、名片、邮件，或者一句带过来的口信。\n\n**注意**：卡停在“来人还站在门口”这一刻。不要写甲收不收，也不要写这个人日后能不能干、会不会出事。若甲收了，这份人情要记在账上——写信的人从此可以向甲开口。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是手里有那个位子的人——东家、管家、上司、族长、师长，也可以是玩家。若玩家手上没有位子，就把甲设成玩家的家人或朋友。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当场决定给不给；也可以是那个求位子的人，站在门口等一句话；也可以不在场，事后从甲、家里人或同僚口中听说。"
      },
      {
        "key": "求位子的人是谁",
        "value": "落魄的读书人、失业的旧部、亲戚家的孩子、被上一家赶出来的人。他体面，但没路走；他手里那封信，是他唯一的本钱。"
      },
      {
        "key": "写信的人是谁",
        "value": "甲敬重的人、欠过情的人、得罪不起的人、多年不来往的故人。他的分量，决定这封信有多重。"
      },
      {
        "key": "那个位子是什么",
        "value": "账房、教席、铺面管事、一个编制、一份差事、一间分店、一个名额。位子可以很小，但它是别人活下去的依靠。"
      },
      {
        "key": "这是哪",
        "value": "只要有“举荐”和“位子”的世界都成立——官府、商号、公司、门派、船队、家族。信可以是信、帖子、名片、邮件，或者一句带过来的口信。"
      },
      {
        "key": "注意",
        "value": "卡停在“来人还站在门口”这一刻。不要写甲收不收，也不要写这个人日后能不能干、会不会出事。若甲收了，这份人情要记在账上——写信的人从此可以向甲开口。"
      }
    ]
  },
  {
    "id": "C3-02-一只箱子",
    "number": "C3-02",
    "name": "一只箱子",
    "type": "离别 / 托付",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第三回",
    "rel": "红楼梦/现实类/第三回/C3-02-一只箱子.md",
    "face": "甲身边只剩这一个孩子。孩子的娘不在了，甲自己一年比一年老。\n\n远方来了信，说要把孩子接过去养：那边饭食好、有人教、将来有出路。信上说，接的人已经在路上了。\n\n这一天，接的人到了。孩子的东西收成一只箱子，已经放在门边。\n\n孩子在甲面前站着，不说话。甲知道，孩子这一走，这个家就空了。\n\n送的人在外头等着，催了一声。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲必须舍不得这个孩子——这是这张卡的关键；如果甲巴不得孩子走，卡的滋味就没有了。\n\n**玩家在哪**：玩家可以就是甲，站在门边做决定；也可以是那个孩子，被人送出门；也可以不在场，事后听说这个孩子被送走了。若玩家是来接的人，卡的重点就变成“你要不要接手这个孩子”。\n\n**接孩子的人是谁**：远亲、旧友、没有孩子的富户、孩子母亲那一头的人、一个愿意养她的长辈。他们不一定是好人，但他们出得起这一份饭。\n\n**孩子为什么留不下**：父亲老了、家里败了、孩子多病、家里没人教她、本地没有活路。理由可以换，“舍不得”不能换。\n\n**一只箱子是什么**：箱子、包袱、行李箱、一只旧书包。里面是孩子全部的家当，装不下她熟悉的东西。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。走的方式可以是船、车、轿子、火车、飞船。\n\n**注意**：卡停在“接的人在门外等着”这一刻。不要写甲最后说了什么，也不要写孩子有没有走。若孩子走了，她带走的那只箱子，就是下一张卡的入口。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的配偶、家人、亲戚、朋友。甲必须舍不得这个孩子——这是这张卡的关键；如果甲巴不得孩子走，卡的滋味就没有了。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，站在门边做决定；也可以是那个孩子，被人送出门；也可以不在场，事后听说这个孩子被送走了。若玩家是来接的人，卡的重点就变成“你要不要接手这个孩子”。"
      },
      {
        "key": "接孩子的人是谁",
        "value": "远亲、旧友、没有孩子的富户、孩子母亲那一头的人、一个愿意养她的长辈。他们不一定是好人，但他们出得起这一份饭。"
      },
      {
        "key": "孩子为什么留不下",
        "value": "父亲老了、家里败了、孩子多病、家里没人教她、本地没有活路。理由可以换，“舍不得”不能换。"
      },
      {
        "key": "一只箱子是什么",
        "value": "箱子、包袱、行李箱、一只旧书包。里面是孩子全部的家当，装不下她熟悉的东西。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。走的方式可以是船、车、轿子、火车、飞船。"
      },
      {
        "key": "注意",
        "value": "卡停在“接的人在门外等着”这一刻。不要写甲最后说了什么，也不要写孩子有没有走。若孩子走了，她带走的那只箱子，就是下一张卡的入口。"
      }
    ]
  },
  {
    "id": "C3-03-住进来的人",
    "number": "C3-03",
    "name": "住进来的人",
    "type": "寄居 / 接纳",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第三回",
    "rel": "红楼梦/现实类/第三回/C3-03-住进来的人.md",
    "face": "甲家里来了一个孩子。是远亲、旧交，或者某个已经不在了的人留下的。送她来的人把话说明白：这孩子以后就住这儿了。\n\n人送到了，车马回去了。孩子的行李只有一件，放在廊下。\n\n孩子站在堂屋当中，很瘦，很小，眼睛却一直在看人——看谁在看她，看哪句话是冲她来的。\n\n家里的人都出来了，站在各处看着她。没有人说话。\n\n孩子还站在那里，等一个安排。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这个家做主的人，或者家里任何一个要跟这孩子过下去的人。甲的态度，定了她在这个家的位置。\n\n**玩家在哪**：玩家可以在场，看着这个孩子被送进来；也可以不在场，回到家才知道家里多了个人。若玩家就是这个孩子，卡的重点就变成“你站在别人家的堂屋里，怎么让自己不碍眼”。\n\n**这孩子是谁**：父母双亡、母亲病故、家里出事、被过继、被寄养。年龄越小，卡的重量越偏这一家人；越大，越偏她自己。\n\n**送她来的人是谁**：转达安排的中间人、老仆、远亲、官面上的差人。他把人放下就走。\n\n**她带来什么**：一只箱子、一封信、一份按月给的钱、一笔说不清的欠账。多数时候，只带来她自己。\n\n**安顿她的是什么**：一间屋子、一张床、一个照看她的人、一份月钱、一套衣裳、一个称呼。给什么，等于说她是谁。\n\n**这一家原来有什么人**：几个孩子、几个当家人、几房亲戚。多一个人，就多一份分法、多一份比较。\n\n**这是哪**：任何“亲戚托付”能成立的世界——大家族、宗族、寄宿、公司宿舍、收养。\n\n**注意**：卡停在“孩子站在堂屋当中，等一个安排”这一刻。不要写这一家待她好还是不好，也不要写她日后会不会感恩。若玩家是主家，选择不是“收不收”（人已经来了），而是“把她当自家人、当客，还是当月钱换来的一个人”。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这个家做主的人，或者家里任何一个要跟这孩子过下去的人。甲的态度，定了她在这个家的位置。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，看着这个孩子被送进来；也可以不在场，回到家才知道家里多了个人。若玩家就是这个孩子，卡的重点就变成“你站在别人家的堂屋里，怎么让自己不碍眼”。"
      },
      {
        "key": "这孩子是谁",
        "value": "父母双亡、母亲病故、家里出事、被过继、被寄养。年龄越小，卡的重量越偏这一家人；越大，越偏她自己。"
      },
      {
        "key": "送她来的人是谁",
        "value": "转达安排的中间人、老仆、远亲、官面上的差人。他把人放下就走。"
      },
      {
        "key": "她带来什么",
        "value": "一只箱子、一封信、一份按月给的钱、一笔说不清的欠账。多数时候，只带来她自己。"
      },
      {
        "key": "安顿她的是什么",
        "value": "一间屋子、一张床、一个照看她的人、一份月钱、一套衣裳、一个称呼。给什么，等于说她是谁。"
      },
      {
        "key": "这一家原来有什么人",
        "value": "几个孩子、几个当家人、几房亲戚。多一个人，就多一份分法、多一份比较。"
      },
      {
        "key": "这是哪",
        "value": "任何“亲戚托付”能成立的世界——大家族、宗族、寄宿、公司宿舍、收养。"
      },
      {
        "key": "注意",
        "value": "卡停在“孩子站在堂屋当中，等一个安排”这一刻。不要写这一家待她好还是不好，也不要写她日后会不会感恩。若玩家是主家，选择不是“收不收”（人已经来了），而是“把她当自家人、当客，还是当月钱换来的一个人”。"
      }
    ]
  },
  {
    "id": "C3-04-第一顿饭",
    "number": "C3-04",
    "name": "第一顿饭",
    "type": "规矩 / 受与不受",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第三回",
    "rel": "红楼梦/现实类/第三回/C3-04-第一顿饭.md",
    "face": "开饭了。这是新来的人在这个家里吃的第一顿饭。\n\n做主的人把她往最上的位子让。那是这一桌最好的位置，边上就是当家的长辈。所有人都看着。\n\n她不肯，往后退了半步。做主的人也不肯，又让了一回。\n\n桌上的人停下手里的动作。有人笑，有人看着，有人在等。\n\n位子还空着，菜已经开始上了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是坐上这一桌的人——可以是新来的那个人，也可以是做主的人，或者旁边看着的一个孩子。谁坐这个位子，是这一桌的事，也是这个家的事。\n\n**玩家在哪**：玩家可以就是被让位的人，要当场给一个反应；也可以是让位的主事人；也可以是同桌的其他人，看着这一切。\n\n**为什么让**：做主的人真心疼这个新人；也是做给全桌看——这个人是我要护的。\n\n**为什么推**：坐上去，就等于认下这份好；认了就得还；也怕别的人心里不平。\n\n**代价**：坐了，欠一份人情，从此被家里人拿眼睛量；不坐，驳了主事人的面子，也把自己放在“外人”那个位置上。\n\n**位子是什么**：上座、首席、主位、最靠里的位子、先动筷子的资格。也可以换成别的东西：第一杯茶、最好的那间屋、先挑的份例。\n\n**这是哪**：任何有“桌上规矩”的世界——家宴、酒席、会议、宿舍、食堂。\n\n**注意**：卡停在“位子还空着”这一刻。不要写她最后坐没坐，也不要写旁人心里怎么想。这一顿饭吃下去，这一家的规矩和她在其中的位置，也就定了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是坐上这一桌的人——可以是新来的那个人，也可以是做主的人，或者旁边看着的一个孩子。谁坐这个位子，是这一桌的事，也是这个家的事。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是被让位的人，要当场给一个反应；也可以是让位的主事人；也可以是同桌的其他人，看着这一切。"
      },
      {
        "key": "为什么让",
        "value": "做主的人真心疼这个新人；也是做给全桌看——这个人是我要护的。"
      },
      {
        "key": "为什么推",
        "value": "坐上去，就等于认下这份好；认了就得还；也怕别的人心里不平。"
      },
      {
        "key": "代价",
        "value": "坐了，欠一份人情，从此被家里人拿眼睛量；不坐，驳了主事人的面子，也把自己放在“外人”那个位置上。"
      },
      {
        "key": "位子是什么",
        "value": "上座、首席、主位、最靠里的位子、先动筷子的资格。也可以换成别的东西：第一杯茶、最好的那间屋、先挑的份例。"
      },
      {
        "key": "这是哪",
        "value": "任何有“桌上规矩”的世界——家宴、酒席、会议、宿舍、食堂。"
      },
      {
        "key": "注意",
        "value": "卡停在“位子还空着”这一刻。不要写她最后坐没坐，也不要写旁人心里怎么想。这一顿饭吃下去，这一家的规矩和她在其中的位置，也就定了。"
      }
    ]
  },
  {
    "id": "C3-06-第一夜",
    "number": "C3-06",
    "name": "第一夜",
    "type": "安抚 / 自责",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第三回",
    "rel": "红楼梦/现实类/第三回/C3-06-第一夜.md",
    "face": "夜里，人都睡下了。新来的孩子还没睡。\n\n白天那场乱子已经过去，她还坐在床上抹眼泪，反复说着同一句：都是因为我。\n\n一个在这家里做事的人听见了，进来，在她床边坐下。\n\n那个人说：这不怪你。往后这样的事还多着呢，你要是为这个伤心，往后伤心不完。\n\n说完，那个人没有走。\n\n灯还亮着。这一夜的话，屋外没有人听见。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是那个新来的人，也可以是来劝的那个人。若玩家是新来的人，卡的重点是“你要不要把这句话说出口”；若玩家是来劝的人，重点是“你替谁站这一边”。\n\n**玩家在哪**：玩家可以就在这间屋里；也可以住在隔壁，听见哭声，装作没听见。\n\n**来劝的人是谁**：仆人、下人、年长的同辈、邻屋的姐妹、看门的老头。她的位置比她的话更重要——她自己也是依附这一家活着的。\n\n**她在哭什么**：白天惹出的乱子、想家、怕被讨厌、怕给家里丢脸。核心是：把别人的脾气，算成了自己的错。\n\n**劝的那句话是什么**：可以是“这不怪你”，也可以是“以后你会习惯的”“这就是这家人的规矩”“你别往心里去”。不同的话，养出不同的人。\n\n**这是哪**：任何有“新来的人”和“做事的人”的地方。\n\n**注意**：卡停在“灯还亮着，两个人的话没人听见”这一刻。不要写她们后来成了什么关系。若这张卡演下去，这份私下的交情要记下来——它是这个孩子在这个家里，第一条属于她自己的线。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是那个新来的人，也可以是来劝的那个人。若玩家是新来的人，卡的重点是“你要不要把这句话说出口”；若玩家是来劝的人，重点是“你替谁站这一边”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就在这间屋里；也可以住在隔壁，听见哭声，装作没听见。"
      },
      {
        "key": "来劝的人是谁",
        "value": "仆人、下人、年长的同辈、邻屋的姐妹、看门的老头。她的位置比她的话更重要——她自己也是依附这一家活着的。"
      },
      {
        "key": "她在哭什么",
        "value": "白天惹出的乱子、想家、怕被讨厌、怕给家里丢脸。核心是：把别人的脾气，算成了自己的错。"
      },
      {
        "key": "劝的那句话是什么",
        "value": "可以是“这不怪你”，也可以是“以后你会习惯的”“这就是这家人的规矩”“你别往心里去”。不同的话，养出不同的人。"
      },
      {
        "key": "这是哪",
        "value": "任何有“新来的人”和“做事的人”的地方。"
      },
      {
        "key": "注意",
        "value": "卡停在“灯还亮着，两个人的话没人听见”这一刻。不要写她们后来成了什么关系。若这张卡演下去，这份私下的交情要记下来——它是这个孩子在这个家里，第一条属于她自己的线。"
      }
    ]
  },
  {
    "id": "C4-01-一支令签",
    "number": "C4-01",
    "name": "一支令签",
    "type": "执法 / 受制",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-01-一支令签.md",
    "face": "状子递上来了。一个人被打死了，凶手当晚就走得干干净净，只剩几个不相干的人在堂下站着。递状子的人说，他告了一年，投了无数处，没有一处肯接。\n\n甲的签就摆在案上。这支签一掷下去，就拿人。甲抬手。\n\n案旁站着的那个人，忽然朝甲使了个眼色。他的头低着，只有眼睛往上一挑，随即又垂下去。\n\n签在甲手里。堂下还在等。甲不知道他为什么拦。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是手里有这支签的人——主官、法官、上级、管事的、有处置权的人，也可以是玩家。若玩家手里没有这支签，就把甲设成玩家的家人、上司或朋友。\n\n**玩家在哪**：玩家可以就是甲，当场决定掷不掷；也可以是堂下那个递状子的人，看着签举起来又停住；也可以不在场，事后听说案子没有下文。若玩家是在案旁使眼色的那个人，卡的重点就变成“你要不要当着满堂的人救你的上司一次”。\n\n**甲面前是什么案子**：人命、伤人、强占、夺产、逼死。案子本身不复杂——复杂的是被告是谁。\n\n**递状子的人**：死者的家人、同乡、旧仆、替人跑腿的。他告了一年，已经不指望公道，只指望有人肯接。\n\n**给甲眼色的人**：甲手下的办事人、文案、门房、差役。他在这个位子上待得久，知道哪支签掷得，哪支掷不得。\n\n**这是哪**：任何有“堂上”和“案上”的世界——官府、法庭、军队、公司、行会、宗族。签可以是签、传票、拘票、一纸命令、一个电话。\n\n**注意**：卡停在“签还在甲手里”这一刻。不要写甲掷了还是收了，也不要写使眼色的人说了什么。队伍里有人拦着不让你办案，这件事本身就是这张卡。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是手里有这支签的人——主官、法官、上级、管事的、有处置权的人，也可以是玩家。若玩家手里没有这支签，就把甲设成玩家的家人、上司或朋友。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场决定掷不掷；也可以是堂下那个递状子的人，看着签举起来又停住；也可以不在场，事后听说案子没有下文。若玩家是在案旁使眼色的那个人，卡的重点就变成“你要不要当着满堂的人救你的上司一次”。"
      },
      {
        "key": "甲面前是什么案子",
        "value": "人命、伤人、强占、夺产、逼死。案子本身不复杂——复杂的是被告是谁。"
      },
      {
        "key": "递状子的人",
        "value": "死者的家人、同乡、旧仆、替人跑腿的。他告了一年，已经不指望公道，只指望有人肯接。"
      },
      {
        "key": "给甲眼色的人",
        "value": "甲手下的办事人、文案、门房、差役。他在这个位子上待得久，知道哪支签掷得，哪支掷不得。"
      },
      {
        "key": "这是哪",
        "value": "任何有“堂上”和“案上”的世界——官府、法庭、军队、公司、行会、宗族。签可以是签、传票、拘票、一纸命令、一个电话。"
      },
      {
        "key": "注意",
        "value": "卡停在“签还在甲手里”这一刻。不要写甲掷了还是收了，也不要写使眼色的人说了什么。队伍里有人拦着不让你办案，这件事本身就是这张卡。"
      }
    ]
  },
  {
    "id": "C4-02-一张私单",
    "number": "C4-02",
    "name": "一张私单",
    "type": "权势 / 内情",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-02-一张私单.md",
    "face": "门关上了，旁人退出去。甲叫那个人近前说话。\n\n“老爷到这里上任，手里就没有抄一张单子？”\n\n他从怀里取出一张纸，纸边已经磨软了，递上来。上面是一串人家，一行一行，写的都是本地的姓氏。甲一眼就看见其中一个——正是这个案子里的人。\n\n“这上头的人家，动一动，位子就没了。”他说，“前几任官府，不是断不了这个案，是不敢断。”\n\n“他们几家彼此是亲，动一家，等于动几家。”\n\n单子还在甲手里。他退到一边，等甲开口。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是刚接手这件事的人——新到任的主事、新调的管事的、刚接下这桩委托的人。也可以就是玩家。甲到这个位子还不满几天，什么都不熟。\n\n**玩家在哪**：玩家可以就是甲，把那张纸接过来看；也可以不在场，事后从别人口中知道有这么一张单子；若玩家就是递单子的人，卡的重点就变成“你拿出这张纸，是想救他，还是想让他欠你”。\n\n**单子是什么**：一份不能得罪的人家清单、一份内部名单、一份谁也不明说的关系图。做这一行的人手上都有一份；有的人写下来，有的人记在脑子里。\n\n**递单子的人是谁**：甲手下的办事人、旧吏、老差役。他在这里待过好几任主官，见过前面几位是怎么走的。他和甲多半有些旧关系——这正是甲最不想被人提起来的地方。\n\n**上面还有什么**：一串人家的名字、彼此之间的姻亲、谁家出过什么人、哪几处地界归谁。单子不长，但每一行都压着一件案子。\n\n**这是哪**：任何有“上头”和“本地势力”的世界——官场、商场、行业、门派、殖民地的管理署。单子可以是纸、是账、是一份名单、是某个人的脑子里。\n\n**注意**：卡停在“单子还在甲手里”这一刻。不要写甲烧没烧、记没记。这张纸不必是秘密——真正的份量在于：甲看完了，就再也不能说“我不知道”。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是刚接手这件事的人——新到任的主事、新调的管事的、刚接下这桩委托的人。也可以就是玩家。甲到这个位子还不满几天，什么都不熟。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，把那张纸接过来看；也可以不在场，事后从别人口中知道有这么一张单子；若玩家就是递单子的人，卡的重点就变成“你拿出这张纸，是想救他，还是想让他欠你”。"
      },
      {
        "key": "单子是什么",
        "value": "一份不能得罪的人家清单、一份内部名单、一份谁也不明说的关系图。做这一行的人手上都有一份；有的人写下来，有的人记在脑子里。"
      },
      {
        "key": "递单子的人是谁",
        "value": "甲手下的办事人、旧吏、老差役。他在这里待过好几任主官，见过前面几位是怎么走的。他和甲多半有些旧关系——这正是甲最不想被人提起来的地方。"
      },
      {
        "key": "上面还有什么",
        "value": "一串人家的名字、彼此之间的姻亲、谁家出过什么人、哪几处地界归谁。单子不长，但每一行都压着一件案子。"
      },
      {
        "key": "这是哪",
        "value": "任何有“上头”和“本地势力”的世界——官场、商场、行业、门派、殖民地的管理署。单子可以是纸、是账、是一份名单、是某个人的脑子里。"
      },
      {
        "key": "注意",
        "value": "卡停在“单子还在甲手里”这一刻。不要写甲烧没烧、记没记。这张纸不必是秘密——真正的份量在于：甲看完了，就再也不能说“我不知道”。"
      }
    ]
  },
  {
    "id": "C4-03-恩人的女儿",
    "number": "C4-03",
    "name": "恩人的女儿",
    "type": "认亲 / 恩义",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-03-恩人的女儿.md",
    "face": "案卷里有这个人的来历：姓什么，多大年纪，从哪里被卖出来的。甲听人念，念到一半，停住了。\n\n这个名字甲认得。那人当年给过甲一份恩——甲能有今天，是从他那一步开始的。这个人早就不在了。\n\n底下的人还在往下说：当年那个孩子，五岁上被人拐走，养到十二三岁，带到他乡转卖。她眉心有一点天生的记号。这里的老人一见就认得她。\n\n甲再抬头，堂上站着的正是她。她刚被从两个人手里夺过来，人和当年那张纸上的名字，对上了。\n\n她也在看甲。她不认得甲。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是认得这个名字的人——受过恩的、欠过情的、当年见过她的、被她家照顾过的。甲得有一份旧恩，而且是还没还上的那种。甲可以是玩家，也可以是玩家的长辈或家人。\n\n**玩家在哪**：玩家可以就是甲，在案卷念到一半的时候认出来；也可以是堂上那个人，正被人当一件东西分派；也可以不在场，事后从别人口中听说这件事。最重的一种位置是：玩家是甲，而恩人的女儿此时在等你按规矩办她。\n\n**恩是什么恩**：出钱供甲读书、替甲引荐、在甲最难的时候收留过甲、替甲挡过一件事。恩不必大，但甲得认。\n\n**她怎么被认出来的**：眉心的一点记号、一个旧名字、一句话、一件旧事。要让认得这件事有凭据，不能只凭感觉。\n\n**她的来历**：幼年被拐，被养大，被转卖。她自己多半不记得小时候的事；记得也不敢说。她只知道自己值多少钱。\n\n**她现在是案子里的人**：有人买了她，有人又来夺。两边争的是她，没有一边问过她。\n\n**这是哪**：任何有“恩”和“名籍”的世界——官府、宗族、乡里、行会、公司。恩可以是举荐、资助、托付、庇护。\n\n**注意**：卡停在“她也在看甲”这一刻。不要写甲认不认她，也不要写甲怎么处置这个案子。甲认出她的这一下，就已经把这个案子从他的公事变成了他私人的事。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是认得这个名字的人——受过恩的、欠过情的、当年见过她的、被她家照顾过的。甲得有一份旧恩，而且是还没还上的那种。甲可以是玩家，也可以是玩家的长辈或家人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，在案卷念到一半的时候认出来；也可以是堂上那个人，正被人当一件东西分派；也可以不在场，事后从别人口中听说这件事。最重的一种位置是：玩家是甲，而恩人的女儿此时在等你按规矩办她。"
      },
      {
        "key": "恩是什么恩",
        "value": "出钱供甲读书、替甲引荐、在甲最难的时候收留过甲、替甲挡过一件事。恩不必大，但甲得认。"
      },
      {
        "key": "她怎么被认出来的",
        "value": "眉心的一点记号、一个旧名字、一句话、一件旧事。要让认得这件事有凭据，不能只凭感觉。"
      },
      {
        "key": "她的来历",
        "value": "幼年被拐，被养大，被转卖。她自己多半不记得小时候的事；记得也不敢说。她只知道自己值多少钱。"
      },
      {
        "key": "她现在是案子里的人",
        "value": "有人买了她，有人又来夺。两边争的是她，没有一边问过她。"
      },
      {
        "key": "这是哪",
        "value": "任何有“恩”和“名籍”的世界——官府、宗族、乡里、行会、公司。恩可以是举荐、资助、托付、庇护。"
      },
      {
        "key": "注意",
        "value": "卡停在“她也在看甲”这一刻。不要写甲认不认她，也不要写甲怎么处置这个案子。甲认出她的这一下，就已经把这个案子从他的公事变成了他私人的事。"
      }
    ]
  },
  {
    "id": "C4-04-上头的示警",
    "number": "C4-04",
    "name": "上头的示警",
    "type": "构陷 / 结案",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-04-上头的示警.md",
    "face": "旁边那个人把话说开了，一步一步，说得很顺。\n\n凶犯不必到堂。让他家里报一个“暴病身亡”，族里人和邻舍连名递一张保状上来。原告那边给一笔抚恤银子：一千也行，五百也行——他不过是要钱。\n\n堂上还要摆一处请神降示的地方：香烛、笔、一张空文。甲只当众说一句“上头已有批示”：死者和凶犯是前世的冤孽，凶犯如今得了无名之病，被死者的魂追了去；祸根在那个拐人的身上，办他就是，别的不牵连。\n\n话都说完了。他退到一边，等甲点头。\n\n抚恤银子的数目、笔上要写的字，都还是空的。原告在外面等着。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是能给这件事收尾的人——主官、主事、受托的人、有权签字的人。甲是玩家，还是玩家的家人、上司、旧交，都可以。\n\n**玩家在哪**：玩家可以就是甲，当场点不点头；也可以是堂下那个等银子的原告，或是被叫去操办那处神坛的人；也可以不在场，事后只看见案子已经结了。\n\n**这一套是怎么运作的**：它先定下结论，再让所有能说话的东西去印证这个结论：病是假的，可保状是真的；批示是编的，可念出来的人是真的；银子是实的，拿了银子的人就再没有话说了。\n\n**甲为什么要答应**：答应了这个案子就结了；不答应，原告还是要钱，被告还是要脱身，上面还会再来问一遍。甲答应与不答应，都要付代价。\n\n**抚恤银子是什么**：一笔抚恤、一笔赔偿、一笔“从此不要再提”的钱。当场给现的，或者写一张欠条；数目可换，名义可换。\n\n**这是哪**：任何有“结案”和“人情”的世界——衙门、法庭、公司、帮会、军队、宗族。神坛可以换成任何一种“上头的意思”：一份文件、一次通报、一句批示、一场发布会。\n\n**分类**：这一版的“示警”是编排出来的，所以归现实类。若玩家这个世界真有神示，把它写成真的降示即可，骨架不变，改归奇幻类。\n\n**注意**：卡停在“等甲点头”这一刻。不要写甲答应没有，也不要写原告拿了钱走没走。这一处神坛立起来之后，往后任何一件案子，都可以照这个样子办。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是能给这件事收尾的人——主官、主事、受托的人、有权签字的人。甲是玩家，还是玩家的家人、上司、旧交，都可以。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场点不点头；也可以是堂下那个等银子的原告，或是被叫去操办那处神坛的人；也可以不在场，事后只看见案子已经结了。"
      },
      {
        "key": "这一套是怎么运作的",
        "value": "它先定下结论，再让所有能说话的东西去印证这个结论：病是假的，可保状是真的；批示是编的，可念出来的人是真的；银子是实的，拿了银子的人就再没有话说了。"
      },
      {
        "key": "甲为什么要答应",
        "value": "答应了这个案子就结了；不答应，原告还是要钱，被告还是要脱身，上面还会再来问一遍。甲答应与不答应，都要付代价。"
      },
      {
        "key": "抚恤银子是什么",
        "value": "一笔抚恤、一笔赔偿、一笔“从此不要再提”的钱。当场给现的，或者写一张欠条；数目可换，名义可换。"
      },
      {
        "key": "这是哪",
        "value": "任何有“结案”和“人情”的世界——衙门、法庭、公司、帮会、军队、宗族。神坛可以换成任何一种“上头的意思”：一份文件、一次通报、一句批示、一场发布会。"
      },
      {
        "key": "分类",
        "value": "这一版的“示警”是编排出来的，所以归现实类。若玩家这个世界真有神示，把它写成真的降示即可，骨架不变，改归奇幻类。"
      },
      {
        "key": "注意",
        "value": "卡停在“等甲点头”这一刻。不要写甲答应没有，也不要写原告拿了钱走没走。这一处神坛立起来之后，往后任何一件案子，都可以照这个样子办。"
      }
    ]
  },
  {
    "id": "C4-05-无人追赶",
    "number": "C4-05",
    "name": "无人追赶",
    "type": "纵放 / 逃脱",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-05-无人追赶.md",
    "face": "案子已经结了。卷上写着：凶犯在狱中得了无名之病，人已经不在了。原告当堂领了抚恤银子，在数，数完点头，就再没有话。\n\n同一天，城门口有一队人出城。行李细软、箱笼、家眷，都在车上。走的那一个，就是卷上写着“死了”的那一个。他和身边的人说笑，一路都不回头。\n\n没有一个人追。不是没有人知道，是没有人要追。\n\n甲的案头压着那份卷宗。封皮上写着结案的日子，墨还没干透。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是知道这卷卷宗是怎么回事的人——主办的人、经手的人、递过话的人、收过东西的人。不一定非要是官；记过账、传过话、开过门的人都算。甲可以是玩家。\n\n**玩家在哪**：玩家可以是甲，看着卷宗合上；也可以是死者那一头的人，站在城外看那队车走远；也可以不在场，事后才知道案子是这样结的。若玩家是被写死的那个人，卡的重点就变成“你带着家眷上了路，身后没有一个人来追”。\n\n**卷宗上写的是什么**：暴病身亡、在狱病故、畏罪自尽、下落不明。写的是哪一个无所谓，要紧的是：写下来的那个结果，和路上走着的那个人，是两回事。\n\n**原告怎么样了**：拿了银子，不再开口。银子可以多，可以少，也可以只写一张欠条。他未必服气，他只是算过账。\n\n**谁来追**：没有人。或者有人想追而追不了。若这个世界里还有人肯追，这张卡就还没完——追的人是谁，就是下一张卡。\n\n**这是哪**：任何有“卷宗”和“路”的世界——官府、法庭、公司、军队、行会。卷宗可以是案卷、报告、结案文件、一纸通告。\n\n**注意**：卡停在“墨还没干透”这一刻。不要写甲做了什么，也不要写这件事日后会不会翻出来。这一卡要的不是凶犯怎么逃，是那份卷宗就在甲手边，而它写的是假的。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是知道这卷卷宗是怎么回事的人——主办的人、经手的人、递过话的人、收过东西的人。不一定非要是官；记过账、传过话、开过门的人都算。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，看着卷宗合上；也可以是死者那一头的人，站在城外看那队车走远；也可以不在场，事后才知道案子是这样结的。若玩家是被写死的那个人，卡的重点就变成“你带着家眷上了路，身后没有一个人来追”。"
      },
      {
        "key": "卷宗上写的是什么",
        "value": "暴病身亡、在狱病故、畏罪自尽、下落不明。写的是哪一个无所谓，要紧的是：写下来的那个结果，和路上走着的那个人，是两回事。"
      },
      {
        "key": "原告怎么样了",
        "value": "拿了银子，不再开口。银子可以多，可以少，也可以只写一张欠条。他未必服气，他只是算过账。"
      },
      {
        "key": "谁来追",
        "value": "没有人。或者有人想追而追不了。若这个世界里还有人肯追，这张卡就还没完——追的人是谁，就是下一张卡。"
      },
      {
        "key": "这是哪",
        "value": "任何有“卷宗”和“路”的世界——官府、法庭、公司、军队、行会。卷宗可以是案卷、报告、结案文件、一纸通告。"
      },
      {
        "key": "注意",
        "value": "卡停在“墨还没干透”这一刻。不要写甲做了什么，也不要写这件事日后会不会翻出来。这一卡要的不是凶犯怎么逃，是那份卷宗就在甲手边，而它写的是假的。"
      }
    ]
  },
  {
    "id": "C4-06-知道底细的人",
    "number": "C4-06",
    "name": "知道底细的人",
    "type": "灭口 / 卸磨",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-06-知道底细的人.md",
    "face": "事情办完了。那个出主意的人比谁都高兴——他觉得自己立了功，从此就是甲身边的人了。他等着甲赏他，等着甲抬举他。他近来常在人前提起甲，提起他们从前是旧相识。\n\n甲开始挑他的错。先是小错，后来是大的。他做的事本来没有一件挑不出毛病。\n\n一道文书下来：把他远远地调走。不是罚，是“另有任用”。他接了文书，脸上的笑还没收干净。\n\n他走的那天，甲没有见他。他知道甲从前是什么人——知道得太多。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是被人知道底细的那个人——这一任的主事、升上来的人、有过去的人。也可以是玩家。要紧的是甲自己也不想被人提起来的那个地方。\n\n**玩家在哪**：玩家可以就是甲，决定怎么处置这个人；也可以是这个人，等着赏，等来的是一纸调令；也可以不在场，事后听说这个人被调走了，走了就再没有消息。\n\n**底细是什么**：甲从前穷过、低过头、受过谁的恩、欠过谁的钱、吃过谁家的饭；或者甲当年办事不干净，有人亲眼见过。不一定要大，但要紧。\n\n**他知道的还有什么**：他经手过这件案子的底，知道卷宗是假的。他手里有把柄，可他从没想过要拿它做什么——他只是想跟甲亲近。\n\n**为什么非调走不可**：他留在近处，早晚有一句话说出来。他不会害甲，他只会提起从前。而甲最怕的就是这个。\n\n**怎么调走**：远调、明升暗降、给个闲差、打发回乡、派去别处当差。手段可以体面，结果只有一个：这个人从此不在这。\n\n**这是哪**：任何有“上司”和“旧相识”的世界——官场、公司、军队、门派、家族。调令可以是调令、外派、升迁、辞退通知。\n\n**注意**：卡停在“他接了文书”这一刻。不要写他有没有察觉，也不要写甲日后会不会后悔。这一卡里没有恶人：一个想要好处，一个想要干净，两边都不过分。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是被人知道底细的那个人——这一任的主事、升上来的人、有过去的人。也可以是玩家。要紧的是甲自己也不想被人提起来的那个地方。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，决定怎么处置这个人；也可以是这个人，等着赏，等来的是一纸调令；也可以不在场，事后听说这个人被调走了，走了就再没有消息。"
      },
      {
        "key": "底细是什么",
        "value": "甲从前穷过、低过头、受过谁的恩、欠过谁的钱、吃过谁家的饭；或者甲当年办事不干净，有人亲眼见过。不一定要大，但要紧。"
      },
      {
        "key": "他知道的还有什么",
        "value": "他经手过这件案子的底，知道卷宗是假的。他手里有把柄，可他从没想过要拿它做什么——他只是想跟甲亲近。"
      },
      {
        "key": "为什么非调走不可",
        "value": "他留在近处，早晚有一句话说出来。他不会害甲，他只会提起从前。而甲最怕的就是这个。"
      },
      {
        "key": "怎么调走",
        "value": "远调、明升暗降、给个闲差、打发回乡、派去别处当差。手段可以体面，结果只有一个：这个人从此不在这。"
      },
      {
        "key": "这是哪",
        "value": "任何有“上司”和“旧相识”的世界——官场、公司、军队、门派、家族。调令可以是调令、外派、升迁、辞退通知。"
      },
      {
        "key": "注意",
        "value": "卡停在“他接了文书”这一刻。不要写他有没有察觉，也不要写甲日后会不会后悔。这一卡里没有恶人：一个想要好处，一个想要干净，两边都不过分。"
      }
    ]
  },
  {
    "id": "C4-07-刑不上身",
    "number": "C4-07",
    "name": "刑不上身",
    "type": "脱罪 / 财势",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-07-刑不上身.md",
    "face": "动手的人是个独子。家里只有这一个儿子，从小要什么给什么，长大了什么都不必学。\n\n他今天做了两件事：把一个人买了下来，又让人把另一个人打成重伤，抬回去，三天没救过来。做完这些，他上车，继续走他的路。\n\n家里有的是钱：铺子、田产、外面几处生意，还有领了多年的那份钱粮。他的母亲说，花上几个钱，没有不了的事。他自己也是这么说的。\n\n被打死的那一头，家里只剩下几房远支。他们收了一笔钱，也就没有话了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是能替这个人把事情摆平的人——他的母亲、管家、族里的长辈、拿钱办事的人；也可以是玩家。若玩家是挨打那一头的人，卡的重点就变成“你要不要收下这笔钱”。\n\n**玩家在哪**：玩家可以是出钱的一边，也可以是收钱的一边，也可以只是个旁观的人；若玩家是那个动手的人，卡的重点是“你并不觉得自己做了什么了不得的事”。\n\n**钱是怎么起作用的**：请人出面说一句、托一位有分量的人、递一笔钱、找一个人顶上。钱不必多，只要它能让人闭嘴，它就是管用的。\n\n**家里有钱，钱是什么**：几处生意、一份采买的名额、一处旧宅、一张清单。钱可以换成势、换成亲戚、换成一个没人敢动的姓氏。\n\n**被打死的人是谁**：一个独子，父母都不在了，守着一点薄产。他没有兄弟，没有靠山——这就是为什么是他死。\n\n**被杀的人怎么办**：收一笔抚恤银子、不再告、收一个顶罪的人、把案子拖着。哪一种都行，只要有人点头。\n\n**这是哪**：任何有“钱能办事”的世界——古代、现代、公司、门阀、殖民地。钱可以是银两、股份、一份合同、一个位子。\n\n**分类**：归现实类，因为因果只是钱与关系。若玩家这个世界里有“气数”“谶语”“上头偏袒这一家”这类东西，就归奇幻类，骨架不变。\n\n**注意**：卡停在“他们收了钱，没有话了”这一刻。不要写这个人日后怎么样，也不要写有没有人替死者出头。这一卡要写的是：他不是逃掉的，他是走掉的。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是能替这个人把事情摆平的人——他的母亲、管家、族里的长辈、拿钱办事的人；也可以是玩家。若玩家是挨打那一头的人，卡的重点就变成“你要不要收下这笔钱”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是出钱的一边，也可以是收钱的一边，也可以只是个旁观的人；若玩家是那个动手的人，卡的重点是“你并不觉得自己做了什么了不得的事”。"
      },
      {
        "key": "钱是怎么起作用的",
        "value": "请人出面说一句、托一位有分量的人、递一笔钱、找一个人顶上。钱不必多，只要它能让人闭嘴，它就是管用的。"
      },
      {
        "key": "家里有钱，钱是什么",
        "value": "几处生意、一份采买的名额、一处旧宅、一张清单。钱可以换成势、换成亲戚、换成一个没人敢动的姓氏。"
      },
      {
        "key": "被打死的人是谁",
        "value": "一个独子，父母都不在了，守着一点薄产。他没有兄弟，没有靠山——这就是为什么是他死。"
      },
      {
        "key": "被杀的人怎么办",
        "value": "收一笔抚恤银子、不再告、收一个顶罪的人、把案子拖着。哪一种都行，只要有人点头。"
      },
      {
        "key": "这是哪",
        "value": "任何有“钱能办事”的世界——古代、现代、公司、门阀、殖民地。钱可以是银两、股份、一份合同、一个位子。"
      },
      {
        "key": "分类",
        "value": "归现实类，因为因果只是钱与关系。若玩家这个世界里有“气数”“谶语”“上头偏袒这一家”这类东西，就归奇幻类，骨架不变。"
      },
      {
        "key": "注意",
        "value": "卡停在“他们收了钱，没有话了”这一刻。不要写这个人日后怎么样，也不要写有没有人替死者出头。这一卡要写的是：他不是逃掉的，他是走掉的。"
      }
    ]
  },
  {
    "id": "C4-08-多出来的那间房",
    "number": "C4-08",
    "name": "多出来的那间房",
    "type": "接纳 / 住处",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-08-多出来的那间房.md",
    "face": "一家人带着行李，在门外下了车。来的是一门亲戚——多年没见，先来看望，顺便住些日子。\n\n家里做主的人先开口，说的是他们家的事：“在外头住着，怕又要生事。家里空着的屋子有的是。”随后又把这一门亲戚往长辈面前引。\n\n那一边应了，却添一句：住可以，日用供给一概不要，这才住得长。\n\n一家人就都去看那间空着的房。房在院子的一角，前后差开，另有一道门通着街。空了很久。\n\n行李还在地上。谁住哪间，还没有定。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这处宅子的主人，或者家里说得上话的人；也可以是来投的那一门亲戚，拉着行李站在院里。若玩家是家里原先的孩子，卡的重点就变成“家里忽然多了一门人”。\n\n**玩家在哪**：玩家可以就是做主的人，当场应下或推掉；也可以是来投的那一个，站在别人的院子里；也可以不在场，回家才发现多了这门亲戚。\n\n**住处是什么**：一处偏院、一所空宅、一间耳房、一层楼、一栋只用来堆东西的房子。地方可以不大，但一定空着、一定成套、一定和主屋隔开。\n\n**为什么住进来**：亲戚之间彼此照应、走动不便、外头租住不安稳、为了看着自家不懂事的年轻人。理由可以换，两家都得了体面和好处，这一点不能换。\n\n**为什么不要供给**：来的人自认有钱，不愿欠人情；也因为不白吃白住，往后的日子说话才能硬。\n\n**住处的位置很要紧**：住得离主屋近，这家人就管得住他们；住得远、又开着门，就等于没有管。\n\n**这是哪**：任何有“亲戚寄住”的世界——宅门、大族、单位宿舍、合租的楼、寄宿的学校。宅子可以是院、是楼、是小区、是营房。\n\n**注意**：卡停在“行李还在地上”这一刻。不要写这门亲戚日后住得好不好，也不要写两家人合不合得来。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这处宅子的主人，或者家里说得上话的人；也可以是来投的那一门亲戚，拉着行李站在院里。若玩家是家里原先的孩子，卡的重点就变成“家里忽然多了一门人”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是做主的人，当场应下或推掉；也可以是来投的那一个，站在别人的院子里；也可以不在场，回家才发现多了这门亲戚。"
      },
      {
        "key": "住处是什么",
        "value": "一处偏院、一所空宅、一间耳房、一层楼、一栋只用来堆东西的房子。地方可以不大，但一定空着、一定成套、一定和主屋隔开。"
      },
      {
        "key": "为什么住进来",
        "value": "亲戚之间彼此照应、走动不便、外头租住不安稳、为了看着自家不懂事的年轻人。理由可以换，两家都得了体面和好处，这一点不能换。"
      },
      {
        "key": "为什么不要供给",
        "value": "来的人自认有钱，不愿欠人情；也因为不白吃白住，往后的日子说话才能硬。"
      },
      {
        "key": "住处的位置很要紧",
        "value": "住得离主屋近，这家人就管得住他们；住得远、又开着门，就等于没有管。"
      },
      {
        "key": "这是哪",
        "value": "任何有“亲戚寄住”的世界——宅门、大族、单位宿舍、合租的楼、寄宿的学校。宅子可以是院、是楼、是小区、是营房。"
      },
      {
        "key": "注意",
        "value": "卡停在“行李还在地上”这一刻。不要写这门亲戚日后住得好不好，也不要写两家人合不合得来。"
      }
    ]
  },
  {
    "id": "C4-09-门户自立",
    "number": "C4-09",
    "name": "门户自立",
    "type": "往来 / 学坏",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第四回",
    "rel": "红楼梦/现实类/第四回/C4-09-门户自立.md",
    "face": "住进来的这一家，儿子起初是不愿意的。他怕这里有人管他，过得不自在，几次三番要搬出去。\n\n母亲不肯走。这边也留得诚心。他就留下了，嘴里说：等自家房子收拾出来再搬。这话他说了一个月。\n\n这间房另有一道门，通着街。他的下人从这道门进出。族里的年轻人知道了他，一个带一个，今日吃酒，明日看花，后来还有更不像话的。\n\n一个月下来，他把搬出去的念头忘干净了。他比在家时更不像样。这边的人照管不到——一个是因为人多，一个是因为这道门。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是留下来、住进去的那个人，也可以是这处宅子里做主的人，或者是那个一天天看着他变样、却不好开口的人。甲可以是玩家。\n\n**玩家在哪**：玩家可以就是住进来的年轻人，一天天被叫出去；也可以是这家原先的孩子，眼看着新来的人成了那一伙里的一个；也可以不在场，事后从别人嘴里听说这人现在什么名声。\n\n**那道门是什么**：一道通街的侧门、一个独立出入的单元、一扇后门、一张自己的钥匙、一条不经过主屋的路。门本身没有错，门让人不必报备。\n\n**谁把他带走的**：族里、邻里的年轻人，一群不肯读书、手里有钱的人。他们不去拉他，他们只是叫上他。\n\n**为什么管不住**：家里人太多，照管不到；宅子分了几层，各过各的；这里当家的人只爱看书下棋，不爱管俗事；他住的地方另开门，出入不必经过谁。\n\n**留下来其实是母亲替他定的**：母亲想住得近一点，好拘住他。她算对了一半：住得近，她看得见他；管不管得住，是另一回事。\n\n**这是哪**：任何有“搬去和亲戚同住”的世界——大族、宿舍、合租、借住。年轻人被带坏的方式随时代变，被带坏这件事不变。\n\n**注意**：卡停在“他把搬出去的念头忘干净了”这一刻。不要写他后来闯出什么祸，也不要写家里人怎么后悔。这张卡只要一句：这道门，是当初留他住下的时候就给了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是留下来、住进去的那个人，也可以是这处宅子里做主的人，或者是那个一天天看着他变样、却不好开口的人。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是住进来的年轻人，一天天被叫出去；也可以是这家原先的孩子，眼看着新来的人成了那一伙里的一个；也可以不在场，事后从别人嘴里听说这人现在什么名声。"
      },
      {
        "key": "那道门是什么",
        "value": "一道通街的侧门、一个独立出入的单元、一扇后门、一张自己的钥匙、一条不经过主屋的路。门本身没有错，门让人不必报备。"
      },
      {
        "key": "谁把他带走的",
        "value": "族里、邻里的年轻人，一群不肯读书、手里有钱的人。他们不去拉他，他们只是叫上他。"
      },
      {
        "key": "为什么管不住",
        "value": "家里人太多，照管不到；宅子分了几层，各过各的；这里当家的人只爱看书下棋，不爱管俗事；他住的地方另开门，出入不必经过谁。"
      },
      {
        "key": "留下来其实是母亲替他定的",
        "value": "母亲想住得近一点，好拘住他。她算对了一半：住得近，她看得见他；管不管得住，是另一回事。"
      },
      {
        "key": "这是哪",
        "value": "任何有“搬去和亲戚同住”的世界——大族、宿舍、合租、借住。年轻人被带坏的方式随时代变，被带坏这件事不变。"
      },
      {
        "key": "注意",
        "value": "卡停在“他把搬出去的念头忘干净了”这一刻。不要写他后来闯出什么祸，也不要写家里人怎么后悔。这张卡只要一句：这道门，是当初留他住下的时候就给了。"
      }
    ]
  },
  {
    "id": "C5-01-不肯进去",
    "number": "C5-01",
    "name": "不肯进去",
    "type": "拒绝 / 扫兴",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第五回",
    "rel": "红楼梦/现实类/第五回/C5-01-不肯进去.md",
    "face": "甲在别人家里做客。坐了大半日，倦了，想歇一歇。\n\n主人马上说：有现成的屋子，早收拾好了。她亲自带路，一路穿过好几进，停在一间屋子门口。屋子是预备给贵客的，铺陈都新。\n\n甲进门，抬头看了一眼墙上挂着的东西，又低下头看了一行字。\n\n他的脸沉下来。\n\n“快出去，快出去。”他说，“我不在这儿睡。”\n\n他说着已经退到了门槛外。主人站在门口，脸上还挂着笑，手没有放下来。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这个不肯进去的人——也可以是玩家，或者玩家的配偶、家人、孩子、朋友。甲的身份最好是“有资格挑剔的客人”：长辈疼他，别人才不好当场发作。\n\n**玩家在哪**：玩家可以是甲，当场把“不”说出口；可以是主人，站在门口收拾这个场面；也可以不在场，事后听人嚼舌根。若玩家是那间屋子的管事人，卡的重点就变成“屋子是你收拾的，现在客人不肯进”。\n\n**那间屋子是什么**：客舍、书房、正房、别人的卧房、一间比甲自家还讲究的屋子。屋子本身没有问题——问题在墙上和案上那些东西说了话。它可以是一幅画、一副对联、一句话、一件摆设、一份留下来的规矩、一个已经摆好的位子。\n\n**甲为什么不肯进**：那些字画和摆设，正好说的是“怎么在这世上吃饭、怎么做人”。甲看不上这一套；也怕看多了，自己就变成这一套；更怕的是，主人早就把他当成这一套里的人。\n\n**主人是谁**：当家的人、管事的媳妇、本家的长辈、接待的人。她安排得没有错处，所以她被驳得最难看。\n\n**让的是什么**：一间最好的屋子，也常常是一间“给你定了位子”的屋子。进去休息是小事，认下这个位子是大事。\n\n**这是哪**：任何有“待客”和“屋子”的世界——宅子、公馆、宿舍、客栈、船上、大宅门里的客房。\n\n**注意**：卡停在“甲退到门槛外，主人手还举着”这一刻。不要写主人怎么下台，也不要写甲最后睡在哪儿。这一退，主客之间就有了账——甲驳的是屋子，主人记的是自己。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这个不肯进去的人——也可以是玩家，或者玩家的配偶、家人、孩子、朋友。甲的身份最好是“有资格挑剔的客人”：长辈疼他，别人才不好当场发作。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当场把“不”说出口；可以是主人，站在门口收拾这个场面；也可以不在场，事后听人嚼舌根。若玩家是那间屋子的管事人，卡的重点就变成“屋子是你收拾的，现在客人不肯进”。"
      },
      {
        "key": "那间屋子是什么",
        "value": "客舍、书房、正房、别人的卧房、一间比甲自家还讲究的屋子。屋子本身没有问题——问题在墙上和案上那些东西说了话。它可以是一幅画、一副对联、一句话、一件摆设、一份留下来的规矩、一个已经摆好的位子。"
      },
      {
        "key": "甲为什么不肯进",
        "value": "那些字画和摆设，正好说的是“怎么在这世上吃饭、怎么做人”。甲看不上这一套；也怕看多了，自己就变成这一套；更怕的是，主人早就把他当成这一套里的人。"
      },
      {
        "key": "主人是谁",
        "value": "当家的人、管事的媳妇、本家的长辈、接待的人。她安排得没有错处，所以她被驳得最难看。"
      },
      {
        "key": "让的是什么",
        "value": "一间最好的屋子，也常常是一间“给你定了位子”的屋子。进去休息是小事，认下这个位子是大事。"
      },
      {
        "key": "这是哪",
        "value": "任何有“待客”和“屋子”的世界——宅子、公馆、宿舍、客栈、船上、大宅门里的客房。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲退到门槛外，主人手还举着”这一刻。不要写主人怎么下台，也不要写甲最后睡在哪儿。这一退，主客之间就有了账——甲驳的是屋子，主人记的是自己。"
      }
    ]
  },
  {
    "id": "C5-02-不该看的那一页",
    "number": "C5-02",
    "name": "不该看的那一页",
    "type": "知情 / 半截消息",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第五回",
    "rel": "红楼梦/现实类/第五回/C5-02-不该看的那一页.md",
    "face": "甲在别人家里做客，被留在一间屋里等着。屋里只剩他一个人。\n\n桌上放着一份东西。锁过，压过，主人临走前说过一句：“这个别动。”\n\n甲翻开了。\n\n里面记着很多人，一个人一行，写得很简，也很不全：有人离散，有人病着，有人已经没了。记的都是他认得的那些名字。\n\n甲看了一遍，又一遍。他每行字都认得，连起来却不懂——写的是谁，什么时候，怎么算。\n\n门开了。主人进来，看见他手里的东西。\n\n她一句话没说，走过来，把册子合上，放回原处。\n\n“这个不该给你看。”",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个翻了东西的人——可以是玩家，也可以是玩家的孩子、家人、朋友。甲要有一个特点：别人越说“别动”，他越想动。\n\n**玩家在哪**：玩家可以是甲，当场被人撞见；可以是回来撞见的那个人，你得决定说不说破；也可以不在场，事后发现东西被人动过。若玩家就是主人，卡的重点变成“**你手里那份东西，要不要给他一句解释**”。\n\n**那份东西是什么**：一份名册、一本账、一叠档案、一份名单、一本旧信、一页病历、一张纸。它是记人的，记的是甲认得的那些人。\n\n**为什么不该给他看**：写字的规矩本来就是“只给管事的人看”；里面有些话还没定；有些话是别人告诉主人的；也有些话，主人自己也不想面对。\n\n**为什么他看不懂**：写得太简，只有日期和结果，没有缘由；写的是官面上的话、避讳的话、别人的口吻；或者他看着的正是自己最亲的那几个人，所以他不敢往那上头想。\n\n**这件事留下什么**：他知道了有“这么一份东西”存在。册子上那几行字，日后可以一件一件对上——那就成了一句要还的话；也对不上——那就是一场白操心。\n\n**这是哪**：任何有“书面记录”和“不该给人看的字”的世界——宅门、官府、公司、医院、学校、部队、宗族祠堂。\n\n**注意**：卡停在“册子被合上，放回原处”这一刻。不要写甲读懂了什么，也不要写那些字后来应验没有。留在桌上的是这件事：**有人早就把这些事记在纸上了，而没打算让他知道**。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个翻了东西的人——可以是玩家，也可以是玩家的孩子、家人、朋友。甲要有一个特点：别人越说“别动”，他越想动。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当场被人撞见；可以是回来撞见的那个人，你得决定说不说破；也可以不在场，事后发现东西被人动过。若玩家就是主人，卡的重点变成“**你手里那份东西，要不要给他一句解释**”。"
      },
      {
        "key": "那份东西是什么",
        "value": "一份名册、一本账、一叠档案、一份名单、一本旧信、一页病历、一张纸。它是记人的，记的是甲认得的那些人。"
      },
      {
        "key": "为什么不该给他看",
        "value": "写字的规矩本来就是“只给管事的人看”；里面有些话还没定；有些话是别人告诉主人的；也有些话，主人自己也不想面对。"
      },
      {
        "key": "为什么他看不懂",
        "value": "写得太简，只有日期和结果，没有缘由；写的是官面上的话、避讳的话、别人的口吻；或者他看着的正是自己最亲的那几个人，所以他不敢往那上头想。"
      },
      {
        "key": "这件事留下什么",
        "value": "他知道了有“这么一份东西”存在。册子上那几行字，日后可以一件一件对上——那就成了一句要还的话；也对不上——那就是一场白操心。"
      },
      {
        "key": "这是哪",
        "value": "任何有“书面记录”和“不该给人看的字”的世界——宅门、官府、公司、医院、学校、部队、宗族祠堂。"
      },
      {
        "key": "注意",
        "value": "卡停在“册子被合上，放回原处”这一刻。不要写甲读懂了什么，也不要写那些字后来应验没有。留在桌上的是这件事：**有人早就把这些事记在纸上了，而没打算让他知道**。"
      }
    ]
  },
  {
    "id": "C5-03-听不进去",
    "number": "C5-03",
    "name": "听不进去",
    "type": "劝说 / 落空",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第五回",
    "rel": "红楼梦/现实类/第五回/C5-03-听不进去.md",
    "face": "有人把甲叫到一边，要跟他好好说几句话。\n\n那人是替别人来的——替一个不便亲自开口的人。她把话一条一条摆出来：你这样下去不行；你的路是有人给你铺好的；你身边那些人，日后个个都要靠你。\n\n她说的每一句都对。说的那些人，甲也都认得。\n\n甲听着，点头，也笑。他一句都没听进去。\n\n那人说完，看他还笑着，叹了一声。\n\n“我白说了。”",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个被劝的人——可以是玩家，也可以是玩家的孩子、家人、朋友、学生、病人。甲不需要笨，只需要**从来没吃过亏**。\n\n**玩家在哪**：玩家可以是甲，坐在原地听；可以是来劝的人，明知说了没用还得说；也可以是背后那个请人来劝的人，你在远处等一句话回话。若玩家不在场，事后他可以听人转述这场谈话——转述的时候，话已经变成了“大家都说过他了，他不听”。\n\n**来劝的人是谁**：长辈、师父、兄长、受托的亲戚、看护他的人、替人传话的中间人。她的位置比她的话更要紧——她自己也是拿这一家的钱吃饭的。\n\n**她替谁说话**：一个不便亲自开口的人：父亲、家长、族里、上面的人。话越重，她越难说。\n\n**她劝的是什么**：别跟那些人混、该念的书得念、该担的事得担、将来一家人都指着他。核心是：**这是一条已经铺好的路，你不走，别人就要替你付代价。**\n\n**为什么听不进去**：年纪小；没吃过亏；一直有人护着；或者他根本不在乎这条路通向哪里。\n\n**代价落在谁身上**：甲不听，代价先落在替他操心的人身上——她白说了，而且这话是她自己答应来传的。\n\n**这是哪**：任何有“被寄予希望的人”和“替他操心的人”的世界——家塾、门第、公司、球队、剧团、师徒。\n\n**注意**：卡停在“那人叹了一声”这一刻。不要写甲以后有没有后悔，也不要写这一家后来怎么办。留在桌上的是这件事：**有人把话已经说到他脸上了，他还是没听**。若这一场之后还要再劝，就换人、换方式、换代价——不要重复同一张卡。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个被劝的人——可以是玩家，也可以是玩家的孩子、家人、朋友、学生、病人。甲不需要笨，只需要**从来没吃过亏**。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，坐在原地听；可以是来劝的人，明知说了没用还得说；也可以是背后那个请人来劝的人，你在远处等一句话回话。若玩家不在场，事后他可以听人转述这场谈话——转述的时候，话已经变成了“大家都说过他了，他不听”。"
      },
      {
        "key": "来劝的人是谁",
        "value": "长辈、师父、兄长、受托的亲戚、看护他的人、替人传话的中间人。她的位置比她的话更要紧——她自己也是拿这一家的钱吃饭的。"
      },
      {
        "key": "她替谁说话",
        "value": "一个不便亲自开口的人：父亲、家长、族里、上面的人。话越重，她越难说。"
      },
      {
        "key": "她劝的是什么",
        "value": "别跟那些人混、该念的书得念、该担的事得担、将来一家人都指着他。核心是：**这是一条已经铺好的路，你不走，别人就要替你付代价。**"
      },
      {
        "key": "为什么听不进去",
        "value": "年纪小；没吃过亏；一直有人护着；或者他根本不在乎这条路通向哪里。"
      },
      {
        "key": "代价落在谁身上",
        "value": "甲不听，代价先落在替他操心的人身上——她白说了，而且这话是她自己答应来传的。"
      },
      {
        "key": "这是哪",
        "value": "任何有“被寄予希望的人”和“替他操心的人”的世界——家塾、门第、公司、球队、剧团、师徒。"
      },
      {
        "key": "注意",
        "value": "卡停在“那人叹了一声”这一刻。不要写甲以后有没有后悔，也不要写这一家后来怎么办。留在桌上的是这件事：**有人把话已经说到他脸上了，他还是没听**。若这一场之后还要再劝，就换人、换方式、换代价——不要重复同一张卡。"
      }
    ]
  },
  {
    "id": "C5-04-安排了一个人",
    "number": "C5-04",
    "name": "安排了一个人",
    "type": "期许 / 被安排",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第五回",
    "rel": "红楼梦/现实类/第五回/C5-04-安排了一个人.md",
    "face": "甲平时的事，家里一向不管。这一回，家里忽然替他做了一件事。\n\n有人把他领到一处地方，说：进去吧。\n\n屋里已经有人了。是个年轻女人，指甲修得干净，见他进来，站起来，又坐回去。边上坐着两个长辈，谁都不看甲。\n\n甲这才知道是什么事——已经说定了，只是没人告诉过他。\n\n有人从外头把门掩上。屋里的人都在等他开口。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个被安排的人——可以是玩家，也可以是玩家的孩子、家人、朋友。甲在这个世界里有个身份：他被寄予希望，所以别人有权替他安排日常。\n\n**玩家在哪**：玩家可以是甲，当场挑明或者忍着；可以是屋里那个女人，你也是被叫来的，没人问过你；可以是掩门的那个下人，你只是照吩咐办事；也可以不在场，事后才知道“家里已经替你定了”。\n\n**做这件事的人是谁**：长辈、父亲、族里、师父、东家、媒人。动机可以很正：怕他废掉，怕他没人管，要给这一家留一条后。他们不问甲愿不愿意。\n\n**那个女人是谁**：一个真有其人的姑娘——甲见过、敬着、或者根本不该提。也可以是甲不认识的人：家里看中她的门第或她的能干，与他无关。\n\n**为什么没人告诉甲**：告诉了怕他闹；觉得他年纪不到、不必问；或者这件事本来就是两家大人之间的账，与他没多大关系。\n\n**代价**：答应，就是一辈子的关系，从此欠两家人的情；不答应，就是当众驳长辈的面，那位姑娘也白白被推到这里坐了一回。\n\n**掩门是什么意思**：有人希望这件事“当场成”——把话说完、把人认下，回去好交代。门从外头掩上，屋里的人就没有退路了。\n\n**这是哪**：任何有“家里做主”的世界——说亲、议婚、相亲、联姻、招赘、入赘、拜师、过继、一份替人签下的合约。\n\n**注意**：卡停在“门从外头掩上，屋里的人都在等他开口”这一刻。不要写甲答不答应，也不要写这门亲事最后成没成。这张卡真正压下去的东西在下一张：**这件事从此刻起，已经不再是甲一个人的事了**。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个被安排的人——可以是玩家，也可以是玩家的孩子、家人、朋友。甲在这个世界里有个身份：他被寄予希望，所以别人有权替他安排日常。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当场挑明或者忍着；可以是屋里那个女人，你也是被叫来的，没人问过你；可以是掩门的那个下人，你只是照吩咐办事；也可以不在场，事后才知道“家里已经替你定了”。"
      },
      {
        "key": "做这件事的人是谁",
        "value": "长辈、父亲、族里、师父、东家、媒人。动机可以很正：怕他废掉，怕他没人管，要给这一家留一条后。他们不问甲愿不愿意。"
      },
      {
        "key": "那个女人是谁",
        "value": "一个真有其人的姑娘——甲见过、敬着、或者根本不该提。也可以是甲不认识的人：家里看中她的门第或她的能干，与他无关。"
      },
      {
        "key": "为什么没人告诉甲",
        "value": "告诉了怕他闹；觉得他年纪不到、不必问；或者这件事本来就是两家大人之间的账，与他没多大关系。"
      },
      {
        "key": "代价",
        "value": "答应，就是一辈子的关系，从此欠两家人的情；不答应，就是当众驳长辈的面，那位姑娘也白白被推到这里坐了一回。"
      },
      {
        "key": "掩门是什么意思",
        "value": "有人希望这件事“当场成”——把话说完、把人认下，回去好交代。门从外头掩上，屋里的人就没有退路了。"
      },
      {
        "key": "这是哪",
        "value": "任何有“家里做主”的世界——说亲、议婚、相亲、联姻、招赘、入赘、拜师、过继、一份替人签下的合约。"
      },
      {
        "key": "注意",
        "value": "卡停在“门从外头掩上，屋里的人都在等他开口”这一刻。不要写甲答不答应，也不要写这门亲事最后成没成。这张卡真正压下去的东西在下一张：**这件事从此刻起，已经不再是甲一个人的事了**。"
      }
    ]
  },
  {
    "id": "C5-05-喊出来的名字",
    "number": "C5-05",
    "name": "喊出来的名字",
    "type": "失口 / 暴露",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第五回",
    "rel": "红楼梦/现实类/第五回/C5-05-喊出来的名字.md",
    "face": "甲睡得很不安稳。一屋子的人也都没睡好。\n\n他在梦里往前走。前面没有路了。一道黑水横过来，没有桥。他正站着，水里伸出许多只手，抓住他，往下拖。\n\n甲喊了一声。喊的不是“救命”，是一个名字。\n\n一个他醒着的时候从来叫不出口的名字。\n\n他醒了。一屋子的人正按着他，替他擦汗，说没事了没事了。\n\n屋外，那个人正站着。她听见了。\n\n她自己也纳闷：她这个小名，这家里没有人知道。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个喊出名字的人——可以是玩家，也可以是玩家的孩子、家人、朋友。甲自己并不知道自己叫了谁，甚至不记得做过这个梦。\n\n**玩家在哪**：玩家可以是甲，被人按着醒来，一屋子人都看着你；可以是屋外那个人，你没有进过那间屋，却听见有人叫你；可以就是屋里按着他的一个人，你听见了那个名字；也可以不在场，事后从下人嘴里听说“他睡糊涂了，喊了一个名字”。若玩家是屋外那个人，卡的重点就变成“**你知道他叫的是你，可你不敢认**”。\n\n**那个名字是谁的**：一个不该被叫的人。长辈、亲戚、已经嫁人的人、辈分不对的人、做过下人的人、已经死了的人。问题的关键不在名字本身，而在**这个家里不许提这个名字**。\n\n**为什么家里不许提**：辈分、门第、旧事、死过人、失过势。忌得越重，这一声越响。\n\n**甲是怎么叫出来的**：高热、梦魇、醉话、说梦话、手术台上没醒透、被人劝着说的话。不必有托梦，也不必有什么东西在水里等他——他就是自己做了一个噩梦。\n\n**谁听见了**：按着他的丫鬟下人、屋外的本人、隔壁的长辈、来看热闹的亲戚。听见的人越多，这件事越藏不住。\n\n**她为什么知道“没人知道她这个小名”**：她进这个家的时候，用的是另一个称呼。有人给她改过名，有人不许人叫旧名。\n\n**这是哪**：任何有“忌讳”和“睡不安稳的人”的世界——大家宅、军营、修道院、寄宿学校、公司宿舍。\n\n**注意**：卡停在“她也听见了，她也纳闷”这一刻。不要写她进不进屋，也不要写甲知不知道。留下来的是一条谁都不能承认的线：屋里这个人，和屋外这个人，因为这一声，从此有了关系——而且两个人都作不了主。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个喊出名字的人——可以是玩家，也可以是玩家的孩子、家人、朋友。甲自己并不知道自己叫了谁，甚至不记得做过这个梦。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，被人按着醒来，一屋子人都看着你；可以是屋外那个人，你没有进过那间屋，却听见有人叫你；可以就是屋里按着他的一个人，你听见了那个名字；也可以不在场，事后从下人嘴里听说“他睡糊涂了，喊了一个名字”。若玩家是屋外那个人，卡的重点就变成“**你知道他叫的是你，可你不敢认**”。"
      },
      {
        "key": "那个名字是谁的",
        "value": "一个不该被叫的人。长辈、亲戚、已经嫁人的人、辈分不对的人、做过下人的人、已经死了的人。问题的关键不在名字本身，而在**这个家里不许提这个名字**。"
      },
      {
        "key": "为什么家里不许提",
        "value": "辈分、门第、旧事、死过人、失过势。忌得越重，这一声越响。"
      },
      {
        "key": "甲是怎么叫出来的",
        "value": "高热、梦魇、醉话、说梦话、手术台上没醒透、被人劝着说的话。不必有托梦，也不必有什么东西在水里等他——他就是自己做了一个噩梦。"
      },
      {
        "key": "谁听见了",
        "value": "按着他的丫鬟下人、屋外的本人、隔壁的长辈、来看热闹的亲戚。听见的人越多，这件事越藏不住。"
      },
      {
        "key": "她为什么知道“没人知道她这个小名”",
        "value": "她进这个家的时候，用的是另一个称呼。有人给她改过名，有人不许人叫旧名。"
      },
      {
        "key": "这是哪",
        "value": "任何有“忌讳”和“睡不安稳的人”的世界——大家宅、军营、修道院、寄宿学校、公司宿舍。"
      },
      {
        "key": "注意",
        "value": "卡停在“她也听见了，她也纳闷”这一刻。不要写她进不进屋，也不要写甲知不知道。留下来的是一条谁都不能承认的线：屋里这个人，和屋外这个人，因为这一声，从此有了关系——而且两个人都作不了主。"
      }
    ]
  },
  {
    "id": "C6-01-冷灶",
    "number": "C6-01",
    "name": "冷灶",
    "type": "贫寒 / 冬事",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-01-冷灶.md",
    "face": "天冷下来了。这一家人的过冬的东西，一样都还没有备下：炭、粮、一家人的冬衣，全没有着落。\n\n男人吃了几杯闷酒，在家里找气生。妻子不敢接话。饭桌上一句话都没有。\n\n长辈看不过去，说了一句：坐着生气没用，得想个法子。\n\n男人把杯子一放：我又没有做官的朋友、有钱的亲戚，有什么法子可想？就有，人家也未必来理我们。\n\n屋里就静了。孩子还不知道出了什么事，只是觉出大人都不说话了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这一家养家、拿主意的人——父亲、兄长、户主、家里挣钱的那个。他不必是坏人，只是手里空了，脾气就上来了。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，是这家的一员，听着这场争吵；也可以不在场，事后从家人嘴里听来。如果玩家就是甲，卡的重点就变成“你手里没有东西，怎么面对这一屋子的冬天”。\n\n**这一家缺什么**：过冬的燃料、口粮、御寒的衣物、一笔到期要还的钱、一份要交的租。缺一件就够，不必全缺。\n\n**钱去哪了**：上一次收成不好、做买卖亏了、家里有人长年生病、还一笔旧账。不必解释清楚，只让人知道：以前不是这样。\n\n**长辈是谁**：家里最老的那个人——母亲、岳母、寡居的姑母、跟这一家过活的外人。她比谁都清楚这家还有哪条人脉可走。她的话是这张卡的引线。\n\n**这是哪**：任何会过冬、会欠债的地方：村庄、城中贫民区、破产的公司、断供的房子、补给将尽的前哨。\n\n**注意**：卡停在“屋里静了”这一刻。不要写甲最后想通了什么，也不要写这家到底有没有去求人。缺什么、谁去开口，留给桌上的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这一家养家、拿主意的人——父亲、兄长、户主、家里挣钱的那个。他不必是坏人，只是手里空了，脾气就上来了。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是这家的一员，听着这场争吵；也可以不在场，事后从家人嘴里听来。如果玩家就是甲，卡的重点就变成“你手里没有东西，怎么面对这一屋子的冬天”。"
      },
      {
        "key": "这一家缺什么",
        "value": "过冬的燃料、口粮、御寒的衣物、一笔到期要还的钱、一份要交的租。缺一件就够，不必全缺。"
      },
      {
        "key": "钱去哪了",
        "value": "上一次收成不好、做买卖亏了、家里有人长年生病、还一笔旧账。不必解释清楚，只让人知道：以前不是这样。"
      },
      {
        "key": "长辈是谁",
        "value": "家里最老的那个人——母亲、岳母、寡居的姑母、跟这一家过活的外人。她比谁都清楚这家还有哪条人脉可走。她的话是这张卡的引线。"
      },
      {
        "key": "这是哪",
        "value": "任何会过冬、会欠债的地方：村庄、城中贫民区、破产的公司、断供的房子、补给将尽的前哨。"
      },
      {
        "key": "注意",
        "value": "卡停在“屋里静了”这一刻。不要写甲最后想通了什么，也不要写这家到底有没有去求人。缺什么、谁去开口，留给桌上的人。"
      }
    ]
  },
  {
    "id": "C6-02-递话",
    "number": "C6-02",
    "name": "递话",
    "type": "人情 / 攀附",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-02-递话.md",
    "face": "长辈把话挑明了。她说：早年间咱们和那户人家是一家子——人家得势的时候凑上去认的。如今他们过得很好，家主夫人性子爽快，不拿架子，又向来肯接济人。\n\n不如去走动走动。只要她发一点好心，从指头缝里漏一点出来，就够咱们吃一年。\n\n家里人各有各的话：这样一张脸，怎么上人家的门。门上的人只怕连通报都不肯。白跑一趟，还落一场没脸。\n\n家里的男人把话听到这里，转过头对长辈说：既然你老人家当年见过她，明日就你走一趟，先去试试。\n\n屋里没人再说话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是家里提出这条路的人——长辈、老人、旧仆、当年跟着去过一次的那个人。甲提出，就等于甲把自己放在了要去的那一头。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，是听这番话的一员；也可以不在场，第二天清早才知道家里已经定了这件事。如果玩家就是被推出去的那个人，卡的重点就变成“话说出口了，你走不走”。\n\n**那户人家是谁**：和这一家有“名分上没有、嘴上认过”的关系——认过的干亲、连过宗的同姓、拆伙多年的合伙人、父辈的老上级、早就断了的旧交。关系越虚，开口越难。\n\n**这条关系的底子**：当年凑上去是图人家的势；人家也乐意多一门亲戚。如今这一家败了，就不敢上门了。这不是恩情，是旧账。\n\n**为什么是她去**：家里的男人不能去（放不下脸，或者拿不出手），年轻媳妇不能去（不好出面）。只剩一个上了年纪的人，脸皮厚一点，输得起。谁去，就等于谁替全家去丢这个人。\n\n**家里人怕什么**：怕被门房拦住，怕被认不出来，怕被人当成打秋风的，怕当面被人接济之后，往后再也抬不起头。\n\n**这是哪**：任何“穷亲戚上门”成立的世界：宗族、老同学、前东家、同乡会、旧同事、当年一起共过事的人。\n\n**注意**：卡停在“屋里没人再说话”这一刻。不要写这个人答应没答应，也不要写她第二天有没有出门。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是家里提出这条路的人——长辈、老人、旧仆、当年跟着去过一次的那个人。甲提出，就等于甲把自己放在了要去的那一头。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是听这番话的一员；也可以不在场，第二天清早才知道家里已经定了这件事。如果玩家就是被推出去的那个人，卡的重点就变成“话说出口了，你走不走”。"
      },
      {
        "key": "那户人家是谁",
        "value": "和这一家有“名分上没有、嘴上认过”的关系——认过的干亲、连过宗的同姓、拆伙多年的合伙人、父辈的老上级、早就断了的旧交。关系越虚，开口越难。"
      },
      {
        "key": "这条关系的底子",
        "value": "当年凑上去是图人家的势；人家也乐意多一门亲戚。如今这一家败了，就不敢上门了。这不是恩情，是旧账。"
      },
      {
        "key": "为什么是她去",
        "value": "家里的男人不能去（放不下脸，或者拿不出手），年轻媳妇不能去（不好出面）。只剩一个上了年纪的人，脸皮厚一点，输得起。谁去，就等于谁替全家去丢这个人。"
      },
      {
        "key": "家里人怕什么",
        "value": "怕被门房拦住，怕被认不出来，怕被人当成打秋风的，怕当面被人接济之后，往后再也抬不起头。"
      },
      {
        "key": "这是哪",
        "value": "任何“穷亲戚上门”成立的世界：宗族、老同学、前东家、同乡会、旧同事、当年一起共过事的人。"
      },
      {
        "key": "注意",
        "value": "卡停在“屋里没人再说话”这一刻。不要写这个人答应没答应，也不要写她第二天有没有出门。"
      }
    ]
  },
  {
    "id": "C6-03-门槛",
    "number": "C6-03",
    "name": "门槛",
    "type": "求门 / 闭门羹",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-03-门槛.md",
    "face": "天没亮，甲就起来梳洗了。带的东西只有一样：一个孩子，大的小的都行，只是要听话。教了他几句话，就出门了。\n\n到了那户人家的门前，甲站住了。门前的车马排得满满的，进出的都是不认得的人。甲不敢过去，退到墙根，把衣服掸了又掸，又把孩子的话教了一遍。\n\n甲溜到侧门，赔笑开口：想找府上的某位管事。\n\n门上几个人坐着，说东谈西，看也不看甲。甲等了半天，才有一句回话：你远远的，去那墙根底下等着。\n\n旁边一个年老的看不下去，说了一句实话——那人不在，往后头那条街上去问吧。\n\n甲谢过，牵着孩子，绕到后门去了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是上门求人的那个人，多半还带着一个孩子同行——孩子是通行证，也是众目睽睽下的把柄。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，是那个被牵着的人、或者门口看车马的人；也可以不在场，只听说家里有人天没亮就出门了。如果玩家就是甲，卡的重点就变成“站在那扇门前，你开不开口；开一次口，被晾在墙根，你还说不说第二次”。\n\n**门口的人是谁**：不是恶人，是门房，是靠“让谁进、不让谁进”吃饭的人。他们一眼就分得出来谁是来办事的、谁是来求人的。有人会拦你，有人会给你指错路，也有一个人会顺手说一句真话——这一句真话，常常决定这天白跑不白跑。\n\n**为什么要找那个人**：门里真正说得上话的人，甲一个都不认得。中间人认识的人也未必在家，于是只剩在门口耗着这一条路。\n\n**为什么把孩子带上**：孩子让这趟行程看起来像走亲戚，不像讨钱；孩子也是当着人的面顶着这份难堪的凭证。\n\n**这扇门是什么样的**：豪门、大宅、衙门、公司大楼、医院、领事馆、某个组织的接待处。门槛越高，门口的几句话越要紧。\n\n**这是哪**：任何“要见里面的人，得先过外面的人”的地方。这一场不需要时代和地点，只需要一个有门房的门。\n\n**注意**：卡停在“甲谢过，牵着孩子，绕到后门去了”这一刻。不要写甲是否被接了进去，也不要写门房的态度最后软了没有。这一次出门会不会白跑，交给桌上的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是上门求人的那个人，多半还带着一个孩子同行——孩子是通行证，也是众目睽睽下的把柄。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是那个被牵着的人、或者门口看车马的人；也可以不在场，只听说家里有人天没亮就出门了。如果玩家就是甲，卡的重点就变成“站在那扇门前，你开不开口；开一次口，被晾在墙根，你还说不说第二次”。"
      },
      {
        "key": "门口的人是谁",
        "value": "不是恶人，是门房，是靠“让谁进、不让谁进”吃饭的人。他们一眼就分得出来谁是来办事的、谁是来求人的。有人会拦你，有人会给你指错路，也有一个人会顺手说一句真话——这一句真话，常常决定这天白跑不白跑。"
      },
      {
        "key": "为什么要找那个人",
        "value": "门里真正说得上话的人，甲一个都不认得。中间人认识的人也未必在家，于是只剩在门口耗着这一条路。"
      },
      {
        "key": "为什么把孩子带上",
        "value": "孩子让这趟行程看起来像走亲戚，不像讨钱；孩子也是当着人的面顶着这份难堪的凭证。"
      },
      {
        "key": "这扇门是什么样的",
        "value": "豪门、大宅、衙门、公司大楼、医院、领事馆、某个组织的接待处。门槛越高，门口的几句话越要紧。"
      },
      {
        "key": "这是哪",
        "value": "任何“要见里面的人，得先过外面的人”的地方。这一场不需要时代和地点，只需要一个有门房的门。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲谢过，牵着孩子，绕到后门去了”这一刻。不要写甲是否被接了进去，也不要写门房的态度最后软了没有。这一次出门会不会白跑，交给桌上的人。"
      }
    ]
  },
  {
    "id": "C6-04-认错了人",
    "number": "C6-04",
    "name": "认错了人",
    "type": "错认 / 身份",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-04-认错了人.md",
    "face": "总算有人把甲领了进去。穿过几道门，进了一间屋子。屋里香得发闷，陈设亮得晃眼。\n\n屋里有个女人，满身绫罗，插金戴银，长得好。她起身让坐，问了好，还叫得出那个长辈的称呼。\n\n甲心里一松，正要按着规矩叫她——旁边有人插了一句：他是某某姑娘。\n\n甲一愣。原来这不过是个有体面的下人，还不是这家的主人。再看一句，人家管这屋里的下人叫大娘。\n\n甲让着坐下了，茶也端上来了。孩子被安置在身边。\n\n真正的当家的人，还没有露面。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是上门求人的人，也是分不清这家人谁大谁小的人。这不是甲蠢——在甲过日子的地方，绫罗和金银就是身份；到了这里，绫罗和金银只是工钱。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，坐在那间屋子里，跟甲一起认错人；也可以不在场，事后听甲当作笑话讲出来。如果玩家就是那个被错认的人（一个有体面的下人），卡的重点就变成“人家把你当主人，你要不要顺着接下去”。\n\n**那个下位的人是谁**：主家的贴身人、管事的、账房。他穿得比甲好，是因为那是他的差事；他对甲客气，是因为他得替主家把这个场面接住。\n\n**这家的真正主人是谁**：一个不在场、或者暂时不下场的人。甲这一趟的目标人物，此刻还不在这间屋子里。\n\n**认错会发生什么**：甲未必会当场出丑。旁边的人一句提醒，就把这个错轻轻抹过去了——脸上过去了，甲心里的位置却掉了一层。\n\n**这是哪**：任何有“体面下人”的地方：大宅、官府、公司、教会、船、使馆。等级越严密的地方，认错的代价越大。\n\n**注意**：卡停在“真正的当家的人，还没有露面”这一刻。不要写甲后来是怎么见着正主的，也不要写甲知不知道自己排在哪一档。这一错，多半没有人当面点破。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是上门求人的人，也是分不清这家人谁大谁小的人。这不是甲蠢——在甲过日子的地方，绫罗和金银就是身份；到了这里，绫罗和金银只是工钱。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，坐在那间屋子里，跟甲一起认错人；也可以不在场，事后听甲当作笑话讲出来。如果玩家就是那个被错认的人（一个有体面的下人），卡的重点就变成“人家把你当主人，你要不要顺着接下去”。"
      },
      {
        "key": "那个下位的人是谁",
        "value": "主家的贴身人、管事的、账房。他穿得比甲好，是因为那是他的差事；他对甲客气，是因为他得替主家把这个场面接住。"
      },
      {
        "key": "这家的真正主人是谁",
        "value": "一个不在场、或者暂时不下场的人。甲这一趟的目标人物，此刻还不在这间屋子里。"
      },
      {
        "key": "认错会发生什么",
        "value": "甲未必会当场出丑。旁边的人一句提醒，就把这个错轻轻抹过去了——脸上过去了，甲心里的位置却掉了一层。"
      },
      {
        "key": "这是哪",
        "value": "任何有“体面下人”的地方：大宅、官府、公司、教会、船、使馆。等级越严密的地方，认错的代价越大。"
      },
      {
        "key": "注意",
        "value": "卡停在“真正的当家的人，还没有露面”这一刻。不要写甲后来是怎么见着正主的，也不要写甲知不知道自己排在哪一档。这一错，多半没有人当面点破。"
      }
    ]
  },
  {
    "id": "C6-05-一盘肉",
    "number": "C6-05",
    "name": "一盘肉",
    "type": "失态 / 出丑",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-05-一盘肉.md",
    "face": "隔壁屋里摆了饭。菜是好菜，鱼肉都齐，动过几筷子，就抬下来了。\n\n孩子一路上没吃着什么，见了肉就闹起来，非要吃。怎么哄都不肯停。\n\n甲抬手，给了孩子一巴掌，下手比平时重。\n\n孩子放声哭起来。甲的手还悬在半空。屋里伺候的人都在看，有一个年老的把头低下去，没有走开。饭菜还摆在那里，谁也没有说话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是带孩子上门的那个人。这一巴掌不是狠，是怕——孩子不懂这是什么地方，甲懂。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，正是那个挨了打、或者动手的人；也可以不在场，事后听人提起“某某家那孩子，在人家屋里闹着要吃肉”。如果玩家是那个孩子，卡的重点就变成“你在这个屋子里，唯一学会的一件事是什么”。\n\n**孩子为什么闹**：一路上没吃，或者很久没吃过肉。孩子不懂规矩，犯的不是错，是穷。\n\n**甲为什么打**：当着外人，孩子失了规矩就是甲失了规矩。这一巴掌是打给屋里的人看的——让所有人知道甲是知情识趣的，不是来占便宜的。\n\n**屋里的人为什么不出声**：不是刻薄，是尴尬。主家还没有发话，下人不便先开口；一顿饭的处置权不在他们手上。\n\n**结果是什么**：孩子哭过，饭照样吃了；但这件事被记住了。往后甲每一次开口，屋里的人都会想起那个扒在背上要肉吃的孩子。\n\n**这是哪**：任何“在别人家里吃饭”的场合：亲戚家、东家的饭桌、救济站、面试前的招待、船上的餐厅。\n\n**注意**：卡停在“孩子放声哭起来，谁也没有说话”这一刻。不要写主家后来有没有赏菜，也不要写甲有没有后悔打了这一巴掌。一个孩子在这样的屋子里长大，会学到什么——这才是这张卡留下的东西。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是带孩子上门的那个人。这一巴掌不是狠，是怕——孩子不懂这是什么地方，甲懂。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，正是那个挨了打、或者动手的人；也可以不在场，事后听人提起“某某家那孩子，在人家屋里闹着要吃肉”。如果玩家是那个孩子，卡的重点就变成“你在这个屋子里，唯一学会的一件事是什么”。"
      },
      {
        "key": "孩子为什么闹",
        "value": "一路上没吃，或者很久没吃过肉。孩子不懂规矩，犯的不是错，是穷。"
      },
      {
        "key": "甲为什么打",
        "value": "当着外人，孩子失了规矩就是甲失了规矩。这一巴掌是打给屋里的人看的——让所有人知道甲是知情识趣的，不是来占便宜的。"
      },
      {
        "key": "屋里的人为什么不出声",
        "value": "不是刻薄，是尴尬。主家还没有发话，下人不便先开口；一顿饭的处置权不在他们手上。"
      },
      {
        "key": "结果是什么",
        "value": "孩子哭过，饭照样吃了；但这件事被记住了。往后甲每一次开口，屋里的人都会想起那个扒在背上要肉吃的孩子。"
      },
      {
        "key": "这是哪",
        "value": "任何“在别人家里吃饭”的场合：亲戚家、东家的饭桌、救济站、面试前的招待、船上的餐厅。"
      },
      {
        "key": "注意",
        "value": "卡停在“孩子放声哭起来，谁也没有说话”这一刻。不要写主家后来有没有赏菜，也不要写甲有没有后悔打了这一巴掌。一个孩子在这样的屋子里长大，会学到什么——这才是这张卡留下的东西。"
      }
    ]
  },
  {
    "id": "C6-06-晾着",
    "number": "C6-06",
    "name": "晾着",
    "type": "冷遇 / 试探",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-06-晾着.md",
    "face": "甲被安顿在一间屋子里，说：等着，到时候我们来请你。\n\n甲坐着，不敢出声。屋角的柱子上挂着个东西，一响，声音又大又怪，吓得甲一激灵；接着一连响了八九下。甲不知道那是什么，也不知道它为什么响。\n\n帘子外头一阵一阵有人笑，七八个、十几个人的脚步过去。有人吩咐“摆饭”，脚步又散了。半天，鸦雀不闻。\n\n只有甲和那个孩子，在这间屋子里坐着。\n\n又过了一会儿，有人掀帘子进来，笑嘻嘻地点手，叫甲过去。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是来求人的人，此刻的处境是“已经进来了，但还没轮到”。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，坐在这间屋子里一起等；也可以不在场，事后听说“那天在人家屋里坐了半日”。如果玩家就是那个叫人的人，卡的重点就变成“你把她晾在那里，是你拿捏她的第一步”。\n\n**为什么晾着**：主家的人还没下来、饭还没吃完、管家的人正等着回事、主家自己也没想好要不要见。有时候确实腾不出手，有时候就是先放着——让来的人明白自己排在第几位。\n\n**甲在等的时候能做什么**：什么都不能做。这才是这张卡的重量：甲不是被拒绝，是被搁置。搁置没有期限，也没有说法。\n\n**那个声音是什么**：钟、打点器、广播、汽笛、上下班的铃。甲不但不懂它是什么，还得由它来决定自己什么时候能站起来。\n\n**这一等会怎样**：有人会等出耐心，有人会等出怨气，有人会等到主家终于腾出手，也有人会就此告辞走人。卡不写是哪一种。\n\n**这是哪**：任何“等候”能被当作手段的地方：门厅、候见室、客厅、会议室外的走廊、诊室外面。\n\n**注意**：卡停在“有人拨帘子进来，叫甲过去”这一刻。不要写主家见了甲之后说了什么，也不要写这半日的等待是不是故意的——在当事人那里，这两件事看不出来。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是来求人的人，此刻的处境是“已经进来了，但还没轮到”。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，坐在这间屋子里一起等；也可以不在场，事后听说“那天在人家屋里坐了半日”。如果玩家就是那个叫人的人，卡的重点就变成“你把她晾在那里，是你拿捏她的第一步”。"
      },
      {
        "key": "为什么晾着",
        "value": "主家的人还没下来、饭还没吃完、管家的人正等着回事、主家自己也没想好要不要见。有时候确实腾不出手，有时候就是先放着——让来的人明白自己排在第几位。"
      },
      {
        "key": "甲在等的时候能做什么",
        "value": "什么都不能做。这才是这张卡的重量：甲不是被拒绝，是被搁置。搁置没有期限，也没有说法。"
      },
      {
        "key": "那个声音是什么",
        "value": "钟、打点器、广播、汽笛、上下班的铃。甲不但不懂它是什么，还得由它来决定自己什么时候能站起来。"
      },
      {
        "key": "这一等会怎样",
        "value": "有人会等出耐心，有人会等出怨气，有人会等到主家终于腾出手，也有人会就此告辞走人。卡不写是哪一种。"
      },
      {
        "key": "这是哪",
        "value": "任何“等候”能被当作手段的地方：门厅、候见室、客厅、会议室外的走廊、诊室外面。"
      },
      {
        "key": "注意",
        "value": "卡停在“有人拨帘子进来，叫甲过去”这一刻。不要写主家见了甲之后说了什么，也不要写这半日的等待是不是故意的——在当事人那里，这两件事看不出来。"
      }
    ]
  },
  {
    "id": "C6-07-大有大的难处",
    "number": "C6-07",
    "name": "大有大的难处",
    "type": "诉苦 / 摊牌前",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-07-大有大的难处.md",
    "face": "甲进了那间屋子。当家的女人坐在那里，手里拨着手炉的灰，不接茶，也不太抬头，开口是：怎么还不请进来。\n\n甲要拜，被人搀住。当家的说：我年轻，不大认得，也不知道是什么辈数，不敢称呼。\n\n寒暄还没说完，底下的人一趟一趟地进来回事。当家的挥挥手，都按下去了：晚上再来回，要紧的带进来现办。\n\n就在甲面前，有人来借一样贵重东西。当家的先推了两句，还是叫人抬去了，临了添一句：碰坏了一点，你可仔细。\n\n人都散了。当家的转过来，对甲说起自家的难处：外面看着热闹，其实撑个空架子，花钱的地方多，远路的亲戚一时顾不过来。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是坐在下首的那个人——有话要说，还没说出口，就被这一屋子的事压住了。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，坐在甲那个位置，看着这一幕；也可以不在场，事后听甲复述。如果玩家就是当家的那个人，卡的重点就变成“你为什么要当着客人的面办这些事，又为什么要当着客人的面说这些难处”。\n\n**当家的那个人是谁**：真正管这摊子事的人——未必是名义上的家长。年轻、能干、管着钱和人，说一句话底下人就得动。\n\n**那些事是什么**：有人来借东西、有人来回账、有人来请示、有人来告状。挑一两件就够——它们的作用不是情节，是让甲看清自己排在哪一档。\n\n**当家的为什么当着甲办这些**：一半是确实忙，一半是给甲看：你看，我这儿的事比你的大；你的事，得排在这些后头。\n\n**那番难处是说给谁听的**：说给甲听的，也是说给自己听的，可能还是真话。话说在前头，不是推脱，是把甲的期待先压下去——让甲等下开口时，自己先开口减半。\n\n**这是哪**：任何“有当家人”的地方：大家族、公司、机关、教区、船。管事的人越忙，来求的人越轻。\n\n**注意**：卡停在“当家的说起自家难处”这一刻。不要写甲听了这番话怎么反应，也不要写当家的最后给还是不给。到目前为止，甲一个字都还没有为自己的事说出口。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是坐在下首的那个人——有话要说，还没说出口，就被这一屋子的事压住了。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，坐在甲那个位置，看着这一幕；也可以不在场，事后听甲复述。如果玩家就是当家的那个人，卡的重点就变成“你为什么要当着客人的面办这些事，又为什么要当着客人的面说这些难处”。"
      },
      {
        "key": "当家的那个人是谁",
        "value": "真正管这摊子事的人——未必是名义上的家长。年轻、能干、管着钱和人，说一句话底下人就得动。"
      },
      {
        "key": "那些事是什么",
        "value": "有人来借东西、有人来回账、有人来请示、有人来告状。挑一两件就够——它们的作用不是情节，是让甲看清自己排在哪一档。"
      },
      {
        "key": "当家的为什么当着甲办这些",
        "value": "一半是确实忙，一半是给甲看：你看，我这儿的事比你的大；你的事，得排在这些后头。"
      },
      {
        "key": "那番难处是说给谁听的",
        "value": "说给甲听的，也是说给自己听的，可能还是真话。话说在前头，不是推脱，是把甲的期待先压下去——让甲等下开口时，自己先开口减半。"
      },
      {
        "key": "这是哪",
        "value": "任何“有当家人”的地方：大家族、公司、机关、教区、船。管事的人越忙，来求的人越轻。"
      },
      {
        "key": "注意",
        "value": "卡停在“当家的说起自家难处”这一刻。不要写甲听了这番话怎么反应，也不要写当家的最后给还是不给。到目前为止，甲一个字都还没有为自己的事说出口。"
      }
    ]
  },
  {
    "id": "C6-08-给钱",
    "number": "C6-08",
    "name": "给钱",
    "type": "开口 / 接济",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-08-给钱.md",
    "face": "甲终于把话说了。说到一半，先自己红了脸，说：今日初次见面，原不该说的，只是大老远奔了来……\n\n话说完了，屋里静了一下。\n\n当家的说：你的意思我早知道了。论亲戚，本来就该不等你上门就照应，只是家里事多，太太上了年纪，一时想不到。你既然头一回跟我开口，怎么好叫你空回去。\n\n说着，叫人去取了一笔钱来，另外还多给了一串零钱。\n\n当家的又说：先拿回去，给孩子们做件冬衣。改日没事，只管来逛逛。\n\n那笔钱放在甲眼前。孩子还在甲身后。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是开口的那个人。开口之前，甲是来走亲戚的；开口之后，甲就是一个接受了接济的人。这两件事，甲自己心里分得最清。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，是开口的、是给钱的、或者是那间屋子里端着茶的下人；也可以不在场，事后知道家里来了一笔来路不明的钱。如果玩家就是当家的那个人，卡的重点就变成“给多少、怎么说、给成什么名分”。\n\n**这笔钱是什么名分**：给孩子们的冬衣钱、赏的、借的、按月接济的、暂垫的。名分不同，往后要还的东西就不同：有的还钱，有的还人情，有的还一辈子。\n\n**数目与说话**：多给或少给，给现钱或给东西，当面给或私下给，说一句轻的或说一句重的。这几样加起来，比数目本身更定得住关系。\n\n**当着多少人给**：当着下人给，甲就没法推辞；私下给，甲还能留一层脸。怎么给，等于告诉甲往后该怎么再来。\n\n**接下这笔钱的人要付什么**：当着这一屋子人道谢；再来一次；把这件事讲给家里听；往后每次来，都从“上次那笔钱”说起。\n\n**这是哪**：任何“接济”成立的世界：亲戚、同乡、教会、福利机构、老板给的奖金、朋友垫的钱。\n\n**注意**：卡停在“钱放在甲眼前”这一刻。不要写甲说了什么、接没接，也不要写当家的给完之后心里的打算。这一笔给出去了，故事里就多了一笔要还的东西。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是开口的那个人。开口之前，甲是来走亲戚的；开口之后，甲就是一个接受了接济的人。这两件事，甲自己心里分得最清。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是开口的、是给钱的、或者是那间屋子里端着茶的下人；也可以不在场，事后知道家里来了一笔来路不明的钱。如果玩家就是当家的那个人，卡的重点就变成“给多少、怎么说、给成什么名分”。"
      },
      {
        "key": "这笔钱是什么名分",
        "value": "给孩子们的冬衣钱、赏的、借的、按月接济的、暂垫的。名分不同，往后要还的东西就不同：有的还钱，有的还人情，有的还一辈子。"
      },
      {
        "key": "数目与说话",
        "value": "多给或少给，给现钱或给东西，当面给或私下给，说一句轻的或说一句重的。这几样加起来，比数目本身更定得住关系。"
      },
      {
        "key": "当着多少人给",
        "value": "当着下人给，甲就没法推辞；私下给，甲还能留一层脸。怎么给，等于告诉甲往后该怎么再来。"
      },
      {
        "key": "接下这笔钱的人要付什么",
        "value": "当着这一屋子人道谢；再来一次；把这件事讲给家里听；往后每次来，都从“上次那笔钱”说起。"
      },
      {
        "key": "这是哪",
        "value": "任何“接济”成立的世界：亲戚、同乡、教会、福利机构、老板给的奖金、朋友垫的钱。"
      },
      {
        "key": "注意",
        "value": "卡停在“钱放在甲眼前”这一刻。不要写甲说了什么、接没接，也不要写当家的给完之后心里的打算。这一笔给出去了，故事里就多了一笔要还的东西。"
      }
    ]
  },
  {
    "id": "C6-09-一身绫罗",
    "number": "C6-09",
    "name": "一身绫罗",
    "type": "知情 / 掩藏",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-09-一身绫罗.md",
    "face": "每天夜里，都是这两个人。铺床、收衣、吹灯，都是甲的事，多年没有变过。\n\n这一天也一样。甲给另一个宽衣，手碰到一处不该碰的地方，赶紧缩了回来，忍不住问了一句：这是怎么了。\n\n被问的人脸一下红了，把甲的手一捻，不答。\n\n两个人都低下了头。灯还亮着，谁都没有再动。过了一会儿，被问的人低声说：好姐姐，千万别告诉人。\n\n甲替他换了一件干净衣服，没有再问。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个碰上的人，也是那个被求的人。甲伺候另一个人，年纪略长，也不是什么都不懂。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，就是这两个人里的一个（多半是甲）；也可以不在场，事后从别人口中听说家里出过这么一件事。如果玩家是被求的那个人，卡的重点就变成“你身上的一件私事，落在了别人手里，你去求他”。\n\n**这两个人是什么关系**：贴身的人与被伺候的人；自小一处长大；一个是被派来的，一个是主人。权势在谁手上，这张卡就往谁那边倒。\n\n**甲为什么会碰上**：甲比谁都贴得近——衣服是甲收的，床是甲铺的，夜里守着的是甲。这件事不是甲打听来的，是自己撞上来的。\n\n**那句话要甲做什么**：甲答应，两个人从此是一条船上的人；甲不答应；甲嘴上答应，心里另外记了一笔。这三种都在“甲不答”之后才开始。\n\n**这是哪**：任何有“贴身的人”的地方：旧式大宅、寄宿学校、军营、病房、长期雇用的家政、官邸。只要一个人替另一个人管着最私密的事，这张卡就成立。\n\n**注意**：这是一张成人向的卡，不写任何身体细节，卡面只到“另一个人替他换了一件干净衣服，没有再问”为止。使用时请先确认故事里这两个人的年龄都合适；若年龄不合适，就把他们改成两个成年人，或者直接跳过这张卡。卡停在“没有再问”这一刻：甲答没答应、以后用不用这件事，交给桌上的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个碰上的人，也是那个被求的人。甲伺候另一个人，年纪略长，也不是什么都不懂。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，就是这两个人里的一个（多半是甲）；也可以不在场，事后从别人口中听说家里出过这么一件事。如果玩家是被求的那个人，卡的重点就变成“你身上的一件私事，落在了别人手里，你去求他”。"
      },
      {
        "key": "这两个人是什么关系",
        "value": "贴身的人与被伺候的人；自小一处长大；一个是被派来的，一个是主人。权势在谁手上，这张卡就往谁那边倒。"
      },
      {
        "key": "甲为什么会碰上",
        "value": "甲比谁都贴得近——衣服是甲收的，床是甲铺的，夜里守着的是甲。这件事不是甲打听来的，是自己撞上来的。"
      },
      {
        "key": "那句话要甲做什么",
        "value": "甲答应，两个人从此是一条船上的人；甲不答应；甲嘴上答应，心里另外记了一笔。这三种都在“甲不答”之后才开始。"
      },
      {
        "key": "这是哪",
        "value": "任何有“贴身的人”的地方：旧式大宅、寄宿学校、军营、病房、长期雇用的家政、官邸。只要一个人替另一个人管着最私密的事，这张卡就成立。"
      },
      {
        "key": "注意",
        "value": "这是一张成人向的卡，不写任何身体细节，卡面只到“另一个人替他换了一件干净衣服，没有再问”为止。使用时请先确认故事里这两个人的年龄都合适；若年龄不合适，就把他们改成两个成年人，或者直接跳过这张卡。卡停在“没有再问”这一刻：甲答没答应、以后用不用这件事，交给桌上的人。"
      }
    ]
  },
  {
    "id": "C6-10-两个人都当没事",
    "number": "C6-10",
    "name": "两个人都当没事",
    "type": "掩饰 / 看破",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第六回",
    "rel": "红楼梦/现实类/第六回/C6-10-两个人都当没事.md",
    "face": "从那天起，这两个人变了。一个见了面先笑一下，比往常轻；另一个接东西的手，也先顿一顿。\n\n说正经话的时候，两个人都好好的，一个字都没有错。只是说完就走，很少再留一句。旁边有人喊另一个人的名字，两个人的眼睛都会先抬一下，再收回去。\n\n屋里其他伺候的人，看人的眼睛都很尖。他们看见了，谁也不说。\n\n甲也看见了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是屋里看出这件事的人——别的下人、同房的人、要交接班的人、盯了这两个人很久的人。甲手里没有任何凭据，只有一双眼睛。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场，是看出端倪的那一个，也可以是被看的两个之一；也可以完全不在场，是最后才被告知的人。如果玩家是这家的主人或长辈，卡的重点就变成“你看出这两个人不对劲，你要不要问”。\n\n**甲看见的是什么**：一点错开的目光、一次多停的手、一句没说完的话、一个私下送来的东西。所有这些都算不上证据，但它们凑在一起，就是一桩事。\n\n**甲能做什么**：当作没看见；当面点一句；告诉管事的人；拿去换点好处；等这两个人出事，再把自己摘干净。哪一条都有代价，哪一条都不是恶。\n\n**为什么难**：甲没有证据，说出来就要担“诬人”的名；甲不说，就要天天看着，还要替这两个人在人前遮掩。\n\n**这是哪**：任何“几个人住在一个屋檐下”的地方：大宅、宿舍、军营、机组、船、病房。人越是挤在一处，越没有私事；越没有私事，越有人要靠别人的私事活着。\n\n**注意**：这是一张成人向的卡，但它的画面里没有那件事——只有两个人在装，和一个人在数。使用时请先确认故事里涉及的年龄都合适；若年龄不合适，就把那件秘事换成别的一种（一笔账、一个人、一封信），这张卡照样成立。卡停在“屋里其他伺候的人，看人的眼睛都很尖”这一刻：往后是烂在屋里，还是从甲这里漏出去，交由桌上的人去演。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是屋里看出这件事的人——别的下人、同房的人、要交接班的人、盯了这两个人很久的人。甲手里没有任何凭据，只有一双眼睛。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是看出端倪的那一个，也可以是被看的两个之一；也可以完全不在场，是最后才被告知的人。如果玩家是这家的主人或长辈，卡的重点就变成“你看出这两个人不对劲，你要不要问”。"
      },
      {
        "key": "甲看见的是什么",
        "value": "一点错开的目光、一次多停的手、一句没说完的话、一个私下送来的东西。所有这些都算不上证据，但它们凑在一起，就是一桩事。"
      },
      {
        "key": "甲能做什么",
        "value": "当作没看见；当面点一句；告诉管事的人；拿去换点好处；等这两个人出事，再把自己摘干净。哪一条都有代价，哪一条都不是恶。"
      },
      {
        "key": "为什么难",
        "value": "甲没有证据，说出来就要担“诬人”的名；甲不说，就要天天看着，还要替这两个人在人前遮掩。"
      },
      {
        "key": "这是哪",
        "value": "任何“几个人住在一个屋檐下”的地方：大宅、宿舍、军营、机组、船、病房。人越是挤在一处，越没有私事；越没有私事，越有人要靠别人的私事活着。"
      },
      {
        "key": "注意",
        "value": "这是一张成人向的卡，但它的画面里没有那件事——只有两个人在装，和一个人在数。使用时请先确认故事里涉及的年龄都合适；若年龄不合适，就把那件秘事换成别的一种（一笔账、一个人、一封信），这张卡照样成立。卡停在“屋里其他伺候的人，看人的眼睛都很尖”这一刻：往后是烂在屋里，还是从甲这里漏出去，交由桌上的人去演。"
      }
    ]
  },
  {
    "id": "C7-01-旧功",
    "number": "C7-01",
    "name": "旧功",
    "type": "失言 / 旧账",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第七回",
    "rel": "红楼梦/现实类/第七回/C7-01-旧功.md",
    "face": "甲家里有一个老人。年轻时，他救过甲的祖辈——从死人堆里把人背出来，自己饿着，把偷来的一口吃的给了主子；路上断了水，他讨来半碗，端给别人喝，自己喝的是马尿。\n\n这些年，一家人都让着他。他不做事，也没有人敢派他做事。他老了，爱喝酒，喝了就骂人，谁都不放在眼里。\n\n今夜他喝多了，被人派去送一趟远客。他站在院子里，从小厮骂起，骂到管家，骂到当家人。\n\n最后他嚷出了一件最不能让人知道的事——甲家里的一件私事，一桩旧账，或者一个人。\n\n满院子的人都听见了。没有人敢拦他。\n\n当家人叫了几个人，把他按倒。\n\n老人还在骂。院子里的灯亮着，所有人都在听。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这一家做主的人，或者家里任何一个要跟这个老人过下去的人。若玩家是这一家的小辈，卡的重点是“老人嚷出来的那句话，你听懂了没有”。\n\n**玩家在哪**：玩家可以在场，站在满院子人里听；也可以是那个下令把老人按倒的人，或者是老人本人；也可以不在场，事后从满院子人的嘴里听说——但听说的一定是第二个版本。\n\n**这个老人是谁**：救过这家人的老仆、老兵、老伙计、跟过上一代的旧人。他有一份“谁都不能不认”的功劳，也有一张“什么都知道”的嘴。他不是坏人，他是没法安放的人。\n\n**当年那件事是什么**：从死人堆里背出来的人，挨过饿的人，讨过半碗水的人。卡要的只是“这家人欠他一条命”，细节可以任意替换。\n\n**他嚷出来的那件私事是什么**：账目、私情、一桩旧案、一个身世、谁的钱去了哪里。不要写出来是什么，但要在桌上定下来——它必须是一件“真事”，否则这张卡只剩一场闹剧。\n\n**派他去送客的人是谁**：管事的、当家的、故意给他难堪的人、随手一指的人。这场祸，多半就是这么随手一指来的。\n\n**在座的还有谁**：席上若有年幼的人，让旁人替他把话挡下去——不要为了原作的细节，把未成年角色放进这段里。\n\n**这是哪**：任何有“老臣”和“功劳”的地方——家族、企业、船队、军队、门派。老人可以是老员工、退伍的老兵、跟过创始人的旧部。\n\n**注意**：卡停在“老人被按倒，满院子人都在听”这一刻。不要写这一家怎么处理他，也不要写那句话是真还是假——酒话里常常有真的。若当家人下令捆人，记住：在一屋子人面前处置一个有功的老人，这件事本身就留下了把柄。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这一家做主的人，或者家里任何一个要跟这个老人过下去的人。若玩家是这一家的小辈，卡的重点是“老人嚷出来的那句话，你听懂了没有”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，站在满院子人里听；也可以是那个下令把老人按倒的人，或者是老人本人；也可以不在场，事后从满院子人的嘴里听说——但听说的一定是第二个版本。"
      },
      {
        "key": "这个老人是谁",
        "value": "救过这家人的老仆、老兵、老伙计、跟过上一代的旧人。他有一份“谁都不能不认”的功劳，也有一张“什么都知道”的嘴。他不是坏人，他是没法安放的人。"
      },
      {
        "key": "当年那件事是什么",
        "value": "从死人堆里背出来的人，挨过饿的人，讨过半碗水的人。卡要的只是“这家人欠他一条命”，细节可以任意替换。"
      },
      {
        "key": "他嚷出来的那件私事是什么",
        "value": "账目、私情、一桩旧案、一个身世、谁的钱去了哪里。不要写出来是什么，但要在桌上定下来——它必须是一件“真事”，否则这张卡只剩一场闹剧。"
      },
      {
        "key": "派他去送客的人是谁",
        "value": "管事的、当家的、故意给他难堪的人、随手一指的人。这场祸，多半就是这么随手一指来的。"
      },
      {
        "key": "在座的还有谁",
        "value": "席上若有年幼的人，让旁人替他把话挡下去——不要为了原作的细节，把未成年角色放进这段里。"
      },
      {
        "key": "这是哪",
        "value": "任何有“老臣”和“功劳”的地方——家族、企业、船队、军队、门派。老人可以是老员工、退伍的老兵、跟过创始人的旧部。"
      },
      {
        "key": "注意",
        "value": "卡停在“老人被按倒，满院子人都在听”这一刻。不要写这一家怎么处理他，也不要写那句话是真还是假——酒话里常常有真的。若当家人下令捆人，记住：在一屋子人面前处置一个有功的老人，这件事本身就留下了把柄。"
      }
    ]
  },
  {
    "id": "C7-02-一剂药",
    "number": "C7-02",
    "name": "一剂药",
    "type": "久病 / 告知",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第七回",
    "rel": "红楼梦/现实类/第七回/C7-02-一剂药.md",
    "face": "甲去一个亲戚家里说话，或者只是路过坐一会儿。\n\n屋里的年轻人正在伏案做一件细活——描花样、抄东西、修一件小物。她抬起头，脸色不算差，只是有点倦。\n\n话头转到身上。她说，她这病是从娘胎里带来的，从小请过多少大夫，吃过多少药，花了多少钱，都不见效。后来来了一个云游的人，看了一回，说这病不能吃普通的药。\n\n那个人给了一个方子。方子上最难的不是贵，是“可巧”：四季的花蕊，加上四个节气的雨、露、霜、雪，分量都要准。凑不齐，就再等一年。\n\n她说，后来居然真凑齐了。丸子做成了，埋在树下。\n\n她说这些话的时候，语气很平常，像在说别人家的事。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是来串门的亲戚、长辈、邻居、同事，或者玩家自己。甲不必有帮得上忙的能力——这张卡是被告知，不是被请求。\n\n**玩家在哪**：玩家可以是甲，坐在那里听完；也可以是生病的那个人，正在决定“说不说、跟谁说、说到几分”；也可以不在场，事后从家里人口中听说。\n\n**病的是谁**：一个看起来好好的年轻人。外表越正常，这张卡越有意思——她的麻烦不在身上，在“大家都以为她没事”。\n\n**那道方子是什么**：一剂麻烦的药、一套讲究的吃法、一份只能维持不能根治的配额、一种要按期去做的治疗。难处不在贵，在“要凑巧”“要等”“要年年如此”。也可以换成现实的方子：限定产地的药、只能维持的疗法、要排队的名额。\n\n**她那句“凑齐了”是什么意思**：可以是真的凑齐了，也可以只是不想再被人当作病人。她说完就收起来了——不开口要什么，也不准别人多问。\n\n**过去那个云游的人是谁**：游医、老医生、一个说不清来历的人、朋友介绍的偏方。卡不必判定他是不是骗子——她信了，这才是重点。\n\n**分类**：归现实类，因为这张卡靠的是“慢性病 + 一个麻烦的疗程”。若确认那个云游的人真懂常人不懂的事，就移进奇幻类，骨架不变。\n\n**这是哪**：任何有“长期病”和“家里人”的世界。古装、现代、科幻都成立。\n\n**注意**：卡停在她把话说完这一刻。不要写甲要不要替她找药，也不要写这方子是真是假。这张卡不欠谁一个人情，它只留一件事：现在甲知道了，而她本来没打算让人知道。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是来串门的亲戚、长辈、邻居、同事，或者玩家自己。甲不必有帮得上忙的能力——这张卡是被告知，不是被请求。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，坐在那里听完；也可以是生病的那个人，正在决定“说不说、跟谁说、说到几分”；也可以不在场，事后从家里人口中听说。"
      },
      {
        "key": "病的是谁",
        "value": "一个看起来好好的年轻人。外表越正常，这张卡越有意思——她的麻烦不在身上，在“大家都以为她没事”。"
      },
      {
        "key": "那道方子是什么",
        "value": "一剂麻烦的药、一套讲究的吃法、一份只能维持不能根治的配额、一种要按期去做的治疗。难处不在贵，在“要凑巧”“要等”“要年年如此”。也可以换成现实的方子：限定产地的药、只能维持的疗法、要排队的名额。"
      },
      {
        "key": "她那句“凑齐了”是什么意思",
        "value": "可以是真的凑齐了，也可以只是不想再被人当作病人。她说完就收起来了——不开口要什么，也不准别人多问。"
      },
      {
        "key": "过去那个云游的人是谁",
        "value": "游医、老医生、一个说不清来历的人、朋友介绍的偏方。卡不必判定他是不是骗子——她信了，这才是重点。"
      },
      {
        "key": "分类",
        "value": "归现实类，因为这张卡靠的是“慢性病 + 一个麻烦的疗程”。若确认那个云游的人真懂常人不懂的事，就移进奇幻类，骨架不变。"
      },
      {
        "key": "这是哪",
        "value": "任何有“长期病”和“家里人”的世界。古装、现代、科幻都成立。"
      },
      {
        "key": "注意",
        "value": "卡停在她把话说完这一刻。不要写甲要不要替她找药，也不要写这方子是真是假。这张卡不欠谁一个人情，它只留一件事：现在甲知道了，而她本来没打算让人知道。"
      }
    ]
  },
  {
    "id": "C7-03-同窗之约",
    "number": "C7-03",
    "name": "同窗之约",
    "type": "结交 / 约定",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第七回",
    "rel": "红楼梦/现实类/第七回/C7-03-同窗之约.md",
    "face": "甲家里来了客人，客人带了一个孩子。两个孩子年纪相仿，被大人凑到一处说话。\n\n他们先互相看。这一个觉得那一个比自己好看、比自己干净、比自己会说；那一个觉得这一个穿得好、住得好、身边什么都好。\n\n两个人各自低下头，心里都有一点说不出的难受。\n\n然后一个先开口，问起读书的事。另一个说，教他的先生去年就走了，家里事多，新的还没请到，如今只能自己在家温习旧课。\n\n那一个立刻说：我家有个学塾，族里的孩子都在那里念，亲戚家的孩子也可以来附读。我也荒废着。你回去跟家里说，我也回去跟家里说，咱们在一处，彼此都有益。\n\n另一个说：好，我回去禀明。\n\n两个人越说越近，事情就这么定下来了——各自回去开口。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这两个孩子里年纪大的那一个、家里做主的人、带着孩子来的人。整件事停在这里的时候，还没有一个大人在场。\n\n**玩家在哪**：玩家可以是这两个孩子里的一个，当场就点头；可以是这家的家长，散席之后才被孩子拉住说这件事；也可以不在场，只听说“两个孩子说好了要一处读书”。若玩家就是那个孩子，卡的重点是“你想跟这个人再见面，但这事不由你定”。\n\n**两个孩子是谁**：一个住在有学塾、有先生、有亲戚可以附读的家里；一个家里出了变故，先生走了，书放下了。年纪不到能做主的时候——所以这张卡真正的重量，落在他们背后的大人身上。\n\n**那个学塾是什么**：家塾、族学、寄宿学校、培训班、一个可以带人进去的项目组。它要满足两点：家里就有；外人可以进来。\n\n**邀请为什么成立**：两个人各有各的需要——一个缺伴，一个缺先生；一个想显摆，一个想逃离自己的处境。谁更需要谁，将来会变。\n\n**这笔账记在谁头上**：孩子邀人附读，等于替家里许了一个位置、一份人情、一张长期饭票。这件事，家里未必愿意。\n\n**这是哪**：任何有“上学”和“人情”的世界。学堂可以是私塾、书院、学校、学徒制、俱乐部。\n\n**注意**：卡停在“各自回去开口”这一刻。不要写家里答不答应，也不要写他们日后会不会翻脸。若两家答应了，这份交情就变成两个家庭之间的事——两个孩子的情分，从此要拿家里的账来算。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这两个孩子里年纪大的那一个、家里做主的人、带着孩子来的人。整件事停在这里的时候，还没有一个大人在场。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是这两个孩子里的一个，当场就点头；可以是这家的家长，散席之后才被孩子拉住说这件事；也可以不在场，只听说“两个孩子说好了要一处读书”。若玩家就是那个孩子，卡的重点是“你想跟这个人再见面，但这事不由你定”。"
      },
      {
        "key": "两个孩子是谁",
        "value": "一个住在有学塾、有先生、有亲戚可以附读的家里；一个家里出了变故，先生走了，书放下了。年纪不到能做主的时候——所以这张卡真正的重量，落在他们背后的大人身上。"
      },
      {
        "key": "那个学塾是什么",
        "value": "家塾、族学、寄宿学校、培训班、一个可以带人进去的项目组。它要满足两点：家里就有；外人可以进来。"
      },
      {
        "key": "邀请为什么成立",
        "value": "两个人各有各的需要——一个缺伴，一个缺先生；一个想显摆，一个想逃离自己的处境。谁更需要谁，将来会变。"
      },
      {
        "key": "这笔账记在谁头上",
        "value": "孩子邀人附读，等于替家里许了一个位置、一份人情、一张长期饭票。这件事，家里未必愿意。"
      },
      {
        "key": "这是哪",
        "value": "任何有“上学”和“人情”的世界。学堂可以是私塾、书院、学校、学徒制、俱乐部。"
      },
      {
        "key": "注意",
        "value": "卡停在“各自回去开口”这一刻。不要写家里答不答应，也不要写他们日后会不会翻脸。若两家答应了，这份交情就变成两个家庭之间的事——两个孩子的情分，从此要拿家里的账来算。"
      }
    ]
  },
  {
    "id": "C8-02-我来的不巧",
    "number": "C8-02",
    "name": "我来的不巧",
    "type": "到访 / 醋意",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第八回",
    "rel": "红楼梦/现实类/第八回/C8-02-我来的不巧.md",
    "face": "门口传进一声：有人来了。\n\n进来的是个女孩。她一掀帘子就看见，屋里已经坐了一个人，正和主人挨得很近，两个人凑着看同一件东西。\n\n她站在门口笑了一下，说：我来的不巧了。\n\n主人问她这是什么意思。\n\n她说：早知他在，我就不来了。\n\n有人替她解围，说外头下了半日雪。她顺着这句话，回头叫人去取自己的斗篷。\n\n屋里没有人接她的话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是进屋的这个女孩，也可以是已经坐在屋里的那个人，也可以是主人。谁开口，谁就把这间屋子的气氛改了。若玩家是甲，把这几句读成你自己说的。\n\n**玩家在哪**：玩家可以就是进来的那个人——你要不要把这句酸话说出口；可以是已经坐着的人；也可以是主人，要决定接不接这句话。\n\n**她在气什么**：不是气他来，是气“两个人凑在一起看东西”这个画面里没有她。她说出口的每句话都对，所以谁都不好反驳。\n\n**那句话是什么**：可以是“我来的不巧”“早知他在，我就不来了”“你们忙，我改日再来”“我是不是打扰了”。说的都是同一件事，轻重不同。\n\n**为什么是轻的**：没有人失去什么。只是这间屋子里的关系，从这一刻起多了一层要互相留神的账。\n\n**为什么她马上改口**：说完就找别的事做——要斗篷、说下雪、问什么时候回去。这不是她放下了，是她要让人知道她不在乎。\n\n**这是哪**：任何有三个人、又有一个“谁和谁更要好”的问题的地方——客厅、办公室、宿舍、家族群。\n\n**注意**：卡停在“屋里没有人接她的话”这一刻。不要写谁赢了、谁恼了。日后每次这三个人同席，这句话都还在这间屋里。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是进屋的这个女孩，也可以是已经坐在屋里的那个人，也可以是主人。谁开口，谁就把这间屋子的气氛改了。若玩家是甲，把这几句读成你自己说的。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是进来的那个人——你要不要把这句酸话说出口；可以是已经坐着的人；也可以是主人，要决定接不接这句话。"
      },
      {
        "key": "她在气什么",
        "value": "不是气他来，是气“两个人凑在一起看东西”这个画面里没有她。她说出口的每句话都对，所以谁都不好反驳。"
      },
      {
        "key": "那句话是什么",
        "value": "可以是“我来的不巧”“早知他在，我就不来了”“你们忙，我改日再来”“我是不是打扰了”。说的都是同一件事，轻重不同。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人失去什么。只是这间屋子里的关系，从这一刻起多了一层要互相留神的账。"
      },
      {
        "key": "为什么她马上改口",
        "value": "说完就找别的事做——要斗篷、说下雪、问什么时候回去。这不是她放下了，是她要让人知道她不在乎。"
      },
      {
        "key": "这是哪",
        "value": "任何有三个人、又有一个“谁和谁更要好”的问题的地方——客厅、办公室、宿舍、家族群。"
      },
      {
        "key": "注意",
        "value": "卡停在“屋里没有人接她的话”这一刻。不要写谁赢了、谁恼了。日后每次这三个人同席，这句话都还在这间屋里。"
      }
    ]
  },
  {
    "id": "C8-03-早知他在",
    "number": "C8-03",
    "name": "早知他在",
    "type": "绕路 / 奉承",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第八回",
    "rel": "红楼梦/现实类/第八回/C8-03-早知他在.md",
    "face": "他本可以走一条近路，去看一个该去看的人。近路要经过一扇门，门里住着他最不想碰见的人。\n\n他想了想，宁可绕一条远路。\n\n走到半路，先撞上两个清客，一左一右抱住他，说好容易梦见你，就遇见你了，唠叨了半日才放他走。\n\n转过弯，又撞上管库的、管仓的、买办，七八个人一齐垂手站好；其中一个上来请安，又说大家看见了他写的字，都称赞得了不得，想讨几张。\n\n他笑着应了一句，说找我的小厮们要就是了。\n\n一路走到那扇门前，天已经不那么早了。他是绕过来的，却比谁都到得晚。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是绕路的这个人，也可以是路上拦住他的那几个人，也可以是他要去看的那个人。站在门口的那一位，是这张卡真正的落点。\n\n**玩家在哪**：玩家可以就是绕路的人——你为什么要绕；可以是路上拦他的人，讨一句字、讨一次脸；也可以是被绕开的那一位，事后才知道他今天来过又没来。\n\n**他为什么要绕**：怕撞见管教他的人；怕被叫去问话；怕被别的事缠住。理由不重要，重要的是：他宁肯多走一段路，也不肯经过那扇门。\n\n**拦住他的人是谁**：清客、门客、管事的、账房、买办、部下。他们拦他不是要害他，是想沾他。这一路的奉承合起来只说明一件事：在这个地方，他走到哪里都有人接。\n\n**为什么是轻的**：没有人失去什么。只是他“去看一个人”这件事，被他自己排在了很多人的脸面之后。\n\n**玩家若就是被绕开的那一位**：这张卡的重点是“他到底来了没有、来做什么”，而不是当场对质。你可以什么也不说，把这件事记住。\n\n**这是哪**：任何有“门客、下属、必须应酬的人”的地方——旧宅、官府、公司、圈子。\n\n**注意**：卡停在“他一路绕过来，站在了那扇门前”这一刻。不要写他进去做了什么、那两个人说了什么话。若这一路奉承里有人讨到了东西，把它记下来——那些字往后会出现在别处。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是绕路的这个人，也可以是路上拦住他的那几个人，也可以是他要去看的那个人。站在门口的那一位，是这张卡真正的落点。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是绕路的人——你为什么要绕；可以是路上拦他的人，讨一句字、讨一次脸；也可以是被绕开的那一位，事后才知道他今天来过又没来。"
      },
      {
        "key": "他为什么要绕",
        "value": "怕撞见管教他的人；怕被叫去问话；怕被别的事缠住。理由不重要，重要的是：他宁肯多走一段路，也不肯经过那扇门。"
      },
      {
        "key": "拦住他的人是谁",
        "value": "清客、门客、管事的、账房、买办、部下。他们拦他不是要害他，是想沾他。这一路的奉承合起来只说明一件事：在这个地方，他走到哪里都有人接。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人失去什么。只是他“去看一个人”这件事，被他自己排在了很多人的脸面之后。"
      },
      {
        "key": "玩家若就是被绕开的那一位",
        "value": "这张卡的重点是“他到底来了没有、来做什么”，而不是当场对质。你可以什么也不说，把这件事记住。"
      },
      {
        "key": "这是哪",
        "value": "任何有“门客、下属、必须应酬的人”的地方——旧宅、官府、公司、圈子。"
      },
      {
        "key": "注意",
        "value": "卡停在“他一路绕过来，站在了那扇门前”这一刻。不要写他进去做了什么、那两个人说了什么话。若这一路奉承里有人讨到了东西，把它记下来——那些字往后会出现在别处。"
      }
    ]
  },
  {
    "id": "C8-04-再吃两杯",
    "number": "C8-04",
    "name": "再吃两杯",
    "type": "管束 / 护短",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第八回",
    "rel": "红楼梦/现实类/第八回/C8-04-再吃两杯.md",
    "face": "主人家摆了几样茶食，留客人吃酒。他正吃得高兴，看护他的人上来拦了一句：这个东西，罢了罢。\n\n他不肯，央告说只再吃一杯。\n\n那个看护的人不答应。她讲起从前因为一口酒挨过的骂，最后提了一个人的名字——那人此刻在家，正等着问他书。\n\n他的脸沉了，把杯子慢慢放下。\n\n旁边的人各有各的说法。有人说也罢，有人一句话把看护的人顶了回去，主人也出来担待，说再吃两杯有我。\n\n那样东西就又摆在他面前了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是这个被管住的人，也可以是拦他的看护人，也可以是替他把酒要回来的那位主人。谁在这个桌上，谁都要表态。\n\n**玩家在哪**：玩家可以就是被拦的那个人——你放不放下杯子；可以是拦他的人，赌上自己挨骂也要管；也可以是主人，当着满桌的人替谁说话。\n\n**看护人是谁**：奶母、老仆、跟班、管家、助理、家里派来的人。她不掌权，她是替另一个人看着他的。她真管得住他，只在那一个名字被搬出来的时候。\n\n**为什么她一开口就有效**：她背后站着的是一个他怕的人。这场里真正在说话的不是她。\n\n**代价**：看护的人当众管他，赢了这一回，从此他记恨她；主人护他，护出了他日后谁的话也不听的底气；他放下杯子，是让了；再端起来，是占了上风。\n\n**主人为什么护他**：真心疼这个孩子；也是做给全桌看——在我这儿，不用怕。\n\n**为什么是中的**：没有当场失去什么，但从这一晚起，“他还听谁的”这个问题在满桌人面前有了答案。\n\n**这是哪**：任何有“做客”和“有人管你”的地方——酒席、饭局、亲戚家、宿舍、上司的办公室。\n\n**注意**：卡停在“东西又摆在他面前”这一刻。不要写他最后喝没喝、看护的人走没走。看护的人若就此撒手走了，剩下的场面是这张卡的余波——留给《是我砸的》。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是这个被管住的人，也可以是拦他的看护人，也可以是替他把酒要回来的那位主人。谁在这个桌上，谁都要表态。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是被拦的那个人——你放不放下杯子；可以是拦他的人，赌上自己挨骂也要管；也可以是主人，当着满桌的人替谁说话。"
      },
      {
        "key": "看护人是谁",
        "value": "奶母、老仆、跟班、管家、助理、家里派来的人。她不掌权，她是替另一个人看着他的。她真管得住他，只在那一个名字被搬出来的时候。"
      },
      {
        "key": "为什么她一开口就有效",
        "value": "她背后站着的是一个他怕的人。这场里真正在说话的不是她。"
      },
      {
        "key": "代价",
        "value": "看护的人当众管他，赢了这一回，从此他记恨她；主人护他，护出了他日后谁的话也不听的底气；他放下杯子，是让了；再端起来，是占了上风。"
      },
      {
        "key": "主人为什么护他",
        "value": "真心疼这个孩子；也是做给全桌看——在我这儿，不用怕。"
      },
      {
        "key": "为什么是中的",
        "value": "没有当场失去什么，但从这一晚起，“他还听谁的”这个问题在满桌人面前有了答案。"
      },
      {
        "key": "这是哪",
        "value": "任何有“做客”和“有人管你”的地方——酒席、饭局、亲戚家、宿舍、上司的办公室。"
      },
      {
        "key": "注意",
        "value": "卡停在“东西又摆在他面前”这一刻。不要写他最后喝没喝、看护的人走没走。看护的人若就此撒手走了，剩下的场面是这张卡的余波——留给《是我砸的》。"
      }
    ]
  },
  {
    "id": "C8-05-墙上的三个字",
    "number": "C8-05",
    "name": "墙上的三个字",
    "type": "醉归 / 照料",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第八回",
    "rel": "红楼梦/现实类/第八回/C8-05-墙上的三个字.md",
    "face": "他醉着回来，一进门就看见一个人迎上来，嘴里怨他。\n\n早上他高兴，随手写了三个字，扔下笔就出门了，让人家替他贴上。人家怕别人贴坏，自己爬上去，贴了半天，手到现在还是僵的。\n\n他站在门楣底下看那三个字。字是他的，他早忘了。\n\n旁边又有人说：他早上特意留下的一份吃食，被一个老仆看见了，说“他未必吃”，就端去给了自己家的孙子。\n\n他听完，不发一言。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是写下字又忘了的那个人，也可以是替他贴字、手还僵着的人，也可以是那个端走东西的老仆。谁开口，这张卡就落在谁身上。\n\n**玩家在哪**：玩家可以就是写字的这个人——你要不要给她一句交代；可以是替他做事的人，你冻了半天的手他根本没看见；也可以不在场，第二天听说“他昨晚醉得不轻”。\n\n**为什么是轻的**：没有人失去什么。只是这个家里，谁在替谁费心、谁又根本没看见，第一次被摊在明面上。\n\n**那三个字是什么**：三个字、一个名、一句题字、一个随手画下的记号。要紧的不是字写得好不好，是写的人忘了、贴的人记着。\n\n**那个老仆是谁**：看护人、有资历的老人、他小时候受过其恩的人。她拿走的每一样东西，在她自己看来都理所当然。\n\n**为什么三个人会凑到一处**：替他守了一天的人、被他忘了的人、把东西顺手给了自家人的人，是同一个院子里的三种人。这张卡一演，这三种人就都立起来了。\n\n**这是哪**：任何有“他随手做的事”和“替他收着的人”的地方——家、宿舍、办公室、剧组。\n\n**注意**：卡停在“他听完不发一言”这一刻。不要写他有没有发火。记住那两只手：一只还是僵的，一只刚刚把东西端走——《是我砸的》很可能就在下一场等着。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是写下字又忘了的那个人，也可以是替他贴字、手还僵着的人，也可以是那个端走东西的老仆。谁开口，这张卡就落在谁身上。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是写字的这个人——你要不要给她一句交代；可以是替他做事的人，你冻了半天的手他根本没看见；也可以不在场，第二天听说“他昨晚醉得不轻”。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人失去什么。只是这个家里，谁在替谁费心、谁又根本没看见，第一次被摊在明面上。"
      },
      {
        "key": "那三个字是什么",
        "value": "三个字、一个名、一句题字、一个随手画下的记号。要紧的不是字写得好不好，是写的人忘了、贴的人记着。"
      },
      {
        "key": "那个老仆是谁",
        "value": "看护人、有资历的老人、他小时候受过其恩的人。她拿走的每一样东西，在她自己看来都理所当然。"
      },
      {
        "key": "为什么三个人会凑到一处",
        "value": "替他守了一天的人、被他忘了的人、把东西顺手给了自家人的人，是同一个院子里的三种人。这张卡一演，这三种人就都立起来了。"
      },
      {
        "key": "这是哪",
        "value": "任何有“他随手做的事”和“替他收着的人”的地方——家、宿舍、办公室、剧组。"
      },
      {
        "key": "注意",
        "value": "卡停在“他听完不发一言”这一刻。不要写他有没有发火。记住那两只手：一只还是僵的，一只刚刚把东西端走——《是我砸的》很可能就在下一场等着。"
      }
    ]
  },
  {
    "id": "C8-06-是我砸的",
    "number": "C8-06",
    "name": "是我砸的",
    "type": "摔东西 / 顶罪",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第八回",
    "rel": "红楼梦/现实类/第八回/C8-06-是我砸的.md",
    "face": "他醉了，回到自己屋里，还记着白天的一桩事：有人把他留下的一份东西，拿走了。\n\n他问身边的人：那东西呢。答话的人说，被一个人端走，给了她自己家里的人。\n\n他把手里的杯子顺手往地上一摔。杯子碎了，碎片溅了来送茶的人一裙子。\n\n他跳起来骂：这个家里的人都被惯坏了，比谁都大；说要把人撵出去，说着就要去回上面的人。\n\n外面已经有人跑去报信。屋里的人都愣着。\n\n一个人站了出来，说是自己失手砸的。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是摔东西的这个人，也可以是站出来认下的那个人，也可以是被碎片溅到、还不能辩一句的送茶人。谁开口，这张卡就往谁身上走。\n\n**玩家在哪**：玩家可以就是摔杯子的那个人——你还要不要往上告；可以是替他认下的人，这一句认下，你就替他背了一次错；可以是被溅了裙子的人，你什么都没做；也可以不在场，第二天从别人嘴里听见“昨晚不过是失手砸了个杯子”。\n\n**他为什么发作**：不是为一个杯子，是为“我的东西，别人凭什么动”。他从早上到现在忍了一整天——绕路、被拦、被管、被提醒功课——这一下是全放出来。\n\n**认下的人为什么认**：认一句，事情就小了；不认，事情要闹到上面去，这一屋子人一起赔。她认的不是错，是这一屋子的太平。\n\n**代价**：认下的人，从此手里多了一个人的把柄，也多了一份他的亏欠；摔的人，从此知道自己的火有人收，日后更不好收；被溅的人，事情过去了，她什么也没得到。\n\n**顶罪有别的做法吗**：可以不认，让这事闹上去；可以认下再私下算账；可以只把碎片扫了，谁都不提。这几条路各有各的后果，都不是过场。\n\n**这是哪**：任何有“主家和做事的人”“被宠着的人和替人操心的人”的地方——宅门、公司、球队、宿舍。\n\n**注意**：卡停在“一个人站出来说是我失手砸的”这一刻。不要写上面的人后来问了什么。若这句谎说出口了，把它记下来——它迟早要对一次账。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是摔东西的这个人，也可以是站出来认下的那个人，也可以是被碎片溅到、还不能辩一句的送茶人。谁开口，这张卡就往谁身上走。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是摔杯子的那个人——你还要不要往上告；可以是替他认下的人，这一句认下，你就替他背了一次错；可以是被溅了裙子的人，你什么都没做；也可以不在场，第二天从别人嘴里听见“昨晚不过是失手砸了个杯子”。"
      },
      {
        "key": "他为什么发作",
        "value": "不是为一个杯子，是为“我的东西，别人凭什么动”。他从早上到现在忍了一整天——绕路、被拦、被管、被提醒功课——这一下是全放出来。"
      },
      {
        "key": "认下的人为什么认",
        "value": "认一句，事情就小了；不认，事情要闹到上面去，这一屋子人一起赔。她认的不是错，是这一屋子的太平。"
      },
      {
        "key": "代价",
        "value": "认下的人，从此手里多了一个人的把柄，也多了一份他的亏欠；摔的人，从此知道自己的火有人收，日后更不好收；被溅的人，事情过去了，她什么也没得到。"
      },
      {
        "key": "顶罪有别的做法吗",
        "value": "可以不认，让这事闹上去；可以认下再私下算账；可以只把碎片扫了，谁都不提。这几条路各有各的后果，都不是过场。"
      },
      {
        "key": "这是哪",
        "value": "任何有“主家和做事的人”“被宠着的人和替人操心的人”的地方——宅门、公司、球队、宿舍。"
      },
      {
        "key": "注意",
        "value": "卡停在“一个人站出来说是我失手砸的”这一刻。不要写上面的人后来问了什么。若这句谎说出口了，把它记下来——它迟早要对一次账。"
      }
    ]
  },
  {
    "id": "C9-01-出门",
    "number": "C9-01",
    "name": "出门",
    "type": "离家 / 托付",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第九回",
    "rel": "红楼梦/现实类/第九回/C9-01-出门.md",
    "face": "天没亮，家里的人先起来了。要出门的那个人被叫醒，衣裳、带子、鞋，一样样穿好；早饭端上来，没人吃什么。\n\n箱子已经打好了，就一件。经手的人翻开来又看一眼，把里头的纸和笔点过一遍，合上。旁边的人一句一句地叮嘱：念书的时候想着书，不念的时候想着家；别跟人玩闹；路上多穿一件；冷了自己叫人笼上。\n\n那个人一句一句都应下来。\n\n走到门口，他回过身，跟平时最疼他的那个人说了几句话。然后往外走，走了几步，又回头看了一眼。\n\n门里的人站着不动，看他上了车。门关上了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是要出门的这个人，也可以是送他出门的任何一个家里人。若玩家在意这个人，这张卡就重；若玩家只是那个替他收拾箱子的人，也一样有得应对——交出去的东西是好是坏，要过很久才知道。\n\n**玩家在哪**：玩家可以是出门的人，当场被一屋子人叮嘱；可以是站在门里的家人；也可以根本不在场，回来才发现那个人已经走了，屋里空出一张床。\n\n**出门做什么**：上学、当差、学徒、参军、去外地做事、去投靠人。去处越正当，这张卡越像好事——它的重量在于“往后这件事家里管不着了”。\n\n**箱子里是什么**：几件换洗衣裳、一套纸笔、一点钱、一件旧的、一件家人非要他带上的东西。也可以什么都不给，只给他一个名字和一句托付。\n\n**谁在叮嘱**：疼爱他的人、管他的人、照顾他的人、跟了他很多年的人。叮嘱的人越多，说明这个人身上挂着的关系越多；叮嘱的话多半是废话，说的人也知道是废话。\n\n**门口那一下**：出门的人和送的人，总要有一个先说走、一个先转身。谁先说，谁就欠着。\n\n**这是哪**：任何有“离家去一个别人管着的地方”的世界——寄宿、远行、入职、外派、住校。\n\n**注意**：卡停在“门关上”这一刻。不要写他在外面念得怎么样，也不要写家里后来发生了什么。今天之后，他的事，家里就只剩听说。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是要出门的这个人，也可以是送他出门的任何一个家里人。若玩家在意这个人，这张卡就重；若玩家只是那个替他收拾箱子的人，也一样有得应对——交出去的东西是好是坏，要过很久才知道。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是出门的人，当场被一屋子人叮嘱；可以是站在门里的家人；也可以根本不在场，回来才发现那个人已经走了，屋里空出一张床。"
      },
      {
        "key": "出门做什么",
        "value": "上学、当差、学徒、参军、去外地做事、去投靠人。去处越正当，这张卡越像好事——它的重量在于“往后这件事家里管不着了”。"
      },
      {
        "key": "箱子里是什么",
        "value": "几件换洗衣裳、一套纸笔、一点钱、一件旧的、一件家人非要他带上的东西。也可以什么都不给，只给他一个名字和一句托付。"
      },
      {
        "key": "谁在叮嘱",
        "value": "疼爱他的人、管他的人、照顾他的人、跟了他很多年的人。叮嘱的人越多，说明这个人身上挂着的关系越多；叮嘱的话多半是废话，说的人也知道是废话。"
      },
      {
        "key": "门口那一下",
        "value": "出门的人和送的人，总要有一个先说走、一个先转身。谁先说，谁就欠着。"
      },
      {
        "key": "这是哪",
        "value": "任何有“离家去一个别人管着的地方”的世界——寄宿、远行、入职、外派、住校。"
      },
      {
        "key": "注意",
        "value": "卡停在“门关上”这一刻。不要写他在外面念得怎么样，也不要写家里后来发生了什么。今天之后，他的事，家里就只剩听说。"
      }
    ]
  },
  {
    "id": "C9-02-还是一起走",
    "number": "C9-02",
    "name": "还是一起走",
    "type": "结伴 / 情分",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第九回",
    "rel": "红楼梦/现实类/第九回/C9-02-还是一起走.md",
    "face": "两个人是一起进来的。于是一起走、一起坐、一起起、一起睡，几天的工夫，比认了十年的兄弟还近。\n\n甲说：咱们同岁，又在一处，往后别再论那些辈分，就当兄弟。\n\n对方不敢，往后躲了半步。甲又说了一遍。对方只得应了，从此两边都改了口。\n\n这件事，两人都没跟家里说。\n\n同一个场子里，天天有人同进同出。有人看他们走得近，慢慢地，也学着换了个叫法。门口、廊下、饭桌边，叫那个称呼的人越来越多。\n\n甲听着，觉得挺好。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是两个人里往前迈的那一个，也是那个自己定了新称呼的人。玩家若站在这个位子上，这张卡要问的就是：你要的这个“自己人”，是拉近了一个人，还是得罪了一整串人。\n\n**玩家在哪**：玩家可以是甲；可以是那个被改口的人——改不改、应不应，是你自己的事；也可以是场子里天天看着这两个人的旁人。\n\n**两人原本是什么关系**：同族、差一辈、上司与下属、师徒、亲戚、邻居家的孩子。原本差得越多，这一步迈出去，日后越难收。\n\n**称呼是什么**：名、字、小名、外号、直接叫“兄弟”、干脆不带称呼。改的是一个字，动的是两个人在这张关系网里的位置。\n\n**“不提辈分”意味着什么**：两个人之间的规矩松了，也就等于对家里那一套规矩松了。这个场子里的人都看得见。\n\n**还有谁在听**：同一个场子里天天同进同出的人、管事的、家里派来看顾的人。他们学会叫这个新称呼的时候，甲的决定就已经不止是两个人的事了。\n\n**这是哪**：任何一群人被放在一起过日子的地方——学堂、宿舍、学徒房、军营、公司、书院。\n\n**注意**：卡停在“叫那个称呼的人越来越多”这一刻。不要写甲后来有没有因此吃亏，也不要写对方心里愿不愿意。这两个人现在是自己人了；从此他们在外人眼里，也是自己人了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是两个人里往前迈的那一个，也是那个自己定了新称呼的人。玩家若站在这个位子上，这张卡要问的就是：你要的这个“自己人”，是拉近了一个人，还是得罪了一整串人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲；可以是那个被改口的人——改不改、应不应，是你自己的事；也可以是场子里天天看着这两个人的旁人。"
      },
      {
        "key": "两人原本是什么关系",
        "value": "同族、差一辈、上司与下属、师徒、亲戚、邻居家的孩子。原本差得越多，这一步迈出去，日后越难收。"
      },
      {
        "key": "称呼是什么",
        "value": "名、字、小名、外号、直接叫“兄弟”、干脆不带称呼。改的是一个字，动的是两个人在这张关系网里的位置。"
      },
      {
        "key": "“不提辈分”意味着什么",
        "value": "两个人之间的规矩松了，也就等于对家里那一套规矩松了。这个场子里的人都看得见。"
      },
      {
        "key": "还有谁在听",
        "value": "同一个场子里天天同进同出的人、管事的、家里派来看顾的人。他们学会叫这个新称呼的时候，甲的决定就已经不止是两个人的事了。"
      },
      {
        "key": "这是哪",
        "value": "任何一群人被放在一起过日子的地方——学堂、宿舍、学徒房、军营、公司、书院。"
      },
      {
        "key": "注意",
        "value": "卡停在“叫那个称呼的人越来越多”这一刻。不要写甲后来有没有因此吃亏，也不要写对方心里愿不愿意。这两个人现在是自己人了；从此他们在外人眼里，也是自己人了。"
      }
    ]
  },
  {
    "id": "C9-03-埋着东西",
    "number": "C9-03",
    "name": "埋着东西",
    "type": "私情 / 被看见",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第九回",
    "rel": "红楼梦/现实类/第九回/C9-03-埋着东西.md",
    "face": "场子里有两个人，走得比别人近一点。\n\n那天他们避开人，到后面去说话。话说到一半，背后有人咳了一声——是常在一起的人里的一个，站在那儿，已经听了一会儿。\n\n问的人脸红到耳根，先发难：我们说话，碍着你什么了？\n\n那人笑了：你们说话，就不许我咳嗽？有话不当着人说，倒躲在这儿。我拿住了，还赖什么。\n\n说完又拍着手，把这件事当笑话嚷了两句，嚷得前后都听见。\n\n那两个人急了，跑去跟管事的说有人欺负他们。管事的听完，反过来怪他们多事。于是他们的话没处说了。\n\n在场的人，从此都知道了这件事；那两个人，也从此矮了半头。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这两个人里的一个，也可以是那个咳嗽的人，或者是管事的。三方都有得应对：说破、护住、还是压下去。\n\n**玩家在哪**：玩家可以在场；也可以是那两个当事人之一，当场决定认不认；也可以完全不在场，事后发现全屋子的人看你的眼神都变了。\n\n**被看见的是什么**：私下的亲近、一句不该说的话、一笔钱、一封信、一个不该有的往来。卡不判定这件事对不对，只判定它被看见了。\n\n**“被看见”为什么致命**：从这一刻起，这件事不再是两个人的事，而是场子里所有人的谈资。当事人再想解释，也只是加一条谈资。\n\n**那两个人怕的是什么**：怕名声、怕家里知道、怕被赶出去、怕坐在旁边的人从此躲着自己。越怕，越容易先出手伤人——这常常是乱子的开头。\n\n**管事的为什么怪他们**：因为压住两个当事人比管住满屋子的人容易；也因为告状这件事本身，就已经把事捅到台面上了。\n\n**这是哪**：任何有“不能公开的关系”的地方——学堂、宿舍、单位、圈子、家族。人越多，越藏不住。\n\n**注意**：卡停在“在场的人从此都知道了”这一刻。不要写那两个人后来怎么样，也不要写谣言传成了什么样子。这件事已经不在他们手里了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这两个人里的一个，也可以是那个咳嗽的人，或者是管事的。三方都有得应对：说破、护住、还是压下去。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场；也可以是那两个当事人之一，当场决定认不认；也可以完全不在场，事后发现全屋子的人看你的眼神都变了。"
      },
      {
        "key": "被看见的是什么",
        "value": "私下的亲近、一句不该说的话、一笔钱、一封信、一个不该有的往来。卡不判定这件事对不对，只判定它被看见了。"
      },
      {
        "key": "“被看见”为什么致命",
        "value": "从这一刻起，这件事不再是两个人的事，而是场子里所有人的谈资。当事人再想解释，也只是加一条谈资。"
      },
      {
        "key": "那两个人怕的是什么",
        "value": "怕名声、怕家里知道、怕被赶出去、怕坐在旁边的人从此躲着自己。越怕，越容易先出手伤人——这常常是乱子的开头。"
      },
      {
        "key": "管事的为什么怪他们",
        "value": "因为压住两个当事人比管住满屋子的人容易；也因为告状这件事本身，就已经把事捅到台面上了。"
      },
      {
        "key": "这是哪",
        "value": "任何有“不能公开的关系”的地方——学堂、宿舍、单位、圈子、家族。人越多，越藏不住。"
      },
      {
        "key": "注意",
        "value": "卡停在“在场的人从此都知道了”这一刻。不要写那两个人后来怎么样，也不要写谣言传成了什么样子。这件事已经不在他们手里了。"
      }
    ]
  },
  {
    "id": "C9-04-当众一句话",
    "number": "C9-04",
    "name": "当众一句话",
    "type": "管事 / 偏私",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第九回",
    "rel": "红楼梦/现实类/第九回/C9-04-当众一句话.md",
    "face": "有人到管事的人面前告状，说自己被欺负了。\n\n这人本该当场给个说法。可他先前收过另一边的好处，也不愿得罪那边的人，于是把告状的人训了一顿——说他多事，说他不该拿到这儿来说。告状的人反讨了个没趣，退回去了。\n\n被告的那一个得了意，摇头咂嘴，嘴里还不停。\n\n场子里的人都听见了，也都看明白了。管事的这一句，从此就是这里的规矩。\n\n告状的人还站在那儿。被告的人还在说。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是手里有一点权的那个人——代管的、管事的、年长一点的、被指派的。玩家若占这个槽，卡的重点是“你明知道谁对谁错，你还是得选一边”。\n\n**玩家在哪**：玩家可以在场；可以是那个被告状的人，眼看着这一句把自己保下来了；也可以是告状的那一个，当众被压回去。若玩家是告状的人，这一句之后你有得应对：忍着、换个法子捅上去、还是从此不再开口。\n\n**他为什么偏着那边**：收过好处、怕那边的人、自己也欠着人情、嫌麻烦、想借这一回立威，或者只是不愿意在自己管的地界上出乱子。\n\n**他有没有别的办法**：有——各打五十大板、当场查明、往上交、先按下不表。每一种都要付代价。卡不写他该怎么做，只写他做了什么。\n\n**这一句的代价**：压得下去，场子当场不散；压不下去，往后这里的话就没处说了。两种都是真的。\n\n**这是哪**：任何“有人管着一群人”的地方——学堂、班组、宿舍、连队、公司、宗族会议。\n\n**注意**：卡停在“他说完了这一句，告状的人还站在那儿”这一刻。不要写他心里的理由，也不要写告状的人接下来怎么办。今天当众定下的这个调子，往后谁还愿意来这里讲道理，就从这一句开始算。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是手里有一点权的那个人——代管的、管事的、年长一点的、被指派的。玩家若占这个槽，卡的重点是“你明知道谁对谁错，你还是得选一边”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场；可以是那个被告状的人，眼看着这一句把自己保下来了；也可以是告状的那一个，当众被压回去。若玩家是告状的人，这一句之后你有得应对：忍着、换个法子捅上去、还是从此不再开口。"
      },
      {
        "key": "他为什么偏着那边",
        "value": "收过好处、怕那边的人、自己也欠着人情、嫌麻烦、想借这一回立威，或者只是不愿意在自己管的地界上出乱子。"
      },
      {
        "key": "他有没有别的办法",
        "value": "有——各打五十大板、当场查明、往上交、先按下不表。每一种都要付代价。卡不写他该怎么做，只写他做了什么。"
      },
      {
        "key": "这一句的代价",
        "value": "压得下去，场子当场不散；压不下去，往后这里的话就没处说了。两种都是真的。"
      },
      {
        "key": "这是哪",
        "value": "任何“有人管着一群人”的地方——学堂、班组、宿舍、连队、公司、宗族会议。"
      },
      {
        "key": "注意",
        "value": "卡停在“他说完了这一句，告状的人还站在那儿”这一刻。不要写他心里的理由，也不要写告状的人接下来怎么办。今天当众定下的这个调子，往后谁还愿意来这里讲道理，就从这一句开始算。"
      }
    ]
  },
  {
    "id": "C9-05-别人的手",
    "number": "C9-05",
    "name": "别人的手",
    "type": "借势 / 挑动",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第九回",
    "rel": "红楼梦/现实类/第九回/C9-05-别人的手.md",
    "face": "甲听说自己的一个熟人吃了亏。欺负人的那一边，恰好是甲不愿当面得罪的人——两边还都跟同一个人有交情。\n\n甲没有自己出面。\n\n甲找了个年轻、火气旺、经不住话的人，把话递过去：某人怎么欺负了某人，连你也牵扯在里头，不给他个知道，下回越发狂纵。\n\n话递完，甲找了个由头，先走一步。\n\n那个年轻人转身就冲了进去。\n\n甲往回走的时候，里头已经嚷起来了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个不想脏了自己的手、又咽不下这口气的人。他有身份、有人可用、有两头都要顾的关系，所以他选择用别人的火。\n\n**玩家在哪**：玩家可以在场，看着甲把人叫到一边；也可以是那个被递话的年轻人——你就是那把刀，递刀的人已经走了；也可以是被欺负的那一个，还不知道外头已经闹起来了。\n\n**为什么不出面**：怕伤和气、怕得罪上头的人、怕自己也被卷进去、拉不下脸。每一条都成立，每一条都让甲选了更脏的那条路。\n\n**递话的技巧**：提到对方的名字、提到这一点点旧交情、提到“连你也牵扯在内”。三句里最有用的是最后一句——人被算进去，就会自己动。\n\n**被递话的人有什么特点**：年轻、揽事、不细想、在乎脸面、想被上头看重。这种人每个场子里都有，也都很好找。\n\n**这样做保住了什么**：甲的手是干净的，甲的人情还在，甲的体面也还在。代价是——那把刀知道是谁递的。\n\n**这是哪**：任何有派系、有上下、有“自己人”的地方——学堂、圈子、机关、公司、帮派、家族内部。\n\n**注意**：卡停在“年轻人冲进去，甲已经走开”这一刻。不要写甲事后有没有后悔，也不要写这架打成什么样。这一回的火是别人点的，账却未必只落在别人头上。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个不想脏了自己的手、又咽不下这口气的人。他有身份、有人可用、有两头都要顾的关系，所以他选择用别人的火。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，看着甲把人叫到一边；也可以是那个被递话的年轻人——你就是那把刀，递刀的人已经走了；也可以是被欺负的那一个，还不知道外头已经闹起来了。"
      },
      {
        "key": "为什么不出面",
        "value": "怕伤和气、怕得罪上头的人、怕自己也被卷进去、拉不下脸。每一条都成立，每一条都让甲选了更脏的那条路。"
      },
      {
        "key": "递话的技巧",
        "value": "提到对方的名字、提到这一点点旧交情、提到“连你也牵扯在内”。三句里最有用的是最后一句——人被算进去，就会自己动。"
      },
      {
        "key": "被递话的人有什么特点",
        "value": "年轻、揽事、不细想、在乎脸面、想被上头看重。这种人每个场子里都有，也都很好找。"
      },
      {
        "key": "这样做保住了什么",
        "value": "甲的手是干净的，甲的人情还在，甲的体面也还在。代价是——那把刀知道是谁递的。"
      },
      {
        "key": "这是哪",
        "value": "任何有派系、有上下、有“自己人”的地方——学堂、圈子、机关、公司、帮派、家族内部。"
      },
      {
        "key": "注意",
        "value": "卡停在“年轻人冲进去，甲已经走开”这一刻。不要写甲事后有没有后悔，也不要写这架打成什么样。这一回的火是别人点的，账却未必只落在别人头上。"
      }
    ]
  },
  {
    "id": "C9-06-动了手",
    "number": "C9-06",
    "name": "动了手",
    "type": "动手 / 失控",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第九回",
    "rel": "红楼梦/现实类/第九回/C9-06-动了手.md",
    "face": "一样东西从那边飞过来，没打到它要去的地方，落在旁边一张桌上。一只壶碎了，墨泼了一桌，一本书全湿了。\n\n那本来只是两个人之间的私事。\n\n四边的人一下子都站了起来。有人抄起手边的东西，有人叫帮手，有人开始喊打。有个孩子按住同伴的手，说不管我们的事；同伴抱起自己的东西扔了过去，力气小，扔不到那边，砸在另一张桌上——那一桌的书、纸、笔，连同一只碗，全翻在地上。\n\n有人抄起一根长棍。地方窄，人多，抡开来谁挨着谁。\n\n到这时候，甲的手里也有东西了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这个场子里已经卷进去的任何一个人——起初挨着坐的、被误伤的、想劝没劝住的。若玩家占这个槽，卡的重点是“已经有一件东西落在你这一桌上了，你打算怎么办”。\n\n**玩家在哪**：玩家可以在场，甚至就是被砸到的那一个；也可以不在场，事后听满屋子的人说谁先动的手——说法一定不止一套。\n\n**第一件东西**：一块砚、一只杯、一本书、一只瓶子、一把椅子。它一定不是冲着被砸的人去的。乱子从来不是从“打中”开始的，是从“打偏了”开始的。\n\n**按住手的那个人是谁**：一个想息事宁人的孩子、一个年长的同伴、一个还记得规矩的人。他拦没拦住，是这张卡的天平。\n\n**旁观的人都做了什么**：帮拳的、躲开的、站到桌上拍手叫好的、趁乱算旧账的。人一多，就一定会分这几拨。\n\n**为什么收不住**：动手之后，事情从“谁对谁错”变成“谁还没吃亏”。到这一步，谁先停手谁就像认了输。\n\n**这是哪**：任何一群被长期关在一处的人——学堂、宿舍、车间、军营、酒馆、街区。\n\n**注意**：卡停在“甲的手里也有东西了”这一刻。不要写谁打破了头，也不要写这场乱子怎么收场。地上见了东西之后，这一群人往后怎么相处，就有了一个新规矩——不是从前那个。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这个场子里已经卷进去的任何一个人——起初挨着坐的、被误伤的、想劝没劝住的。若玩家占这个槽，卡的重点是“已经有一件东西落在你这一桌上了，你打算怎么办”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，甚至就是被砸到的那一个；也可以不在场，事后听满屋子的人说谁先动的手——说法一定不止一套。"
      },
      {
        "key": "第一件东西",
        "value": "一块砚、一只杯、一本书、一只瓶子、一把椅子。它一定不是冲着被砸的人去的。乱子从来不是从“打中”开始的，是从“打偏了”开始的。"
      },
      {
        "key": "按住手的那个人是谁",
        "value": "一个想息事宁人的孩子、一个年长的同伴、一个还记得规矩的人。他拦没拦住，是这张卡的天平。"
      },
      {
        "key": "旁观的人都做了什么",
        "value": "帮拳的、躲开的、站到桌上拍手叫好的、趁乱算旧账的。人一多，就一定会分这几拨。"
      },
      {
        "key": "为什么收不住",
        "value": "动手之后，事情从“谁对谁错”变成“谁还没吃亏”。到这一步，谁先停手谁就像认了输。"
      },
      {
        "key": "这是哪",
        "value": "任何一群被长期关在一处的人——学堂、宿舍、车间、军营、酒馆、街区。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲的手里也有东西了”这一刻。不要写谁打破了头，也不要写这场乱子怎么收场。地上见了东西之后，这一群人往后怎么相处，就有了一个新规矩——不是从前那个。"
      }
    ]
  },
  {
    "id": "C10-01-张不开口",
    "number": "C10-01",
    "name": "张不开口",
    "type": "依附 / 吞声",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十回",
    "rel": "红楼梦/现实类/第十回/C10-01-张不开口.md",
    "face": "甲的孩子在外面受了气。拦住他的人不止一个，孩子被按着低了头，赔了不是才回家。回来以后，孩子气不过，说要去把话说开。\n\n甲把孩子按住了：念书的地方是托人求来的，离了那家，再没有第二个地方。\n\n甲自己却没忍住。甲上了车，去了那户人家，名义上是看看。\n\n进门，女主人先叹了气，说家里有人病了，几个月没见红，请了好几位大夫，一个说是喜，一个说是病，如今连饭都懒得吃。女主人说了很久，甲一句也没插上。\n\n临走，主人家留甲吃饭。甲谢了，说不好意思再坐，笑着告辞。\n\n“讨说法”三个字，甲没有说出口。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家家中的长辈、配偶、亲戚。甲必须是“既咽不下这口气、又不敢得罪人家”的那一个；甲要是根本不在乎，这张卡就没有味道。\n\n**玩家在哪**：玩家可以是甲，坐车上门、坐在那间屋里、决定开不开口；也可以是那个孩子，被大人按住了，只能看着家里人出门；也可以不在场，事后只听说甲去了一趟、什么也没说就回来了。若玩家就是那个孩子，卡的重点变成“你的家里人护不护得住你”。\n\n**那个孩子为什么受气**：抢了别人的风头、和人有私下的往来、被当成靠人撑腰的、说了不该说的话。“不干不净的话”指把孩子的体面和名声扯进去——这一句是甲非去不可的理由，换成别的难听话也可以，但必须伤到家里的脸面。\n\n**对方是谁家**：能决定甲家孩子去处的人家、有恩于甲家的一户、甲家得罪不起的一门亲戚。家里说话管事的女主人是这张卡的关键：她未必知道甲为什么来，她正被自家的事占着。\n\n**那场病是什么**：可以是真病，也可以只是挡人的话。但它必须是真的让那家人“心里焦”，甲才不好意思开口；若对方是装病躲甲，卡就变成“甲被人挡在门外”，味道不同。\n\n**甲是什么关系**：若是寄居的人、靠人资助的人、欠着人情的人，卡的重量翻倍。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。“车”可以是车、轿、船、航班、传送阵；但“托了别人才得着这个位子”这一层必须留着。\n\n**注意**：卡停在“‘讨说法’三个字没有说出口”这一刻。不要写甲最后有没有提、有没有人替甲提、这事日后算不算完。甲咽下去的这一口气，是下一张卡的入口。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家家中的长辈、配偶、亲戚。甲必须是“既咽不下这口气、又不敢得罪人家”的那一个；甲要是根本不在乎，这张卡就没有味道。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，坐车上门、坐在那间屋里、决定开不开口；也可以是那个孩子，被大人按住了，只能看着家里人出门；也可以不在场，事后只听说甲去了一趟、什么也没说就回来了。若玩家就是那个孩子，卡的重点变成“你的家里人护不护得住你”。"
      },
      {
        "key": "那个孩子为什么受气",
        "value": "抢了别人的风头、和人有私下的往来、被当成靠人撑腰的、说了不该说的话。“不干不净的话”指把孩子的体面和名声扯进去——这一句是甲非去不可的理由，换成别的难听话也可以，但必须伤到家里的脸面。"
      },
      {
        "key": "对方是谁家",
        "value": "能决定甲家孩子去处的人家、有恩于甲家的一户、甲家得罪不起的一门亲戚。家里说话管事的女主人是这张卡的关键：她未必知道甲为什么来，她正被自家的事占着。"
      },
      {
        "key": "那场病是什么",
        "value": "可以是真病，也可以只是挡人的话。但它必须是真的让那家人“心里焦”，甲才不好意思开口；若对方是装病躲甲，卡就变成“甲被人挡在门外”，味道不同。"
      },
      {
        "key": "甲是什么关系",
        "value": "若是寄居的人、靠人资助的人、欠着人情的人，卡的重量翻倍。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。“车”可以是车、轿、船、航班、传送阵；但“托了别人才得着这个位子”这一层必须留着。"
      },
      {
        "key": "注意",
        "value": "卡停在“‘讨说法’三个字没有说出口”这一刻。不要写甲最后有没有提、有没有人替甲提、这事日后算不算完。甲咽下去的这一口气，是下一张卡的入口。"
      }
    ]
  },
  {
    "id": "C10-02-一句准话",
    "number": "C10-02",
    "name": "一句准话",
    "type": "求医 / 悬着",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十回",
    "rel": "红楼梦/现实类/第十回/C10-02-一句准话.md",
    "face": "甲家里有人病了很久。\n\n大夫换过好几位，说法各不相同：一个说是喜，一个说是病，一个说不相干，一个说怕熬不过某个节气。药一直没断，人一天比一天懒得说话、懒得吃饭。\n\n甲的家里人开始四处打听：谁还认得个真能看病的人。\n\n有人提起一个，说他诊得极准，断得清是喜是病；只一样，请他很不容易。那位中间人先替甲家求过一遍，甲家又递了名帖去请。\n\n回来的人说：先生今日拜了一天客，精神支不住，就是说去了也诊不准，改明日必来；名帖他不敢当，让原样带回。\n\n家里于是把别的事都往后推了，只等明天。\n\n第二日中午，门上的人进来报：先生到了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的家人、亲戚、朋友。甲是“做得了主”的那个人——出得起钱、递得出名帖、能让全家等一天。\n\n**玩家在哪**：玩家可以是甲，决定请谁、花多少、要不要等；也可以是生病的那个人，躺在床上听外面的人替自己张罗；也可以不在场，事后听说某一天家里来了一位先生。若玩家是跑腿送帖的人，卡的重点变成“你被夹在两头中间”。\n\n**病人是谁**：家里的女主人、儿媳、女儿、长辈、孩子、伴侣。病情要“不好也不坏”，悬着——只有悬着，家里人才会把希望全押在下一个大夫身上。\n\n**前面几位大夫是什么人**：轮流来看、说辞互相矛盾、方子不停换、说的都是“再看”。他们不是庸医，也不必有恶意；他们是这张卡的前半段。\n\n**来的这个人是谁**：一个退隐的、被举荐的、远道而来的医者；也可以是能看事的异人、手上有偏方的老药师。分两种：若他只是医术极精，归现实类；若他真的能断人生死、话必应验，改归奇幻类，骨架不变。\n\n**他为什么不肯当夜就来**：真的累了、要端着身价、规矩如此、或者要等自己心里有数。不必写成傲慢；也不必写成推托。\n\n**这是哪**：任何有“看病”的世界——医院、名医、诊所、药师、术士、修者。\n\n**注意**：卡停在“先生到了”这一刻。不要写他开什么方子，也不要写他说不说得准。他到了，才是下一张卡。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的家人、亲戚、朋友。甲是“做得了主”的那个人——出得起钱、递得出名帖、能让全家等一天。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，决定请谁、花多少、要不要等；也可以是生病的那个人，躺在床上听外面的人替自己张罗；也可以不在场，事后听说某一天家里来了一位先生。若玩家是跑腿送帖的人，卡的重点变成“你被夹在两头中间”。"
      },
      {
        "key": "病人是谁",
        "value": "家里的女主人、儿媳、女儿、长辈、孩子、伴侣。病情要“不好也不坏”，悬着——只有悬着，家里人才会把希望全押在下一个大夫身上。"
      },
      {
        "key": "前面几位大夫是什么人",
        "value": "轮流来看、说辞互相矛盾、方子不停换、说的都是“再看”。他们不是庸医，也不必有恶意；他们是这张卡的前半段。"
      },
      {
        "key": "来的这个人是谁",
        "value": "一个退隐的、被举荐的、远道而来的医者；也可以是能看事的异人、手上有偏方的老药师。分两种：若他只是医术极精，归现实类；若他真的能断人生死、话必应验，改归奇幻类，骨架不变。"
      },
      {
        "key": "他为什么不肯当夜就来",
        "value": "真的累了、要端着身价、规矩如此、或者要等自己心里有数。不必写成傲慢；也不必写成推托。"
      },
      {
        "key": "这是哪",
        "value": "任何有“看病”的世界——医院、名医、诊所、药师、术士、修者。"
      },
      {
        "key": "注意",
        "value": "卡停在“先生到了”这一刻。不要写他开什么方子，也不要写他说不说得准。他到了，才是下一张卡。"
      }
    ]
  },
  {
    "id": "C10-03-过了春分",
    "number": "C10-03",
    "name": "过了春分",
    "type": "诊断 / 拖与熬",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十回",
    "rel": "红楼梦/现实类/第十回/C10-03-过了春分.md",
    "face": "请来的那位先生进了内室。他不让人先说病，说先看脉，看完再说，看自己说得对不对。\n\n他把手按在腕上细诊，换过另一只手，又诊了半刻。诊完，他起身到外间坐下，把这两个月里的事一条一条说出来：夜里睡不着，胁下发胀，午后发热，早上出汗，头目发晕，不想吃饭。全对上了。\n\n他说：先前是喜是病，众位耽误了；若在初起时用药，如今只怕已经好了。病到这一步，还有三分治得。\n\n然后他写下几味药，一条一条交代引子。屋里人捧着方子传看。\n\n最后，甲还是问了那句：这病，于性命到底妨不妨？\n\n先生笑了一笑，说：今年这一冬不相干，总是过了春分，就可望全愈了。\n\n做主的那个年轻人听懂了，没有再问下去。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是当家的、病人的配偶、病人的公公婆婆、陪诊的家人。甲是那个必须当场追问、又必须当场决定信不信的人。\n\n**玩家在哪**：玩家可以是甲，追问下去或者收住不问；可以是生病的那个人，隔着帐子听人给自己判长短；可以是跟着先生进来的年轻人，替家里传话；也可以不在场，事后听人转述“先生说是还能治”。若玩家就是那位先生，卡的重点变成“你要不要把真话说完”。\n\n**这位先生是谁**：名医、术士、老药师、看过很多人的长辈。他可以是有真本事的，也可以是会顺着人说话、只说半截的；两种都成立，但都不许说死。若他真是断人生死、话必应验的异人，改归奇幻类，骨架不变。\n\n**那场病是什么**：可以是身病，也可以是心病、耗出来的病、拖出来的病。先生那番“想得太多、心里压着事”的说法，比药方更要紧——若是心病，这张卡的分量翻倍。\n\n**那句回答是什么意思**：两手都可以落。落“能治”，后面可以真的好转；落“不能治”，就是先给全家一个可以安心的理由，把最要紧的话留到以后。哪一种都行，卡不裁定。\n\n**屋里还有谁**：侍候的老仆、看过前几轮的大夫、别的家人。他们听完了会各自传话，传出去的话往往比先生原话更满。\n\n**这是哪**：诊室、病房、内室、榻前、药师堂、术士的院子，都可以。\n\n**注意**：卡停在“该问的都问完了，屋里的人捧着方子看”这一刻。不要写药吃了有没有效，也不要写病到底能不能好。先生没说出口的那半句，留给后面；方子到了谁手里，就是下一张卡。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是当家的、病人的配偶、病人的公公婆婆、陪诊的家人。甲是那个必须当场追问、又必须当场决定信不信的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，追问下去或者收住不问；可以是生病的那个人，隔着帐子听人给自己判长短；可以是跟着先生进来的年轻人，替家里传话；也可以不在场，事后听人转述“先生说是还能治”。若玩家就是那位先生，卡的重点变成“你要不要把真话说完”。"
      },
      {
        "key": "这位先生是谁",
        "value": "名医、术士、老药师、看过很多人的长辈。他可以是有真本事的，也可以是会顺着人说话、只说半截的；两种都成立，但都不许说死。若他真是断人生死、话必应验的异人，改归奇幻类，骨架不变。"
      },
      {
        "key": "那场病是什么",
        "value": "可以是身病，也可以是心病、耗出来的病、拖出来的病。先生那番“想得太多、心里压着事”的说法，比药方更要紧——若是心病，这张卡的分量翻倍。"
      },
      {
        "key": "那句回答是什么意思",
        "value": "两手都可以落。落“能治”，后面可以真的好转；落“不能治”，就是先给全家一个可以安心的理由，把最要紧的话留到以后。哪一种都行，卡不裁定。"
      },
      {
        "key": "屋里还有谁",
        "value": "侍候的老仆、看过前几轮的大夫、别的家人。他们听完了会各自传话，传出去的话往往比先生原话更满。"
      },
      {
        "key": "这是哪",
        "value": "诊室、病房、内室、榻前、药师堂、术士的院子，都可以。"
      },
      {
        "key": "注意",
        "value": "卡停在“该问的都问完了，屋里的人捧着方子看”这一刻。不要写药吃了有没有效，也不要写病到底能不能好。先生没说出口的那半句，留给后面；方子到了谁手里，就是下一张卡。"
      }
    ]
  },
  {
    "id": "C10-04-不办寿",
    "number": "C10-04",
    "name": "不办寿",
    "type": "礼数 / 拒绝",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十回",
    "rel": "红楼梦/现实类/第十回/C10-04-不办寿.md",
    "face": "家里老人的生日快到了。晚辈备了两天的席，打算把一大家子都请来，让老人坐上来受一受礼。\n\n晚辈先去请安，顺口提了这件事。\n\n老人说：我清净惯了，不到你们那热闹场里去。你们要拿我的生日做由头，就把我从前整理的那份旧稿子，好好找人抄出来、刻出来——比让我没来由地受一屋子人的礼强得多。后日你们一家子要来，就在家里好好待他们；也不必给我送什么来，后日你也不必来。\n\n老人又说：你要心里过意不去，今天就给我磕个头去。\n\n晚辈没有再说第二遍。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是当家的、老人的儿女、管事的家人。甲是那个“想办、又不敢违”的人。\n\n**玩家在哪**：玩家可以是甲，站在老人面前领这句话；可以是那位老人，一屋子人的心意摆在面前，你偏不要；也可以不在场，事后听说这个生日没有办。若玩家是家里的晚辈之一，卡的重点变成“大人们的场面被老人一句话挡了回去”。\n\n**老人为什么不受**：嫌吵、身体不好、不想应酬、不想替小辈的攀附做场面、不愿看着一屋子人对着他各想各的心事、只想安安静静过完这一天。理由可以换，“不去那个场里”这句意思不能换——他被请的那个场子，本来就不是他要的。\n\n**那份旧稿子是什么**：一份抄本、一套校过的旧本子、一本记了很多年的账、一份家谱、一叠手写的方子或曲谱。要满足两点：是老人自己看重的；要把它抄出来、刻出来、传下去，得花一笔实实在在的钱和时间。\n\n**晚辈怎么办**：照办、拖着办、嘴上答应底下糊弄、照旧把席摆了人请了，都可以。也可以分两头：席照摆，稿子不动，只当老人说了句气话。这不是选择的结果，是选择本身——卡不代人选。\n\n**老人是什么人**：退了休的长辈、不管事的老太爷老太太、山里清修的长辈、家族里辈分最高但早已退出的人。\n\n**两个日子是什么**：生日、寿辰、成人礼、周年、祭日、退休日。要有一个“本来就该办”的日子。\n\n**这是哪**：任何有“长辈、寿辰、家族情面”的世界。现代可以换成“家里要办一场大宴，长辈只想要你们把他的手稿整理出来”。\n\n**注意**：卡停在“晚辈没有再说第二遍”这一刻。不要写席最后办没办、稿子最后刻没刻。若是办了、刻了，那份东西就是下一张卡的入口。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是当家的、老人的儿女、管事的家人。甲是那个“想办、又不敢违”的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，站在老人面前领这句话；可以是那位老人，一屋子人的心意摆在面前，你偏不要；也可以不在场，事后听说这个生日没有办。若玩家是家里的晚辈之一，卡的重点变成“大人们的场面被老人一句话挡了回去”。"
      },
      {
        "key": "老人为什么不受",
        "value": "嫌吵、身体不好、不想应酬、不想替小辈的攀附做场面、不愿看着一屋子人对着他各想各的心事、只想安安静静过完这一天。理由可以换，“不去那个场里”这句意思不能换——他被请的那个场子，本来就不是他要的。"
      },
      {
        "key": "那份旧稿子是什么",
        "value": "一份抄本、一套校过的旧本子、一本记了很多年的账、一份家谱、一叠手写的方子或曲谱。要满足两点：是老人自己看重的；要把它抄出来、刻出来、传下去，得花一笔实实在在的钱和时间。"
      },
      {
        "key": "晚辈怎么办",
        "value": "照办、拖着办、嘴上答应底下糊弄、照旧把席摆了人请了，都可以。也可以分两头：席照摆，稿子不动，只当老人说了句气话。这不是选择的结果，是选择本身——卡不代人选。"
      },
      {
        "key": "老人是什么人",
        "value": "退了休的长辈、不管事的老太爷老太太、山里清修的长辈、家族里辈分最高但早已退出的人。"
      },
      {
        "key": "两个日子是什么",
        "value": "生日、寿辰、成人礼、周年、祭日、退休日。要有一个“本来就该办”的日子。"
      },
      {
        "key": "这是哪",
        "value": "任何有“长辈、寿辰、家族情面”的世界。现代可以换成“家里要办一场大宴，长辈只想要你们把他的手稿整理出来”。"
      },
      {
        "key": "注意",
        "value": "卡停在“晚辈没有再说第二遍”这一刻。不要写席最后办没办、稿子最后刻没刻。若是办了、刻了，那份东西就是下一张卡的入口。"
      }
    ]
  },
  {
    "id": "C20-01-当着人骂",
    "number": "C20-01",
    "name": "当着人骂",
    "type": "旧人 / 当众",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-01-当着人骂.md",
    "face": "甲家里有一位老人。老人从前是抱过这家里孩子的，如今没什么事可做，也少有人来给她请安。\n\n这一天，老人拄着一根杖，一直走到孩子的屋里。屋里那个姑娘正病着，躺着，蒙着头。老人站在当地，一件一件数起来：忘了本；是你老人家一手把你举起来的；你如今只哄着他，哄得他连我也不认了；你不过是花几个钱买进来的，几时就轮到你在这屋里作起耗来——好不好的，打发出去，随便配个什么人，看你还哄人不哄人。她说了很久，声音大得前后院子都听得见。\n\n那姑娘起初还分辩，说病着，出了汗，蒙着头，原没看见你老人家。听到后来那些话，脸上红一阵，忍不住哭了。\n\n孩子赶回来，替她分辩了两句，说病着，吃着药。老人更气：你只护着这一起人，还认得我是谁？我奶了你这么大，如今天天看着这些人给我脸子。\n\n院子里的姑娘们也过来劝，说妈妈，你担待他们些。\n\n老人就把从前的事一件一件翻出来，说个没完。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是这个家里任何一个人——被骂的姑娘、赶回来的孩子、过来劝的姑娘、站在旁边听的下人。甲一定在这件旧事里欠着点什么，又做不了主。\n\n**玩家在哪**：玩家可以是屋里被骂的人，躺着，听人一件一件数你；可以是赶回来替她说话的人，说了两句就被顶回来；可以是站在门口没敢进去的人；也可以不在场，事后听说某位老人某天在院子里骂了半日。若玩家就是那位老人，卡的重点变成“这个家里还有谁记得我”。\n\n**这位老人是谁**：从前抱过孩子的人、带过孩子的乳母、上辈人的陪房、早年被重用的旧仆。她骂的那些话可能是真的，也可能一半是气话——卡不判。\n\n**她为什么这么大的火**：很久没人理她、手头紧了、今天刚输了钱、她骂的这个人本来是她一手举起来的。理由越具体，这张卡越重。“已经没有谁需要她了”这一层是根，不要省。\n\n**被骂的人是谁**：屋里当值的姑娘、后来进门的人、主事的少妇、买来的下人。她在这个家里没有正式的位子——所以老人挑她骂。\n\n**那个孩子为什么护不住**：他要是当场翻脸，得罪的是长辈；他要是认了，被骂的人就白挨。他只能分辩两句。\n\n**这是哪**：任何有“主家、旧人、年轻人屋里的人”的世界——老宅、病房、宿舍、作坊、公司。\n\n**注意**：卡停在“老人一件一件翻旧账，越说越响”这一刻。不要写这场骂怎么收的，也不要写被骂的人后来怎么办。一个早该被供起来、如今没人来请安的人，从这一刻起，在这个家里就成了个麻烦。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是这个家里任何一个人——被骂的姑娘、赶回来的孩子、过来劝的姑娘、站在旁边听的下人。甲一定在这件旧事里欠着点什么，又做不了主。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是屋里被骂的人，躺着，听人一件一件数你；可以是赶回来替她说话的人，说了两句就被顶回来；可以是站在门口没敢进去的人；也可以不在场，事后听说某位老人某天在院子里骂了半日。若玩家就是那位老人，卡的重点变成“这个家里还有谁记得我”。"
      },
      {
        "key": "这位老人是谁",
        "value": "从前抱过孩子的人、带过孩子的乳母、上辈人的陪房、早年被重用的旧仆。她骂的那些话可能是真的，也可能一半是气话——卡不判。"
      },
      {
        "key": "她为什么这么大的火",
        "value": "很久没人理她、手头紧了、今天刚输了钱、她骂的这个人本来是她一手举起来的。理由越具体，这张卡越重。“已经没有谁需要她了”这一层是根，不要省。"
      },
      {
        "key": "被骂的人是谁",
        "value": "屋里当值的姑娘、后来进门的人、主事的少妇、买来的下人。她在这个家里没有正式的位子——所以老人挑她骂。"
      },
      {
        "key": "那个孩子为什么护不住",
        "value": "他要是当场翻脸，得罪的是长辈；他要是认了，被骂的人就白挨。他只能分辩两句。"
      },
      {
        "key": "这是哪",
        "value": "任何有“主家、旧人、年轻人屋里的人”的世界——老宅、病房、宿舍、作坊、公司。"
      },
      {
        "key": "注意",
        "value": "卡停在“老人一件一件翻旧账，越说越响”这一刻。不要写这场骂怎么收的，也不要写被骂的人后来怎么办。一个早该被供起来、如今没人来请安的人，从这一刻起，在这个家里就成了个麻烦。"
      }
    ]
  },
  {
    "id": "C20-02-没人问她",
    "number": "C20-02",
    "name": "没人问她",
    "type": "圆场 / 不判",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-02-没人问她.md",
    "face": "前面院子里正吵得响。当家的那位在上房算账，一听就知道是那一位又发作了。\n\n她过来，没有问一句为什么。她拉起老人的手，笑着说：妈妈别生气。大节下，上头的老人家刚喜欢了一日。你是老人家，别人吵，你还要管他们才是，怎么倒自己嚷起来，叫人听着不成话。你说谁不好，我替你打他；我屋里烧着一壶热的，还有一碟菜，跟我喝酒去。\n\n说着就拉着走，又回头叫下人：替奶奶拿着杖，拿着手巾。\n\n老人脚跟不沾地，跟着走了。走的时候还在说：我也不要这条老命了。索性今天没了规矩，闹一场，讨个没脸，也强似受那些人的气。\n\n后头几个人看着，都拍手笑：亏得这一阵风来，把个老婆子撮了去了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是当家的那位、旁边看着的人、刚才被骂的人。若甲是当家的，这张卡的核心就是“要不要问这一句为什么”。\n\n**玩家在哪**：玩家可以是当家的那位，说软话把人带走，也可以直接问到底；可以是刚才被骂的人，眼看着救兵来了，却没有一句是替你说的；可以是过来劝的姑娘，站在旁边看了一遍怎么收场；也可以不在场，事后只听说“人被叫去喝酒了”。\n\n**为什么先问不得**：一问她为什么骂，这件事就得断个是非。断了是非，就得罪一头。当家的要的是这一刻别吵，不是对错。\n\n**老人要的是什么**：有人记得她。一顿热的、一句软话、拉着她走，比讲理有用。她骂的也许根本不是那个姑娘。\n\n**这一幕留下了什么**：院子里的人都看见了——闹一场不会挨罚，只会有人来请你去喝酒。往后谁心里有气，都知道该怎么用。\n\n**这是哪**：任何有“当家的、旧人、下不来台”的世界——家里、饭馆、工地、公司的走廊。\n\n**注意**：卡停在“人跟着走了，一边走一边还在骂”这一刻。不要写那顿酒吃了没有、老人消没消气。这件事没有结论，正是这张卡要留下的东西。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是当家的那位、旁边看着的人、刚才被骂的人。若甲是当家的，这张卡的核心就是“要不要问这一句为什么”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是当家的那位，说软话把人带走，也可以直接问到底；可以是刚才被骂的人，眼看着救兵来了，却没有一句是替你说的；可以是过来劝的姑娘，站在旁边看了一遍怎么收场；也可以不在场，事后只听说“人被叫去喝酒了”。"
      },
      {
        "key": "为什么先问不得",
        "value": "一问她为什么骂，这件事就得断个是非。断了是非，就得罪一头。当家的要的是这一刻别吵，不是对错。"
      },
      {
        "key": "老人要的是什么",
        "value": "有人记得她。一顿热的、一句软话、拉着她走，比讲理有用。她骂的也许根本不是那个姑娘。"
      },
      {
        "key": "这一幕留下了什么",
        "value": "院子里的人都看见了——闹一场不会挨罚，只会有人来请你去喝酒。往后谁心里有气，都知道该怎么用。"
      },
      {
        "key": "这是哪",
        "value": "任何有“当家的、旧人、下不来台”的世界——家里、饭馆、工地、公司的走廊。"
      },
      {
        "key": "注意",
        "value": "卡停在“人跟着走了，一边走一边还在骂”这一刻。不要写那顿酒吃了没有、老人消没消气。这件事没有结论，正是这张卡要留下的东西。"
      }
    ]
  },
  {
    "id": "C20-03-记在心里",
    "number": "C20-03",
    "name": "记在心里",
    "type": "吞声 / 按下",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-03-记在心里.md",
    "face": "屋里静下来之后，孩子又起了火。他说这笔账不知道是哪一处的，只拣软的欺负；又不知道是哪个姑娘得罪了她，倒算到我们头上。\n\n旁边一个嘴快的姑娘接了话：谁又没疯，去得罪她做什么。既得罪了，就有本事承任，犯不着带累别人。\n\n躺着的那个人一听，撑着起来拉住孩子，说：为了我得罪了老奶奶，你这会子又为我得罪这些人——这还不够我受的，你还只是拉扯人。\n\n孩子不敢再说什么。她烧得脸都红了，还是说下去：要为这些事生气，这屋里一天也住不住。可是天长日久，天天这么闹，叫人怎么过。你今天只顾一时替我出一口气，他们都记在心里，往后遇着坎儿，什么话说不出来。大家是什么意思。\n\n她说着又哭，怕孩子烦，忍住不哭了。\n\n药送上来，她出了一点汗。孩子要端给她，她不叫他端，说：你吃饭不吃饭，到底去上头坐一会子，和姑娘们玩一会子，我再静静躺一躺。等他走了，她才躺下。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是屋里这几个人的任何一个——要替她出头的孩子、躺着的那个人、说了那句“有本事认”的姑娘、送药进来的老婆子。甲得是“气了、又能忍”的那一个。\n\n**玩家在哪**：甲可以就是要替她出头的人，听她说完这段话；也可以是躺着的那个人，反过来把护着你的人按住；也可以不在场，事后听说那天屋里谁也没再提这件事。\n\n**躺在床上的人为什么按住他**：因为她没有位子。这件事一闹大，头一个被送走的会是她。她按住的不是孩子，是自己往后还能不能在这屋里过下去。\n\n**那句“有本事认”是谁说的**：屋里另一个比她能说、比她更不怕的人。她说得不无道理，也带着自己的气——这是同一个屋里同时存在的两股力。\n\n**这笔账记在谁那里**：不指定。可能是当天在场的下人，可能是后来传话的人，也可能是那个孩子自己。这张卡的作用不是当场出事，是“账记下了”。\n\n**为什么算中**：没有谁立刻失去什么，但在这屋里活下去的规矩，被她自己说出口了——不结仇，不拉扯，出头是要还的。\n\n**这是哪**：任何“住在一处、谁也搬不走”的地方——大宅、宿舍、合租的房子、编在一处的班组。\n\n**注意**：卡停在“她把孩子劝走，自己躺下”这一刻。不要写她病得怎么样，也不要写那笔账后来怎么算。她是这屋里最没有位子的人，可她刚刚替所有人算了最现实的一笔账。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是屋里这几个人的任何一个——要替她出头的孩子、躺着的那个人、说了那句“有本事认”的姑娘、送药进来的老婆子。甲得是“气了、又能忍”的那一个。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以就是要替她出头的人，听她说完这段话；也可以是躺着的那个人，反过来把护着你的人按住；也可以不在场，事后听说那天屋里谁也没再提这件事。"
      },
      {
        "key": "躺在床上的人为什么按住他",
        "value": "因为她没有位子。这件事一闹大，头一个被送走的会是她。她按住的不是孩子，是自己往后还能不能在这屋里过下去。"
      },
      {
        "key": "那句“有本事认”是谁说的",
        "value": "屋里另一个比她能说、比她更不怕的人。她说得不无道理，也带着自己的气——这是同一个屋里同时存在的两股力。"
      },
      {
        "key": "这笔账记在谁那里",
        "value": "不指定。可能是当天在场的下人，可能是后来传话的人，也可能是那个孩子自己。这张卡的作用不是当场出事，是“账记下了”。"
      },
      {
        "key": "为什么算中",
        "value": "没有谁立刻失去什么，但在这屋里活下去的规矩，被她自己说出口了——不结仇，不拉扯，出头是要还的。"
      },
      {
        "key": "这是哪",
        "value": "任何“住在一处、谁也搬不走”的地方——大宅、宿舍、合租的房子、编在一处的班组。"
      },
      {
        "key": "注意",
        "value": "卡停在“她把孩子劝走，自己躺下”这一刻。不要写她病得怎么样，也不要写那笔账后来怎么算。她是这屋里最没有位子的人，可她刚刚替所有人算了最现实的一笔账。"
      }
    ]
  },
  {
    "id": "C20-04-灯底下",
    "number": "C20-04",
    "name": "灯底下",
    "type": "屋里 / 暗劲",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-04-灯底下.md",
    "face": "天还早。屋里的人都出去找热闹了，只剩一个在外间灯下坐着，翻着一副牌，自己跟自己玩。\n\n回来的人问她怎么不去。她说：没有钱。\n\n那人说：底下堆着钱，还不够你输的？\n\n她说：都玩去了，这屋子交给谁。那一个又病着。上头是灯，下头是火，那些老婆子伏侍了一天，也该叫她们歇歇；小丫头们也伏侍了一天，这时候还不叫她们玩玩去？所以我在这里看着。\n\n那人听了，说：我在这里坐着，你放心去罢。\n\n她不肯去，说：你既在这里，越发不用去了。咱们两个说话不好？\n\n那人说：怪没意思的。早起你说头上痒，这会儿没什么事，我替你梳梳头。\n\n他就着灯，替她梳起来。梳了没几下，另一个人跑进来取钱，一看见他们两个，冷笑一声，说了一句很难听的话，抓起钱，摔了帘子就出去了。\n\n坐着的人对着镜子，从镜子里看着身后的人，两个人都笑了。那人低声说：满屋子就数她话多。镜子里的人忙向他摆手。\n\n帘子又是一声响。刚才那个人又跑进来，问：我怎么话多了？咱们倒得说说。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是屋里任何一个下人、躺着的病人、回来的主人。甲是“知道这屋里有几股劲”的那一个。\n\n**玩家在哪**：甲可以是被留下守屋的人；可以是替她梳头的人；可以是撞进来冷笑、摔帘子的人；也可以不在场，事后听人学着说笑。\n\n**守屋的人是谁**：这屋里最不显眼、最会替别人想的那一个。她没去玩，理由是“总得有人看着”。她不被感激，但她把屋子守住了。\n\n**摔帘子的人是谁**：嘴快、要强、把这屋里的亲近关系看得最重的那一个。她那句话难听，可她也不坏；她是看见自己被关在外头了。\n\n**这张卡在做什么**：不吵，不闹，没有一句是摆在桌面上的。它让这屋里几个人的关系第一次现出形状——谁站在谁身后，谁在镜子里看，谁在帘子外头。\n\n**为什么是轻的**：没有人失去什么。只是一屋几个人谁近谁远，第一次被人当场看见。\n\n**这是哪**：任何几个人同住一屋的地方——宿舍、值班室、后台、店里。灯、镜子、帘子都可以换。\n\n**注意**：卡停在“她又跑进来问那三个字”这一刻。不要写他们怎么答，也不要写这场拌嘴谁赢。这一夜的亲近和那一句冷笑，从这一刻起都留在这屋里了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是屋里任何一个下人、躺着的病人、回来的主人。甲是“知道这屋里有几股劲”的那一个。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是被留下守屋的人；可以是替她梳头的人；可以是撞进来冷笑、摔帘子的人；也可以不在场，事后听人学着说笑。"
      },
      {
        "key": "守屋的人是谁",
        "value": "这屋里最不显眼、最会替别人想的那一个。她没去玩，理由是“总得有人看着”。她不被感激，但她把屋子守住了。"
      },
      {
        "key": "摔帘子的人是谁",
        "value": "嘴快、要强、把这屋里的亲近关系看得最重的那一个。她那句话难听，可她也不坏；她是看见自己被关在外头了。"
      },
      {
        "key": "这张卡在做什么",
        "value": "不吵，不闹，没有一句是摆在桌面上的。它让这屋里几个人的关系第一次现出形状——谁站在谁身后，谁在镜子里看，谁在帘子外头。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人失去什么。只是一屋几个人谁近谁远，第一次被人当场看见。"
      },
      {
        "key": "这是哪",
        "value": "任何几个人同住一屋的地方——宿舍、值班室、后台、店里。灯、镜子、帘子都可以换。"
      },
      {
        "key": "注意",
        "value": "卡停在“她又跑进来问那三个字”这一刻。不要写他们怎么答，也不要写这场拌嘴谁赢。这一夜的亲近和那一句冷笑，从这一刻起都留在这屋里了。"
      }
    ]
  },
  {
    "id": "C20-05-没人向着他",
    "number": "C20-05",
    "name": "没人向着他",
    "type": "出身 / 输赢",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-05-没人向着他.md",
    "face": "新年里，学堂放了假，一家的几个孩子凑在一处掷骰子玩钱，一注几个钱。伺候的姑娘也在旁边看着。\n\n甲家的孩子头一回赢了，很高兴。后来接连输了几盘，就急了。这一盘轮到他掷：掷出七点赢，六点也赢，三点就输。他把骰子狠狠一掷，一个定住了是二，另一个还在转。旁边的姑娘拍着手喊“一点”；他自己瞪着眼喊“六”“七”“八”。骰子偏偏转出一点来。\n\n他急了，伸手把骰子抓起来，说是个四点，就要拿钱。\n\n姑娘说：明明是一点。\n\n带他们的那位姑娘看他要急哭了，就瞪了自家的人一眼，说：越大越没规矩！难道他会赖你这几个钱？还不放下钱来呢。\n\n伺候的姑娘满心委屈，不敢出声，把钱放下，嘴里嘟囔：他一个主子，还赖我们这几个钱，连我也瞧不起。前儿跟那一位玩，他输了那么多也没着急，剩下的钱还是几个小丫头抢了去，他一笑就罢了。\n\n话没说完，就被喝住了。甲家的孩子说：我拿什么跟他比？你们都怕他，都跟他好，都欺负我出身不如他。\n\n说着就哭。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是这个家里的孩子、伺候的下人、带人的那位姑娘。甲必须沾着“这一家里谁高谁低”这件事。\n\n**玩家在哪**：甲可以是那个输了钱的孩子；可以是那个被按住不许出声的下人；可以是带人的那位姑娘，当场决定向着谁；也可以不在场，事后听人学这件事。若甲是那个孩子，卡的重点就是“你终于把最不该说的那句话说了出来”。\n\n**那个孩子在赌什么**：几个钱。可他真正在赌的是“这个家里有没有一条规矩是向着我的”。\n\n**赖账是真的吗**：是真的。卡不洗白他。这张卡的分量不在他有没有错，在他错了之后看见了什么。\n\n**带人的姑娘为什么按住自己人**：因为这是她家、她的人、她要维持的体面。她做得对，也很难看：一个下人当着主子的面，把实话说了出来。\n\n**那句关于出身的话是什么**：正出 / 偏出、亲生的 / 带来的、本家的 / 外来的、老员工的孩子 / 东家的孩子。这句话这个家里从来没人明说过，也从来没人不知道。孩子一说出口，就再也收不回去了。\n\n**这是哪**：任何有“两等孩子”的家庭或组织——老宅、宗族、家族企业、寄宿学校。\n\n**注意**：卡停在“孩子哭了”这一刻。不要写有没有人安慰他、有没有人罚那个下人。一个孩子在自家院子里第一次明白“这一局本来就不是给我赢的”，比输几个钱重得多。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是这个家里的孩子、伺候的下人、带人的那位姑娘。甲必须沾着“这一家里谁高谁低”这件事。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是那个输了钱的孩子；可以是那个被按住不许出声的下人；可以是带人的那位姑娘，当场决定向着谁；也可以不在场，事后听人学这件事。若甲是那个孩子，卡的重点就是“你终于把最不该说的那句话说了出来”。"
      },
      {
        "key": "那个孩子在赌什么",
        "value": "几个钱。可他真正在赌的是“这个家里有没有一条规矩是向着我的”。"
      },
      {
        "key": "赖账是真的吗",
        "value": "是真的。卡不洗白他。这张卡的分量不在他有没有错，在他错了之后看见了什么。"
      },
      {
        "key": "带人的姑娘为什么按住自己人",
        "value": "因为这是她家、她的人、她要维持的体面。她做得对，也很难看：一个下人当着主子的面，把实话说了出来。"
      },
      {
        "key": "那句关于出身的话是什么",
        "value": "正出 / 偏出、亲生的 / 带来的、本家的 / 外来的、老员工的孩子 / 东家的孩子。这句话这个家里从来没人明说过，也从来没人不知道。孩子一说出口，就再也收不回去了。"
      },
      {
        "key": "这是哪",
        "value": "任何有“两等孩子”的家庭或组织——老宅、宗族、家族企业、寄宿学校。"
      },
      {
        "key": "注意",
        "value": "卡停在“孩子哭了”这一刻。不要写有没有人安慰他、有没有人罚那个下人。一个孩子在自家院子里第一次明白“这一局本来就不是给我赢的”，比输几个钱重得多。"
      }
    ]
  },
  {
    "id": "C20-06-到别处玩去",
    "number": "C20-06",
    "name": "到别处玩去",
    "type": "不管 / 打发",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-06-到别处玩去.md",
    "face": "正闹着，另一位进来了。屋里那个哭着的孩子立刻不敢出声。\n\n进来的人在自己家里是不要人怕他的。他看见这个情形，问了一句：这是怎么了？\n\n没有人答。带人的那位姑娘忙着替哭着的孩子遮掩。\n\n进来的人没有再问。他对着那个孩子说：大正月里，哭什么？这里不好，到别处玩去。你天天念书，倒念糊涂了——一件东西不好，横竖另有一件好，舍了这件取那件就是了，难道守着这件哭一会子，它就变好了？你原是要找乐子，倒招自己的烦恼。还不快去。\n\n孩子听了，只得走了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是进来的那位、哭着的孩子、带人的姑娘、屋里任何一个下人。甲是“能管、又不想管”的那一个。\n\n**玩家在哪**：甲可以是进来的人，站在门口，决定问不问到底；可以是那个孩子，被一句话打发出去；可以是带人的姑娘，替人把事遮过去；也可以不在场，事后听说那天谁也没挨罚。\n\n**他为什么不管**：他上头有父母，下头有别的兄弟，管了反倒生分；他自己在这家里也不是“该管教人”的那个。他的不管，有他的道理，也有他的懒。\n\n**那句“到别处玩去”是什么**：这是这张卡要留下的东西。它没有说谁对谁错，也没有罚谁、护谁。被这句话打发走的孩子，得到的是一件事：在这屋里哭，是没有用的。\n\n**也可以问到底**：若甲当场问了，就得断是非；断了是非，就得罪一边。这不是错，是另一种代价。卡不替人挑。\n\n**为什么是轻的**：没有人吵起来，也没有人被罚。只是有一个孩子，从这一刻起不再指望这里有人替他说一句话。\n\n**这是哪**：任何有“该管又不想管的长辈 / 兄长 / 老员工 / 上司”的场合。\n\n**注意**：卡停在“孩子听了，只得走了”这一刻。不要写他后来去哪、找谁玩。一张卡的分量常常不在有人发火，而在有人不肯发火。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是进来的那位、哭着的孩子、带人的姑娘、屋里任何一个下人。甲是“能管、又不想管”的那一个。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是进来的人，站在门口，决定问不问到底；可以是那个孩子，被一句话打发出去；可以是带人的姑娘，替人把事遮过去；也可以不在场，事后听说那天谁也没挨罚。"
      },
      {
        "key": "他为什么不管",
        "value": "他上头有父母，下头有别的兄弟，管了反倒生分；他自己在这家里也不是“该管教人”的那个。他的不管，有他的道理，也有他的懒。"
      },
      {
        "key": "那句“到别处玩去”是什么",
        "value": "这是这张卡要留下的东西。它没有说谁对谁错，也没有罚谁、护谁。被这句话打发走的孩子，得到的是一件事：在这屋里哭，是没有用的。"
      },
      {
        "key": "也可以问到底",
        "value": "若甲当场问了，就得断是非；断了是非，就得罪一边。这不是错，是另一种代价。卡不替人挑。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人吵起来，也没有人被罚。只是有一个孩子，从这一刻起不再指望这里有人替他说一句话。"
      },
      {
        "key": "这是哪",
        "value": "任何有“该管又不想管的长辈 / 兄长 / 老员工 / 上司”的场合。"
      },
      {
        "key": "注意",
        "value": "卡停在“孩子听了，只得走了”这一刻。不要写他后来去哪、找谁玩。一张卡的分量常常不在有人发火，而在有人不肯发火。"
      }
    ]
  },
  {
    "id": "C20-07-窗外的人",
    "number": "C20-07",
    "name": "窗外的人",
    "type": "名分 / 当众",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-07-窗外的人.md",
    "face": "那个哭着回去的孩子，进了自己母亲的屋子。母亲问他：又是从哪里讨了没意思回来？\n\n孩子把刚才的事说了一遍：跟带人的姑娘玩来着，伺候的人欺负我，赖我的钱，后来被人撵了回来。\n\n母亲听完，啐了他一口：谁叫你往高台上凑？下流没脸的东西！哪里玩不得，谁叫你跑去讨这个没意思？\n\n正说着，窗外有人经过，全听见了。\n\n窗外的人隔着窗户开口：大正月里，这是怎么了？兄弟们小孩子家，一半点儿错，你只教导他就是了，说这样的话做什么？凭他怎么着，还有上头的人管他。你就大口啐他？他再不济，也是这个家里的人，不好，横竖有教导他的人——与你什么相干？\n\n她又叫：孩子，出来，跟我玩去。\n\n孩子素日怕她更甚，听见叫，赶忙出来。母亲一声不敢出。\n\n她又对孩子说：你也是个没性气的。常跟你说，要吃要喝要玩，爱跟哪个姐姐妹妹哥哥嫂子玩就玩，你偏不听，倒叫这些人教得你歪心邪意。自己又不尊重，要往下流里走，安着坏心，还只怨人家偏心。输了几个钱，就这么个样儿。\n\n她问：输了多少钱？孩子说：输了一二百。她说：亏你还是这家的孩子，输了一二百就这样。回头叫人取一串钱来，把他送到后头姑娘们那里去。又说：你明儿再这么着，我先打了你，再叫人告诉学里，看我不揭了你的皮。\n\n孩子诺诺地跟着人拿了钱，走了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是那个母亲、那个孩子、窗外的人、屋里任何一个下人。甲是这张卡的秤：谁占甲，谁就得当场面对“这件事到底谁有资格管”。\n\n**玩家在哪**：甲可以是那位母亲，隔着窗子接不接这句话；可以是那个孩子，站在母亲和窗外的人中间；可以是窗外的人，说完就走；也可以不在场，事后听说这一家子某天在院子里闹了一场。若甲是那个孩子，卡的重点变成“两个人都在管你，可没有一个人问你”。\n\n**这位母亲是什么位子**：她是孩子的生母，可这个家里的规矩不认她这一层。她管教孩子，被看成撒气；她在外头受了屈，回来只能啐孩子。她骂得难听，她也是没办法。\n\n**窗外的人为什么管**：这是她当家；孩子在院子里哭，是她面上的事。那句“与你什么相干”说的是规矩，不是恶意——可这句话把一个母亲从自己儿子身上摘了出去。\n\n**那串钱是什么**：钱不是赔给孩子的，是把这个孩子从母亲那里接过去的。给孩子钱、教他去别处玩、再拿一句话压住娘——事情就算完了。\n\n**这是哪**：任何“生母没有名分、当家的另有人在”的家庭或团体。现代可以换成“这孩子归我们管，不归你管”。\n\n**注意**：卡停在“孩子跟着人拿了钱走了”这一刻。不要写母亲后来怎么样，也不要写孩子长大以后。一个孩子第一次看见：在这个家里，护不住他的人，正是被允许管他的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是那个母亲、那个孩子、窗外的人、屋里任何一个下人。甲是这张卡的秤：谁占甲，谁就得当场面对“这件事到底谁有资格管”。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是那位母亲，隔着窗子接不接这句话；可以是那个孩子，站在母亲和窗外的人中间；可以是窗外的人，说完就走；也可以不在场，事后听说这一家子某天在院子里闹了一场。若甲是那个孩子，卡的重点变成“两个人都在管你，可没有一个人问你”。"
      },
      {
        "key": "这位母亲是什么位子",
        "value": "她是孩子的生母，可这个家里的规矩不认她这一层。她管教孩子，被看成撒气；她在外头受了屈，回来只能啐孩子。她骂得难听，她也是没办法。"
      },
      {
        "key": "窗外的人为什么管",
        "value": "这是她当家；孩子在院子里哭，是她面上的事。那句“与你什么相干”说的是规矩，不是恶意——可这句话把一个母亲从自己儿子身上摘了出去。"
      },
      {
        "key": "那串钱是什么",
        "value": "钱不是赔给孩子的，是把这个孩子从母亲那里接过去的。给孩子钱、教他去别处玩、再拿一句话压住娘——事情就算完了。"
      },
      {
        "key": "这是哪",
        "value": "任何“生母没有名分、当家的另有人在”的家庭或团体。现代可以换成“这孩子归我们管，不归你管”。"
      },
      {
        "key": "注意",
        "value": "卡停在“孩子跟着人拿了钱走了”这一刻。不要写母亲后来怎么样，也不要写孩子长大以后。一个孩子第一次看见：在这个家里，护不住他的人，正是被允许管他的人。"
      }
    ]
  },
  {
    "id": "C20-08-从谁那里来",
    "number": "C20-08",
    "name": "从谁那里来",
    "type": "口角 / 试探",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-08-从谁那里来.md",
    "face": "一屋子人正说笑，外面报说：有一位客人来了。\n\n在场的那个人一听，站起来就走。旁边有人说：等等，我跟你一块儿去。\n\n两人到了上房。客人正大说大笑，见了他们，忙站起来问好。\n\n屋里还坐着一个人。她问回来的那个人：你打哪里来？\n\n那人说：打那边屋里来。\n\n她冷笑一声：我说呢。亏了有人绊住，不然早就飞来了。\n\n那人说：只许跟你玩、替你解闷儿？不过偶然去一趟，就说这些闲话。\n\n她说：好没意思的话。去不去，管我什么事。又没叫你来替我解闷。往后你只管不理我。\n\n说完，她赌气回房去了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是问了那句话的人、被问的人、刚到的客人、屋里别的人。甲是“把一句话听成一句话之外的意思”的那一个。\n\n**玩家在哪**：甲可以是问话的人，站在门口问那一句；可以是答话的人，说了实话；可以是刚到的客人，一进门就看见屋里的脸色；也可以不在场，事后听说那天谁赌气先走了。\n\n**这句话为什么问不出口又非要问**：她要问的不是“你从哪来”，是“你从谁那里来”。答的是实话，正因是实话才刺人。\n\n**答话的人错在哪**：他没错。他答了实话，还觉得对方无理。这张卡里没有谁有错，只有两个人用两套算法算同一件事。\n\n**旁边有没有人**：当着人说和两个人私下说，是两件事。当着人问，这句话就落到了一屋子人眼里。\n\n**为什么是轻的**：没有人失去什么。只是两个人之间“可以不问”的那点余地，从这一句话起没有了。\n\n**这是哪**：任何“一群人里有一对走得近”的场合——同学、同事、一家亲戚、合住一个院子的人。\n\n**注意**：卡停在“她赌气回房”这一刻。不要写有没有人追上去，也不要写这场口角算了没有。话没出口的时候最轻，出了口就收不回来。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是问了那句话的人、被问的人、刚到的客人、屋里别的人。甲是“把一句话听成一句话之外的意思”的那一个。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是问话的人，站在门口问那一句；可以是答话的人，说了实话；可以是刚到的客人，一进门就看见屋里的脸色；也可以不在场，事后听说那天谁赌气先走了。"
      },
      {
        "key": "这句话为什么问不出口又非要问",
        "value": "她要问的不是“你从哪来”，是“你从谁那里来”。答的是实话，正因是实话才刺人。"
      },
      {
        "key": "答话的人错在哪",
        "value": "他没错。他答了实话，还觉得对方无理。这张卡里没有谁有错，只有两个人用两套算法算同一件事。"
      },
      {
        "key": "旁边有没有人",
        "value": "当着人说和两个人私下说，是两件事。当着人问，这句话就落到了一屋子人眼里。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人失去什么。只是两个人之间“可以不问”的那点余地，从这一句话起没有了。"
      },
      {
        "key": "这是哪",
        "value": "任何“一群人里有一对走得近”的场合——同学、同事、一家亲戚、合住一个院子的人。"
      },
      {
        "key": "注意",
        "value": "卡停在“她赌气回房”这一刻。不要写有没有人追上去，也不要写这场口角算了没有。话没出口的时候最轻，出了口就收不回来。"
      }
    ]
  },
  {
    "id": "C20-09-先来的",
    "number": "C20-09",
    "name": "先来的",
    "type": "排先后 / 摊开",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-09-先来的.md",
    "face": "那人跟了过去。屋里那个人正在气头上，问他：你又来做什么？死活凭我去就完了。横竖如今有人跟你玩，比我又会念、又会作、又会说笑，又怕你生气，拉了你去哄着你。你又来做什么。\n\n他说：好好儿的又生气了。就是我说错了，你到底也还坐坐儿，和别人说笑一会子。\n\n她说：你管我呢。\n\n他说：我自然不敢管你。只是你自己糟蹋坏了身子。\n\n她说：我作践我的身子，我死我的，与你何干。\n\n他说：何苦来。大正月里，死了活了的。\n\n她说：偏说死。我这会子就死。你怕死，你长命百岁地活着，好不好。\n\n正说着，另一个人进来了，说：外面那位客人等你呢。说着，把那人拉走了。\n\n屋里剩下她一个人，对着窗子流泪。\n\n过了没多久，那人又回来了。她抽抽搭搭哭个不住。他也不劝了，只凑近了些，低声把话说开：论亲，咱们两家的情分比她那边近一层；论先后，你来得早。咱们是一张桌上吃饭、一处长大的，她是后来的。没有为了她反倒远你的道理。\n\n她说：我难道叫你远她？那我成了什么人。我为的是我的心。\n\n他说：我也为的是我的心。你就知道你的心，不知道我的心不成？\n\n她低下头，半天不说话。\n\n过了会儿，她说：你只怨人家动不动就嗔怪你，你从来不知道你怄得人难受。就拿今天比，天分明冷了些，你怎么倒把外头的衣裳脱了？\n\n他说：怎么没穿。见你一恼，我一急，就脱了。\n\n她说：回头伤了风，又该闹着要这要那了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是赌气的那个人、追过去的那个人、把人拉走的第三个人、路过的下人。甲是“把话说到心口上、又收不回来”的那一个。\n\n**玩家在哪**：甲可以是赌气的人，接不接他这套道理；可以是追过去的人，决定把“谁先来、谁更近”说出口；可以是进来把人叫走的第三个，你只说了半句“有人等你”；也可以不在场，事后听说那天两个人在屋里说了半天话，出来时都不提了。\n\n**那段“谁先来、谁更近”的话是什么**：这是这张卡的刀口。它把一个一直没人摆到桌面上的次序，第一次说出来了。说之前，两个人还可以装糊涂；说之后，谁在这个人心里排第一，就成了定下来的一件事。\n\n**他一说出口，伤的是谁**：那个不在场的第三个人。这句话不可能只有两个人听见——它会长脚。\n\n**她为什么忽然问起衣裳**：气还没消，人已经软了。这就是这张卡的余味：一句最重的话说完，落下来的是一句最轻的关心。\n\n**为什么算重**：这不是吵一架。是一个人当着另一个人的面，把三个人之间的关系排了座次；这张卡一过，三个人都不可能再当作没听过。\n\n**这是哪**：任何“三个人里有两个走得近”的地方。衣裳可以换成别的——一杯水、一把伞、一句路上小心。\n\n**注意**：卡停在“她说，回头伤了风又该闹了”这一刻。不要写他们和好没有，也不要写这话后来有没有传出去。次序一说出口，这段三人关系就回不去了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是赌气的那个人、追过去的那个人、把人拉走的第三个人、路过的下人。甲是“把话说到心口上、又收不回来”的那一个。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是赌气的人，接不接他这套道理；可以是追过去的人，决定把“谁先来、谁更近”说出口；可以是进来把人叫走的第三个，你只说了半句“有人等你”；也可以不在场，事后听说那天两个人在屋里说了半天话，出来时都不提了。"
      },
      {
        "key": "那段“谁先来、谁更近”的话是什么",
        "value": "这是这张卡的刀口。它把一个一直没人摆到桌面上的次序，第一次说出来了。说之前，两个人还可以装糊涂；说之后，谁在这个人心里排第一，就成了定下来的一件事。"
      },
      {
        "key": "他一说出口，伤的是谁",
        "value": "那个不在场的第三个人。这句话不可能只有两个人听见——它会长脚。"
      },
      {
        "key": "她为什么忽然问起衣裳",
        "value": "气还没消，人已经软了。这就是这张卡的余味：一句最重的话说完，落下来的是一句最轻的关心。"
      },
      {
        "key": "为什么算重",
        "value": "这不是吵一架。是一个人当着另一个人的面，把三个人之间的关系排了座次；这张卡一过，三个人都不可能再当作没听过。"
      },
      {
        "key": "这是哪",
        "value": "任何“三个人里有两个走得近”的地方。衣裳可以换成别的——一杯水、一把伞、一句路上小心。"
      },
      {
        "key": "注意",
        "value": "卡停在“她说，回头伤了风又该闹了”这一刻。不要写他们和好没有，也不要写这话后来有没有传出去。次序一说出口，这段三人关系就回不去了。"
      }
    ]
  },
  {
    "id": "C20-10-指出一个人来",
    "number": "C20-10",
    "name": "指出一个人来",
    "type": "派系 / 玩笑",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第二十回",
    "rel": "红楼梦/现实类/第二十回/C20-10-指出一个人来.md",
    "face": "那位客人进来了，笑着抱怨：你们天天在一处玩，我好容易来一趟，也不理我。\n\n坐着的那个人笑她：偏是咬舌子爱说话，连个“二”字都叫不上来，只会“爱”啊“爱”的。回头再掷骰子，又该听你喊“一爱三”了。\n\n客人说：她再不放人一点，专会挑人。就算你比世人好，也用不着见一个打趣一个。我指出个人来，你敢挑他的短处，我就服你。\n\n那人问：是谁？\n\n客人说：你敢挑那位姐姐的短处，就算你是个好的。\n\n那人听了，冷笑一声：我当是谁，原来是他。我可哪里敢挑他呢。\n\n旁边的人不等她说完，忙用别的话岔开。\n\n客人又笑：这一辈子我自然比不上你。我只盼着明儿你得一个咬舌儿的姐夫，时时刻刻你可听“爱呀”的。到那时才现到我眼里呢。\n\n说完，一屋子人都笑，客人转身就跑了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是刚来的这位客人、被学说话的那个人、屋里别的人。甲不必是主角，甲只要在这屋里坐着。\n\n**玩家在哪**：甲可以是那个被当众学说话的人，回不回嘴；可以是点人的那个，一句玩笑把屋里的站队摆到桌面上；可以是不相干的那一个，坐在旁边，看这屋里的远近自己排出来。\n\n**那句“我指出个人来”是什么意思**：这是这张卡要留下的东西。她没有别的意思，只是想说“你别光挑我”。可这个名字一说出来，一屋子人就都知道：谁跟谁是一拨的。\n\n**被指的那个人在场吗**：在场也未必接话；不在场更好——名字被人当着一屋子人说了出来。\n\n**玩笑为什么收得住**：因为它最后落在了“将来嫁人”这类安全的话上。一屋子人都能笑，只有一个名字被留在了原处。\n\n**为什么是轻的**：没有人被伤着，也没有人翻脸。只是这一屋人谁是近的、谁是远的，从此不用再说了，大家都知道。\n\n**这是哪**：任何“一群人里固定有几个远近亲疏”的地方——闺蜜圈、同事群、一家人过年。\n\n**注意**：卡停在“客人笑着跑了”这一刻。不要写被点的那个人后来听没听说，也不要写这屋里以后怎么排。玩笑是这张卡最好的刀鞘。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是刚来的这位客人、被学说话的那个人、屋里别的人。甲不必是主角，甲只要在这屋里坐着。"
      },
      {
        "key": "玩家在哪",
        "value": "甲可以是那个被当众学说话的人，回不回嘴；可以是点人的那个，一句玩笑把屋里的站队摆到桌面上；可以是不相干的那一个，坐在旁边，看这屋里的远近自己排出来。"
      },
      {
        "key": "那句“我指出个人来”是什么意思",
        "value": "这是这张卡要留下的东西。她没有别的意思，只是想说“你别光挑我”。可这个名字一说出来，一屋子人就都知道：谁跟谁是一拨的。"
      },
      {
        "key": "被指的那个人在场吗",
        "value": "在场也未必接话；不在场更好——名字被人当着一屋子人说了出来。"
      },
      {
        "key": "玩笑为什么收得住",
        "value": "因为它最后落在了“将来嫁人”这类安全的话上。一屋子人都能笑，只有一个名字被留在了原处。"
      },
      {
        "key": "为什么是轻的",
        "value": "没有人被伤着，也没有人翻脸。只是这一屋人谁是近的、谁是远的，从此不用再说了，大家都知道。"
      },
      {
        "key": "这是哪",
        "value": "任何“一群人里固定有几个远近亲疏”的地方——闺蜜圈、同事群、一家人过年。"
      },
      {
        "key": "注意",
        "value": "卡停在“客人笑着跑了”这一刻。不要写被点的那个人后来听没听说，也不要写这屋里以后怎么排。玩笑是这张卡最好的刀鞘。"
      }
    ]
  },
  {
    "id": "C11-01-不赏脸",
    "number": "C11-01",
    "name": "不赏脸",
    "type": "待客 / 圆场",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十一回",
    "rel": "红楼梦/现实类/第十一回/C11-01-不赏脸.md",
    "face": "家里办一场席，日子是早定下的。该到的人都到了，只差一位：族里辈分最高的那位老人。差人去请，回话说身上不好，今日不来了。\n\n席上照样热闹。主人陪着客人说话，忽然当着满屋子的人叹了一句：这样的日子也不来，真是不赏脸。\n\n满屋子都听见了。这话得有人接——不能认，也不能顶；还得替没来的人说一个缘故，说得满桌子人都点头。\n\n甲就是那个替老人回话的人。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个替长辈说话的人——晚辈里最会说话的、管着长辈屋里事的、专门被差去请的。甲不一定忠心，但甲说出口的话，外头人会当成那位长辈的意思。\n\n**玩家在哪**：玩家可以是甲，当众接住这句话；可以是主人，这句抱怨是真的，也可以是故意说给客人听；可以是席上某个客人，听完了心里各有各的算盘；也可以不在场，事后听说这家的老人那天没来。\n\n**老人为什么没来**：身上不好、不肯见人、跟主人家赌着气、在别处清静惯了、只是嫌这一场没意思。理由越具体，甲要圆的那个场就越大。\n\n**这一场席是什么日子**：生日、寿辰、节下、添丁、升迁、周年。要有一个“早就定下、人人都该到”的日子，那位老人的缺席才算一件事。\n\n**那句“不赏脸”是什么意思**：一半是抱怨，一半是试探——主人要当着众人知道，这件事在这个家里算不算一件事，也想知道谁肯替老人兜着。\n\n**为什么非得当场接**：不接，席就冷在这儿，一场喜事落成一句埋怨；接了，就得当场给那位长辈立一个说法。\n\n**这个缘故怎么编**：说病，满屋人得跟着担心，这话还会传出去；说嘴馋、怕吵、嫌闹，就把长辈说成一个任性的老人；说实话，就是当众承认这一家请不动他。哪一种都行，哪一种都要付代价。\n\n**老人认不认**：老人可以认下这个说法，也可以日后翻出来算账——卡不裁定。\n\n**这是哪**：任何有“席上有长辈缺席”的世界——祠堂、寿宴、家宴、年会、董事会的坐席。\n\n**注意**：卡停在“满桌子人等着甲开口”这一刻。不要写甲说了什么，也不要写那位老人事后认不认。从这一刻起，这个家对外说起这位老人，用的就是甲给的那个说法。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个替长辈说话的人——晚辈里最会说话的、管着长辈屋里事的、专门被差去请的。甲不一定忠心，但甲说出口的话，外头人会当成那位长辈的意思。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当众接住这句话；可以是主人，这句抱怨是真的，也可以是故意说给客人听；可以是席上某个客人，听完了心里各有各的算盘；也可以不在场，事后听说这家的老人那天没来。"
      },
      {
        "key": "老人为什么没来",
        "value": "身上不好、不肯见人、跟主人家赌着气、在别处清静惯了、只是嫌这一场没意思。理由越具体，甲要圆的那个场就越大。"
      },
      {
        "key": "这一场席是什么日子",
        "value": "生日、寿辰、节下、添丁、升迁、周年。要有一个“早就定下、人人都该到”的日子，那位老人的缺席才算一件事。"
      },
      {
        "key": "那句“不赏脸”是什么意思",
        "value": "一半是抱怨，一半是试探——主人要当着众人知道，这件事在这个家里算不算一件事，也想知道谁肯替老人兜着。"
      },
      {
        "key": "为什么非得当场接",
        "value": "不接，席就冷在这儿，一场喜事落成一句埋怨；接了，就得当场给那位长辈立一个说法。"
      },
      {
        "key": "这个缘故怎么编",
        "value": "说病，满屋人得跟着担心，这话还会传出去；说嘴馋、怕吵、嫌闹，就把长辈说成一个任性的老人；说实话，就是当众承认这一家请不动他。哪一种都行，哪一种都要付代价。"
      },
      {
        "key": "老人认不认",
        "value": "老人可以认下这个说法，也可以日后翻出来算账——卡不裁定。"
      },
      {
        "key": "这是哪",
        "value": "任何有“席上有长辈缺席”的世界——祠堂、寿宴、家宴、年会、董事会的坐席。"
      },
      {
        "key": "注意",
        "value": "卡停在“满桌子人等着甲开口”这一刻。不要写甲说了什么，也不要写那位老人事后认不认。从这一刻起，这个家对外说起这位老人，用的就是甲给的那个说法。"
      }
    ]
  },
  {
    "id": "C11-02-熬不过年",
    "number": "C11-02",
    "name": "熬不过年",
    "type": "探病 / 实话",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十一回",
    "rel": "红楼梦/现实类/第十一回/C11-02-熬不过年.md",
    "face": "里屋比外头暗。病人靠在褥子上，脸瘦得只剩一层皮。见人进来，她要撑着起来，被按住了。\n\n她拉着来人的手，先说自己有福气：公婆待她像亲女儿，两口子从来没红过脸，一家子上下没有不疼她的。说了半晌，才说：如今得了这个病，我那一分要强的心，也没有了。\n\n又说：我自己想着，未必熬得过这个年。\n\n屋里静了一静。\n\n来人刚要开口，她先笑了：神仙来了也没用。病能治，命治不了。我知道我这病，不过是挨日子。\n\n临走，她拉着来人不放，说：有工夫的时候，还求你过来看看我，咱们坐着说说话。\n\n她等着这一句答话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是来看她的人——亲戚、妯娌、旧日的相好、被家里派来探病的。甲就是那个被交代过“你去开导开导她”的人。\n\n**玩家在哪**：玩家可以是甲，坐在褥子边，被这几句话压住；可以是病人，这些话说到哪一步、说给谁听，由你定；可以是跟着进来的人，坐在对面椅子上；也可以不在场，事后听人转述“那天她说了句很不祥的话”。\n\n**开导的人为什么开不了口**：家里派甲来，是要甲说宽心话的。宽心话还没出口，病人先把底交了——她把话说到头，就等于把甲的话堵死了。甲要么驳回她，要么认下。\n\n**病人为什么把话说到底**：能做的都做了——钱花了、大夫请了、长辈疼她。她只剩这一件事是自己能做的：把话说给一个肯听的人。她要的不是宽心，是有人来。\n\n**那句“病能治，命治不了”是什么**：不是绝望，是算过账。能治的家里都肯治，剩下那一份不归人管。\n\n**甲能怎么办**：驳回她（她得再解释一遍，等于替甲宽心）；哭（她反过来安慰甲）；岔开（她就把话收回去，从此不再提）；只坐着握住她的手（那也算答了）。每一种都有代价。\n\n**她是谁**：年纪不大、进门没几年、里外都说好的那个媳妇、女儿、儿媳。越是要强的人，说出这句话越重。\n\n**这是哪**：病房、内室、榻前、休养的地方，任何有人躺着而屋里人都装着没事的地方。\n\n**注意**：卡停在“她求甲常来，等一句答话”这一刻。不要写甲答了什么，也不要写她熬不熬得过这个年。她这一句已经交到甲手里了——甲带着它出门，就得决定把它交给谁。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是来看她的人——亲戚、妯娌、旧日的相好、被家里派来探病的。甲就是那个被交代过“你去开导开导她”的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，坐在褥子边，被这几句话压住；可以是病人，这些话说到哪一步、说给谁听，由你定；可以是跟着进来的人，坐在对面椅子上；也可以不在场，事后听人转述“那天她说了句很不祥的话”。"
      },
      {
        "key": "开导的人为什么开不了口",
        "value": "家里派甲来，是要甲说宽心话的。宽心话还没出口，病人先把底交了——她把话说到头，就等于把甲的话堵死了。甲要么驳回她，要么认下。"
      },
      {
        "key": "病人为什么把话说到底",
        "value": "能做的都做了——钱花了、大夫请了、长辈疼她。她只剩这一件事是自己能做的：把话说给一个肯听的人。她要的不是宽心，是有人来。"
      },
      {
        "key": "那句“病能治，命治不了”是什么",
        "value": "不是绝望，是算过账。能治的家里都肯治，剩下那一份不归人管。"
      },
      {
        "key": "甲能怎么办",
        "value": "驳回她（她得再解释一遍，等于替甲宽心）；哭（她反过来安慰甲）；岔开（她就把话收回去，从此不再提）；只坐着握住她的手（那也算答了）。每一种都有代价。"
      },
      {
        "key": "她是谁",
        "value": "年纪不大、进门没几年、里外都说好的那个媳妇、女儿、儿媳。越是要强的人，说出这句话越重。"
      },
      {
        "key": "这是哪",
        "value": "病房、内室、榻前、休养的地方，任何有人躺着而屋里人都装着没事的地方。"
      },
      {
        "key": "注意",
        "value": "卡停在“她求甲常来，等一句答话”这一刻。不要写甲答了什么，也不要写她熬不熬得过这个年。她这一句已经交到甲手里了——甲带着它出门，就得决定把它交给谁。"
      }
    ]
  },
  {
    "id": "C11-03-别在这里",
    "number": "C11-03",
    "name": "别在这里",
    "type": "失态 / 支开",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十一回",
    "rel": "红楼梦/现实类/第十一回/C11-03-别在这里.md",
    "face": "跟着进来的是个半大的孩子。他原不该进这间屋子，是自己缠着要来的，跟在大人们后头，在对面的椅子上坐了。\n\n病人说话，他起初还坐得住。听到“未必熬得过这个年”，眼圈先红了，跟着眼泪就掉下来，止也止不住。\n\n屋里静了。病人看着他，脸上那点笑挂不住了。\n\n孩子自己也知道不该哭，低下头去擦，越擦越多。一屋子大人，谁也没有先开口。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果按玩家世界里的规矩，这个年纪的人根本不该进这间屋子，那就让他完全不出场，事后听说“那天有人在屋里哭了”。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是屋里那个大人——把他带进来的、主人、病人本人。甲得当场决定拿这个孩子怎么办。\n\n**玩家在哪**：玩家可以是这个孩子，坐在那儿哭，谁也没来管你；可以是屋里的大人，先开口的那个就是你；可以是病人，你看见有人替你哭；也可以不在场，事后听说那天谁在屋里哭了。\n\n**孩子为什么哭**：他第一次在近处看见一个人要没了。他哭的不一定是这个人，是“人原来会说没就没”。这跟他和病人有多亲，可以不挂钩。\n\n**大人为什么非得立刻处理**：病人看见有人替她哭，就等于把这件事认下来了；一认下来，一屋子的宽心话全白说。所以这个孩子得被弄出去，或者被按下去。\n\n**有哪些办法**：叫出去（说外头有人等他、长辈那边惦着他）；当场怪他不懂事（说一句“你这孩子就是婆婆妈妈”，把眼泪说成孩子气）；哄他，让他坐完；什么也不说，让病人自己开口。每一种都有代价：支出去，屋里就只剩宽心话；不支出去，病人就得当着人看见有人替她哭。\n\n**要是哭的是大人**：一样成立。换个身份——跟着来的年轻晚辈、伺候的下人、病人的丈夫。\n\n**这是哪**：病房、内室、灵前、探视的地方；孩子可以换成任何一个还不会装的人。\n\n**注意**：卡停在“一屋子大人，谁也没有先开口”这一刻。不要写谁先动、怎么动。这一哭之后，这家人再也不能当着这个孩子把这件事说轻了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果按玩家世界里的规矩，这个年纪的人根本不该进这间屋子，那就让他完全不出场，事后听说“那天有人在屋里哭了”。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是屋里那个大人——把他带进来的、主人、病人本人。甲得当场决定拿这个孩子怎么办。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是这个孩子，坐在那儿哭，谁也没来管你；可以是屋里的大人，先开口的那个就是你；可以是病人，你看见有人替你哭；也可以不在场，事后听说那天谁在屋里哭了。"
      },
      {
        "key": "孩子为什么哭",
        "value": "他第一次在近处看见一个人要没了。他哭的不一定是这个人，是“人原来会说没就没”。这跟他和病人有多亲，可以不挂钩。"
      },
      {
        "key": "大人为什么非得立刻处理",
        "value": "病人看见有人替她哭，就等于把这件事认下来了；一认下来，一屋子的宽心话全白说。所以这个孩子得被弄出去，或者被按下去。"
      },
      {
        "key": "有哪些办法",
        "value": "叫出去（说外头有人等他、长辈那边惦着他）；当场怪他不懂事（说一句“你这孩子就是婆婆妈妈”，把眼泪说成孩子气）；哄他，让他坐完；什么也不说，让病人自己开口。每一种都有代价：支出去，屋里就只剩宽心话；不支出去，病人就得当着人看见有人替她哭。"
      },
      {
        "key": "要是哭的是大人",
        "value": "一样成立。换个身份——跟着来的年轻晚辈、伺候的下人、病人的丈夫。"
      },
      {
        "key": "这是哪",
        "value": "病房、内室、灵前、探视的地方；孩子可以换成任何一个还不会装的人。"
      },
      {
        "key": "注意",
        "value": "卡停在“一屋子大人，谁也没有先开口”这一刻。不要写谁先动、怎么动。这一哭之后，这家人再也不能当着这个孩子把这件事说轻了。"
      }
    ]
  },
  {
    "id": "C11-04-不让路",
    "number": "C11-04",
    "name": "不让路",
    "type": "冒犯 / 等一句话",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十一回",
    "rel": "红楼梦/现实类/第十一回/C11-04-不让路.md",
    "face": "席上的人三三两两散了。甲从里头出来，沿着园子里的路往席上去。\n\n转过一处背静地方，一个人从旁边走出来，站在路当中，说：给嫂子请安。\n\n甲认得他：本家的一个成年男子，辈分不高，平日里排不上号，今日是偷空从席上溜出来的。\n\n他并不让路。他说，这也是该着，今日偏偏就在这里碰上了；又说，改日要上家里去坐坐，只怕甲年轻，不肯见人。\n\n他说话的时候，眼睛没有离开过甲的脸。\n\n说完，他就站在那儿，等甲答话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——尤其是“甲为什么一个人走在这条路上”。要是不合理，就让甲带着人走，他当着人只敢问一句安——那这张卡就变成“当着人他也敢”，更冷，也一样成立。\n\n**甲是谁**：甲是本家一个有名分、有丈夫、有脸面的女人——可以是玩家。\n\n**玩家在哪**：玩家可以就是甲，站在路上，听他说话，决定怎么答；可以是这个人，你算准了她不能喊；可以是随行的下人，走在后头，听见了、看见了；也可以不在场，事后从别人嘴里听说“那天有个人在园子里拦住了谁”。\n\n**他是谁**：本家排不上号的成年男子——靠家里养着、没有差事、手头紧、好占便宜，四处讨好又四处碰壁。**不要把他写成一张坏脸**：在他自己心里，他说的是句好话，是抬举。\n\n**他为什么敢**：他算准了三件事——甲不能喊（一喊，满园子的人都知道）；甲要顾脸面；甲身边此刻没有人。他越是把话说得像玩笑，甲越难翻脸。\n\n**甲能怎么办**：当场翻脸；笑着说两句把他支走；回去告诉当家的；告诉丈夫；装听不懂；让他等着。每一种都有代价：翻脸，这件事就公开了，公开了两个人都得背；支走，他就知道甲不敢；告诉当家人，事情从此交给别人办，办到哪一步不由甲；不声张，他还会再来。\n\n**那个称呼是什么**：本家亲戚之间的称呼、上下之间的敬语、同辈之间的打趣。要紧的不是称呼，是**他把甲放在一个欠他人情的位置上**。\n\n**这是哪**：园子、走廊、楼道、停车场、加班的办公室、散场后的门口。凡是“半路上只有两个人”的地方，这张卡都成立。\n\n**注意**：卡停在“他站在那儿，等甲答话”这一刻。不要写甲答了什么，也不要写他后来有没有真的上门。这一句话已经说出去了，收不回来——从这一刻起，这条路上发生过什么，只有两个人知道。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——尤其是“甲为什么一个人走在这条路上”。要是不合理，就让甲带着人走，他当着人只敢问一句安——那这张卡就变成“当着人他也敢”，更冷，也一样成立。"
      },
      {
        "key": "甲是谁",
        "value": "甲是本家一个有名分、有丈夫、有脸面的女人——可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，站在路上，听他说话，决定怎么答；可以是这个人，你算准了她不能喊；可以是随行的下人，走在后头，听见了、看见了；也可以不在场，事后从别人嘴里听说“那天有个人在园子里拦住了谁”。"
      },
      {
        "key": "他是谁",
        "value": "本家排不上号的成年男子——靠家里养着、没有差事、手头紧、好占便宜，四处讨好又四处碰壁。**不要把他写成一张坏脸**：在他自己心里，他说的是句好话，是抬举。"
      },
      {
        "key": "他为什么敢",
        "value": "他算准了三件事——甲不能喊（一喊，满园子的人都知道）；甲要顾脸面；甲身边此刻没有人。他越是把话说得像玩笑，甲越难翻脸。"
      },
      {
        "key": "甲能怎么办",
        "value": "当场翻脸；笑着说两句把他支走；回去告诉当家的；告诉丈夫；装听不懂；让他等着。每一种都有代价：翻脸，这件事就公开了，公开了两个人都得背；支走，他就知道甲不敢；告诉当家人，事情从此交给别人办，办到哪一步不由甲；不声张，他还会再来。"
      },
      {
        "key": "那个称呼是什么",
        "value": "本家亲戚之间的称呼、上下之间的敬语、同辈之间的打趣。要紧的不是称呼，是**他把甲放在一个欠他人情的位置上**。"
      },
      {
        "key": "这是哪",
        "value": "园子、走廊、楼道、停车场、加班的办公室、散场后的门口。凡是“半路上只有两个人”的地方，这张卡都成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“他站在那儿，等甲答话”这一刻。不要写甲答了什么，也不要写他后来有没有真的上门。这一句话已经说出去了，收不回来——从这一刻起，这条路上发生过什么，只有两个人知道。"
      }
    ]
  },
  {
    "id": "C11-05-慢慢儿说",
    "number": "C11-05",
    "name": "慢慢儿说",
    "type": "回话 / 瞒",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十一回",
    "rel": "红楼梦/现实类/第十一回/C11-05-慢慢儿说.md",
    "face": "从病人屋里出来，当家的那个女人在廊下等着。她问：你看她，到底怎么样了？\n\n甲把话说到底了：这个就没法儿了。该给她预备的，也该预备起来了。\n\n那女人低着头，半天才说：我也暗暗地叫人预备下了。就是那件东西，还没得着好木头。\n\n她送甲到门口。临分别，又拉住甲，叮嘱一句：回去回话，慢慢儿的说，别吓着老人家。\n\n甲回到家里。辈分最高的那位长辈果然等着，见了甲，先问：你看她，怎么样了？",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个去看过病人、又得回来回话的人——可以是玩家。若甲就是病人的婆婆本人，这张卡就变成“她得自己回去对老人说”。\n\n**玩家在哪**：玩家可以是甲，站在老人面前，决定说哪一版；可以是那位老人，等着一句能让你今晚睡着的话；可以是廊下那个女人，话是从你嘴里先漏出来的；也可以不在场，事后听说这一家那天谁去看了、回来怎么说的。\n\n**同一天，三套话**：对病人说“会好的”；对着当家的说“没法儿了”；对老人说“不要紧”。同一个人，一天里说了三回。这不是虚伪——这个家里，每个人只能听其中一套。\n\n**“慢慢儿说”是什么意思**：不是叫甲撒谎，是叫甲把话切成小块，一块一块地喂。说快了，老人当场就垮；说慢了，也许能拖到他自己看出来。\n\n**那句实话是什么**：该预备的预备起来、后事该料理起来了、冲一冲也好。它是卡面上最重的一句，也是甲带出来的那个东西。\n\n**“那件东西”是什么**：一副材料、一块地、一件该早早备下的物事。卡面不指定，桌上当场定。\n\n**老人是谁**：辈分最高、最疼这个病人、自己身体也不好的那一个。他问的是病情，要的是一句能安心的话。\n\n**这是哪**：廊下、门口、上房、饭桌边、医院走廊尽头。凡是“看完病人得回去汇报”的地方，这张卡都成立。\n\n**注意**：卡停在“老人问完，等着甲开口”这一刻。不要写甲说了哪一版。这家人明天怎么过日子，就看甲这句话怎么切——而这一句，日后一定会被翻出来对。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个去看过病人、又得回来回话的人——可以是玩家。若甲就是病人的婆婆本人，这张卡就变成“她得自己回去对老人说”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，站在老人面前，决定说哪一版；可以是那位老人，等着一句能让你今晚睡着的话；可以是廊下那个女人，话是从你嘴里先漏出来的；也可以不在场，事后听说这一家那天谁去看了、回来怎么说的。"
      },
      {
        "key": "同一天，三套话",
        "value": "对病人说“会好的”；对着当家的说“没法儿了”；对老人说“不要紧”。同一个人，一天里说了三回。这不是虚伪——这个家里，每个人只能听其中一套。"
      },
      {
        "key": "“慢慢儿说”是什么意思",
        "value": "不是叫甲撒谎，是叫甲把话切成小块，一块一块地喂。说快了，老人当场就垮；说慢了，也许能拖到他自己看出来。"
      },
      {
        "key": "那句实话是什么",
        "value": "该预备的预备起来、后事该料理起来了、冲一冲也好。它是卡面上最重的一句，也是甲带出来的那个东西。"
      },
      {
        "key": "“那件东西”是什么",
        "value": "一副材料、一块地、一件该早早备下的物事。卡面不指定，桌上当场定。"
      },
      {
        "key": "老人是谁",
        "value": "辈分最高、最疼这个病人、自己身体也不好的那一个。他问的是病情，要的是一句能安心的话。"
      },
      {
        "key": "这是哪",
        "value": "廊下、门口、上房、饭桌边、医院走廊尽头。凡是“看完病人得回去汇报”的地方，这张卡都成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“老人问完，等着甲开口”这一刻。不要写甲说了哪一版。这家人明天怎么过日子，就看甲这句话怎么切——而这一句，日后一定会被翻出来对。"
      }
    ]
  },
  {
    "id": "C12-01-好脸色",
    "number": "C12-01",
    "name": "好脸色",
    "type": "假意 / 赴约",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十二回",
    "rel": "红楼梦/现实类/第十二回/C12-01-好脸色.md",
    "face": "甲去的时候，只是顺路，只是应个景。那个人待他比往常好得多：让他坐，端茶给他，问他近来做什么，留他说了好一会儿话。\n\n甲说一句玩笑，那人非但不恼，还接了下去；甲往前凑一凑，那人只说：放尊重些，别叫人看见。\n\n甲要走，那人也不留，只说：白天人来人往，你在这里不方便。你晚上再来，到时候两头门一关，谁也看不见。\n\n甲从那条路上回去，一路都觉得这件事成了。他把那人说话时的神情翻来覆去地想，又想起那句“谁也看不见”。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个被待见的人——可以是玩家，也可以是玩家的家人、朋友、下辈、同门、跟班。甲不必是个坏人，只要心里存着一件不能对人说的想头。\n\n**玩家在哪**：玩家可以就是甲，当场把这句话当成真的；可以是给好脸色的那个人，你要不要把这个人引到夜里去、引到哪儿去；可以是旁边伺候的下人，你听见了、看见了，事后要不要说出去；也可以不在场，事后从别人嘴里听说“那天他在人家屋里坐了半天”。\n\n**给好脸色的那个人是谁**：主人、当家的媳妇、管事的人、比甲高一层的人、甲得罪不起的人。她为什么肯给这个脸，卡不写；她心里到底怎么想，卡也不写。\n\n**那句约定是什么**：来说说话、来坐坐、晚上来喝一杯、等没人的时候再来。要紧的不是话，是这三点：**时间是夜里、地方是没人会去的、说这话的人今天格外和气。**\n\n**甲那点想头是什么**：情、色、“这个人总算看得起我”、“搭上这条线，我在这个家里就有路了”。是哪一种，桌上的人自己填。\n\n**为什么算轻卡**：这一张里什么都没发生——只是让一个人相信了一件没影的事。它的重量全在后一张。\n\n**这是哪**：任何有“高低之差”的世界——宅门、官署、公司、圈子、帮派、师徒。\n\n**注意**：卡停在“甲往回走，觉得这件事成了”这一刻。不要写他晚上去没去，也不要写那个人是不是真的在等他。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个被待见的人——可以是玩家，也可以是玩家的家人、朋友、下辈、同门、跟班。甲不必是个坏人，只要心里存着一件不能对人说的想头。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场把这句话当成真的；可以是给好脸色的那个人，你要不要把这个人引到夜里去、引到哪儿去；可以是旁边伺候的下人，你听见了、看见了，事后要不要说出去；也可以不在场，事后从别人嘴里听说“那天他在人家屋里坐了半天”。"
      },
      {
        "key": "给好脸色的那个人是谁",
        "value": "主人、当家的媳妇、管事的人、比甲高一层的人、甲得罪不起的人。她为什么肯给这个脸，卡不写；她心里到底怎么想，卡也不写。"
      },
      {
        "key": "那句约定是什么",
        "value": "来说说话、来坐坐、晚上来喝一杯、等没人的时候再来。要紧的不是话，是这三点：**时间是夜里、地方是没人会去的、说这话的人今天格外和气。**"
      },
      {
        "key": "甲那点想头是什么",
        "value": "情、色、“这个人总算看得起我”、“搭上这条线，我在这个家里就有路了”。是哪一种，桌上的人自己填。"
      },
      {
        "key": "为什么算轻卡",
        "value": "这一张里什么都没发生——只是让一个人相信了一件没影的事。它的重量全在后一张。"
      },
      {
        "key": "这是哪",
        "value": "任何有“高低之差”的世界——宅门、官署、公司、圈子、帮派、师徒。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲往回走，觉得这件事成了”这一刻。不要写他晚上去没去，也不要写那个人是不是真的在等他。"
      }
    ]
  },
  {
    "id": "C12-02-等了一夜",
    "number": "C12-02",
    "name": "等了一夜",
    "type": "空等 / 冻夜",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十二回",
    "rel": "红楼梦/现实类/第十二回/C12-02-等了一夜.md",
    "face": "约的是夜里。甲等到周围的人都歇了，才摸着黑进了那道门。\n\n那地方两头是门，中间一条过道，风从这头穿到那头。他侧着耳朵听了半天，只听见风。后来，先是这一头响了，再是那一头——两头都关上了。\n\n他不敢出声，上去推门，推不动；墙很高，没处下脚。这个时节夜最长，风最硬，他抱着肩膀在里面站到天亮，脚已经不是自己的了。\n\n天亮时，一个起早的人开门进来。甲趁她背过脸，一溜烟跑出去，趁着人都还没起，从后门回了家。\n\n家里的门也开了。有人等了一整夜。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是按着约定去了的那个人——可以是玩家，也可以是玩家的家人、朋友、下辈。甲不必蠢，只要**认定那件事是真的**。\n\n**玩家在哪**：玩家可以就是甲——冻了一夜，天亮前得想好回去怎么说；可以是关门的那个人，你听见门里有动静，要不要装作没听见；可以是早晨开门的那个下人，你看见了这个人，要不要说出去；也可以不在场，第二天听说他病了一场，或者挨了一顿打。\n\n**等的是谁**：昨天给过他好脸色的那个人、约他的人、他信的人。这个人可以真忘了、真有事，也可以就是故意的——卡不裁定。\n\n**为什么没来**：卡不写。桌上的人愿意往哪边想，就往哪边想。\n\n**门是谁关的**：巡夜的人照规矩关的门、被支开的人、照吩咐办事的下人。规矩本身就能把人关在外头，不必有人害他。\n\n**回去怎么说**：他有一整个白天可以想一个说辞：往亲戚家去了、天黑了留了一夜、路上不好走。也可以不撒谎——那是另一条路。\n\n**这一夜之后**：这个人身上多了一样东西：一个不能说的夜晚，和一身寒气。旁人未必知道发生了什么，但看得出他变了。\n\n**这是哪**：任何有“门会关”的世界——宿舍、办公楼、园区、外派的住处、出差住的旅馆。\n\n**注意**：卡停在“他进了自家门，等了一夜的人还在”这一刻。不要写他有没有想明白是被人耍了，也不要写等他的人怎么处置他。这张卡到这里为止，剩下的都是别人的事。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是按着约定去了的那个人——可以是玩家，也可以是玩家的家人、朋友、下辈。甲不必蠢，只要**认定那件事是真的**。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲——冻了一夜，天亮前得想好回去怎么说；可以是关门的那个人，你听见门里有动静，要不要装作没听见；可以是早晨开门的那个下人，你看见了这个人，要不要说出去；也可以不在场，第二天听说他病了一场，或者挨了一顿打。"
      },
      {
        "key": "等的是谁",
        "value": "昨天给过他好脸色的那个人、约他的人、他信的人。这个人可以真忘了、真有事，也可以就是故意的——卡不裁定。"
      },
      {
        "key": "为什么没来",
        "value": "卡不写。桌上的人愿意往哪边想，就往哪边想。"
      },
      {
        "key": "门是谁关的",
        "value": "巡夜的人照规矩关的门、被支开的人、照吩咐办事的下人。规矩本身就能把人关在外头，不必有人害他。"
      },
      {
        "key": "回去怎么说",
        "value": "他有一整个白天可以想一个说辞：往亲戚家去了、天黑了留了一夜、路上不好走。也可以不撒谎——那是另一条路。"
      },
      {
        "key": "这一夜之后",
        "value": "这个人身上多了一样东西：一个不能说的夜晚，和一身寒气。旁人未必知道发生了什么，但看得出他变了。"
      },
      {
        "key": "这是哪",
        "value": "任何有“门会关”的世界——宿舍、办公楼、园区、外派的住处、出差住的旅馆。"
      },
      {
        "key": "注意",
        "value": "卡停在“他进了自家门，等了一夜的人还在”这一刻。不要写他有没有想明白是被人耍了，也不要写等他的人怎么处置他。这张卡到这里为止，剩下的都是别人的事。"
      }
    ]
  },
  {
    "id": "C12-03-一张字据",
    "number": "C12-03",
    "name": "一张字据",
    "type": "拿住 / 开价",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十二回",
    "rel": "红楼梦/现实类/第十二回/C12-03-一张字据.md",
    "face": "还是约在夜里。这回换了个地方——屋后过道里的一间空屋子，屋里没点灯。\n\n甲来早了，在里面来回走。有人推门进来，甲迎上去抱住，灯忽然亮了：门口还站着一个人，举着灯。\n\n甲看清了怀里那个是谁——是他认得、还该叫一声晚辈的人。\n\n举灯的人不让他走：你调戏人的事，已经报到上头去了，上头叫我来拿你。\n\n甲求他，说只当没有我，日后重重谢你。那人说：放你走不难，可是光凭一张嘴不算数，得写下来。数目是他念的，写的是赌钱输了这个数。甲画了押。这一张写完，旁边那个也跟着要一张。\n\n两张纸揣进人怀里。举灯的人说：这门现在出不去，你跟我来，先找个地方躲躲。\n\n他们把他领到大台阶底下，让他蹲着，别出声，说去去就回。他蹲下没多久，头顶上一声响——一桶脏东西从头浇到脚。他咬住嘴没敢叫，浑身发冷。先前那个人跑回来喊：快走，快走！\n\n天快亮的时候，他站在自家后门口，一身味道，不知道该怎么进门。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是被拿住的那个人——可以是玩家，也可以是玩家的家人、朋友、下辈。甲做过的事可轻可重，要紧的是**它不能见光**。\n\n**玩家在哪**：玩家可以就是甲，当场写不写、写多少、回家这话怎么说；可以是举灯的那个人，你打算开什么价、放到哪一步；可以是跟着要第二张的那个人，你也可以不要；可以是被叫来关门、抬东西、泼东西的下人，你只做了你那一份；也可以不在场，事后听说某人欠了一笔说不清的债。\n\n**来的是谁**：两个熟人、同门、晚辈、下属、街面上的朋友。**来的人认得甲，这才是这张卡最狠的地方**——换两个生人，它就只是一桩敲诈。\n\n**那两张纸是什么**：欠条、赌账、收条、一张写了数目的纸。名目是假的，数目是真的，画了押就是真的——日后是可以拿出来给人看的。\n\n**可以不给吗**：可以。不给，就是当场闹大：闹到上头、闹到族里、闹到外人面前。那也是一条路，桌上的人自己挑。\n\n**泼下来的是什么**：脏东西、水、灰、一桶别人不要的东西。做什么用？让他知道这件事没完；也让他回去没法解释。这一手不是甲选的，是那个人选的。\n\n**回家这一句谎**：掉进茅厕里了、摔了一跤、帮人干活弄脏了。这一句谎说出去，这个家里就多了一个不知道底细的人。也可以不说谎。\n\n**后面还有什么**：拿着纸的人会一趟一趟来。这是这张卡的余波，不用再立卡。\n\n**这是哪**：任何有“把柄”的世界——公司、圈子、家族、账房、牌桌。\n\n**注意**：卡停在“他站在自家后门口，不知道该怎么进门”这一刻。不要写他进门以后说了什么，也不要写那两张纸什么时候被拿出来。这一卡要的不是他有多惨，是**屋里那两个人已经拿住了他，而他手里什么都没有**。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是被拿住的那个人——可以是玩家，也可以是玩家的家人、朋友、下辈。甲做过的事可轻可重，要紧的是**它不能见光**。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场写不写、写多少、回家这话怎么说；可以是举灯的那个人，你打算开什么价、放到哪一步；可以是跟着要第二张的那个人，你也可以不要；可以是被叫来关门、抬东西、泼东西的下人，你只做了你那一份；也可以不在场，事后听说某人欠了一笔说不清的债。"
      },
      {
        "key": "来的是谁",
        "value": "两个熟人、同门、晚辈、下属、街面上的朋友。**来的人认得甲，这才是这张卡最狠的地方**——换两个生人，它就只是一桩敲诈。"
      },
      {
        "key": "那两张纸是什么",
        "value": "欠条、赌账、收条、一张写了数目的纸。名目是假的，数目是真的，画了押就是真的——日后是可以拿出来给人看的。"
      },
      {
        "key": "可以不给吗",
        "value": "可以。不给，就是当场闹大：闹到上头、闹到族里、闹到外人面前。那也是一条路，桌上的人自己挑。"
      },
      {
        "key": "泼下来的是什么",
        "value": "脏东西、水、灰、一桶别人不要的东西。做什么用？让他知道这件事没完；也让他回去没法解释。这一手不是甲选的，是那个人选的。"
      },
      {
        "key": "回家这一句谎",
        "value": "掉进茅厕里了、摔了一跤、帮人干活弄脏了。这一句谎说出去，这个家里就多了一个不知道底细的人。也可以不说谎。"
      },
      {
        "key": "后面还有什么",
        "value": "拿着纸的人会一趟一趟来。这是这张卡的余波，不用再立卡。"
      },
      {
        "key": "这是哪",
        "value": "任何有“把柄”的世界——公司、圈子、家族、账房、牌桌。"
      },
      {
        "key": "注意",
        "value": "卡停在“他站在自家后门口，不知道该怎么进门”这一刻。不要写他进门以后说了什么，也不要写那两张纸什么时候被拿出来。这一卡要的不是他有多惨，是**屋里那两个人已经拿住了他，而他手里什么都没有**。"
      }
    ]
  },
  {
    "id": "C12-04-一点药末",
    "number": "C12-04",
    "name": "一点药末",
    "type": "求药 / 搪塞",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十二回",
    "rel": "红楼梦/现实类/第十二回/C12-04-一点药末.md",
    "face": "甲家里有个人病着。能试的都试过了，药吃了不知多少服，人一天比一天坏。如今只剩一味很贵的药，甲拿不出来。\n\n甲只好上别人家的门去求。那家的女主人听明白来意，说：我们这里要是也没有，你再到别处凑凑，救一条命总是好事。\n\n管着这一家东西的，是个年轻的媳妇。她当着甲的面说：前些日子正给上头配药，剩了些，就给他凑上。说完，进去吩咐了一趟。\n\n甲捧着东西回去，一路道谢。纸包不大，几钱药末，捎来一句话：上头叫送来的，再没有了。\n\n那媳妇回头向女主人回话：都寻着了，凑足了，送去了。\n\n女主人点了头。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是上门求药的那个人——可以是玩家，也可以是玩家的家人、长辈、旧仆、同乡。甲是那个**已经放下面子来求人**的人。\n\n**玩家在哪**：玩家可以就是甲，捧着那一小包回去，要不要再想办法、要不要再上门；可以是管东西的那个年轻媳妇，给多少、怎么回话，全是你定的；可以是发话的女主人，你要不要多问一句“到底送去了多少”；也可以是送药的下人，那一包有多轻，你手里最清楚；也可以不在场，事后从甲嘴里听说“人家给了药”。\n\n**这味药是什么**：一味很难找、很贵的药；对甲这一家来说，是最后一条路。放在别的世界，就是一笔拿不出的手术费、一种弄不到的针剂、一个排不上的床位、一个要人担保的名额。\n\n**管东西的人为什么这样办**：东西不是她的，人情是她的；给足了是往上贴，给一点是不落话柄，回一句圆满话是不担责任。她未必恨甲——她只是在替自己算账。\n\n**那位女主人知道吗**：可以知道，也可以不知道。她要查，一句话就能查出来——药轻不轻，送药的人、抓药的人、煎药的人都看得见。卡不裁定她查不查。\n\n**为什么算重卡**：这一小包药末送出去，救命的这一条路就算走过了，甲以后不会再上门。真正走掉的是“也许还有救”这件事。\n\n**这是哪**：任何有“东西在谁手里”的世界——大家族的库房、医院、单位、基金会、筹款的群里。\n\n**注意**：卡停在“女主人点了头”这一刻。不要写那个人后来好没好，也不要写这桩回话什么时候被人翻出来。要留的只有一件：**药是几钱，话是圆满的，两样都已经送出去了。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是上门求药的那个人——可以是玩家，也可以是玩家的家人、长辈、旧仆、同乡。甲是那个**已经放下面子来求人**的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，捧着那一小包回去，要不要再想办法、要不要再上门；可以是管东西的那个年轻媳妇，给多少、怎么回话，全是你定的；可以是发话的女主人，你要不要多问一句“到底送去了多少”；也可以是送药的下人，那一包有多轻，你手里最清楚；也可以不在场，事后从甲嘴里听说“人家给了药”。"
      },
      {
        "key": "这味药是什么",
        "value": "一味很难找、很贵的药；对甲这一家来说，是最后一条路。放在别的世界，就是一笔拿不出的手术费、一种弄不到的针剂、一个排不上的床位、一个要人担保的名额。"
      },
      {
        "key": "管东西的人为什么这样办",
        "value": "东西不是她的，人情是她的；给足了是往上贴，给一点是不落话柄，回一句圆满话是不担责任。她未必恨甲——她只是在替自己算账。"
      },
      {
        "key": "那位女主人知道吗",
        "value": "可以知道，也可以不知道。她要查，一句话就能查出来——药轻不轻，送药的人、抓药的人、煎药的人都看得见。卡不裁定她查不查。"
      },
      {
        "key": "为什么算重卡",
        "value": "这一小包药末送出去，救命的这一条路就算走过了，甲以后不会再上门。真正走掉的是“也许还有救”这件事。"
      },
      {
        "key": "这是哪",
        "value": "任何有“东西在谁手里”的世界——大家族的库房、医院、单位、基金会、筹款的群里。"
      },
      {
        "key": "注意",
        "value": "卡停在“女主人点了头”这一刻。不要写那个人后来好没好，也不要写这桩回话什么时候被人翻出来。要留的只有一件：**药是几钱，话是圆满的，两样都已经送出去了。**"
      }
    ]
  },
  {
    "id": "C12-06-体面的后事",
    "number": "C12-06",
    "name": "体面的后事",
    "type": "丧事 / 人情",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十二回",
    "rel": "红楼梦/现实类/第十二回/C12-06-体面的后事.md",
    "face": "人没了。屋里两口子哭得死去活来，一边哭一边骂：这是什么本事，把人治成这样。\n\n接下来几天，报丧的人一趟一趟出门。族里的人来了，一家一样多；同门、同窗各凑一份；连平时不走动的人家也送了东西来。钱一笔一笔记在账上，比这家请医吃药那几个月，宽裕得多。\n\n来的人各有各的说法：有说该把事办得像样的，有说这一家不容易、他生前也苦。账本摊在桌上，办多大、怎么办，就等这一家人一句话。\n\n屋角里还堆着几包没吃完的药，纸都潮了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以就是屋里那两口子（死者的长辈、配偶、家人），也可以是来的任何一个人：族里的、同门的、平时不来往的、管账的、替人跑腿的。谁出钱、谁记账、谁张罗，谁就在这张卡里。\n\n**玩家在哪**：玩家可以就是当家的那一位，钱凑上来了，怎么办是你定的；可以是一个来送丧仪的人，出多少、出不出、要不要亲自来一趟；可以是那个记账的人，你知道哪一笔是谁的、哪一笔最要紧；也可以不在场，事后听说这件事办得体面。\n\n**为什么办得起来**：人活着的时候，各家凑的是药钱——那是个填不满的坑，谁都怕填不完；人死了，各家出的是丧仪——数目有限、有面子、还得着人情。同一批人，同一笔账，前后两回事。\n\n**难处在哪里**：这一家本来就穷。这笔钱办完事还剩多少、还要自己往里贴多少、往后靠什么过日子，是要当场算的。俭着办，外头说这一家凉薄；依着数目办，家里的底就空了一半。\n\n**收不收**：可以全收，可以不收一部分，可以记下名字日后一家一家还。哪一条都有代价。\n\n**死因要不要说**：病死的、拖死的、说不清的。怎么对外说，也是这一家人当场要定的事。\n\n**为什么算轻卡**：这张卡里没有新的失去，人是在上一张里走的。它是收尾，是让活着的人算一笔账——**活着的时候凑不出来的东西，死了以后凑出来了。**\n\n**这是哪**：任何有“人走了、账要算”的世界——大家族、村子、单位、公司、同门、球队。\n\n**注意**：卡停在“账本摊在桌上，就等一句话”这一刻。不要写这家人最后选了丰还是俭，也不要写这笔人情日后怎么还。人已经没了，剩下来的全是活着的人的账。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以就是屋里那两口子（死者的长辈、配偶、家人），也可以是来的任何一个人：族里的、同门的、平时不来往的、管账的、替人跑腿的。谁出钱、谁记账、谁张罗，谁就在这张卡里。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是当家的那一位，钱凑上来了，怎么办是你定的；可以是一个来送丧仪的人，出多少、出不出、要不要亲自来一趟；可以是那个记账的人，你知道哪一笔是谁的、哪一笔最要紧；也可以不在场，事后听说这件事办得体面。"
      },
      {
        "key": "为什么办得起来",
        "value": "人活着的时候，各家凑的是药钱——那是个填不满的坑，谁都怕填不完；人死了，各家出的是丧仪——数目有限、有面子、还得着人情。同一批人，同一笔账，前后两回事。"
      },
      {
        "key": "难处在哪里",
        "value": "这一家本来就穷。这笔钱办完事还剩多少、还要自己往里贴多少、往后靠什么过日子，是要当场算的。俭着办，外头说这一家凉薄；依着数目办，家里的底就空了一半。"
      },
      {
        "key": "收不收",
        "value": "可以全收，可以不收一部分，可以记下名字日后一家一家还。哪一条都有代价。"
      },
      {
        "key": "死因要不要说",
        "value": "病死的、拖死的、说不清的。怎么对外说，也是这一家人当场要定的事。"
      },
      {
        "key": "为什么算轻卡",
        "value": "这张卡里没有新的失去，人是在上一张里走的。它是收尾，是让活着的人算一笔账——**活着的时候凑不出来的东西，死了以后凑出来了。**"
      },
      {
        "key": "这是哪",
        "value": "任何有“人走了、账要算”的世界——大家族、村子、单位、公司、同门、球队。"
      },
      {
        "key": "注意",
        "value": "卡停在“账本摊在桌上，就等一句话”这一刻。不要写这家人最后选了丰还是俭，也不要写这笔人情日后怎么还。人已经没了，剩下来的全是活着的人的账。"
      }
    ]
  },
  {
    "id": "C13-02-明早再去",
    "number": "C13-02",
    "name": "明早再去",
    "type": "赶赴 / 拦阻",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-02-明早再去.md",
    "face": "刚听说那个人不行了。甲站起来就要往外走，衣服也没顾上换。\n\n有人拦在门口，说：才咽气的人，那里不干净。二来夜也深了，风大。等明早再去，不迟。\n\n甲不肯。车马已经备下，跟从的人也派齐了，就等一句话。\n\n拦的人不松口。屋里灯亮着，门外是黑的，路上一个人也没有。\n\n甲站在门里，脚迈出去一半。在场的人都在等甲自己把那半只脚收回来。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是家里那个忍不住的年轻人、非亲非故却最放不下的那一个、早年间受过那人恩惠的人。甲是“这会儿不去，就再也见不着了”的那一个。\n\n**拦的人是谁**：家里的长辈、当家的、大夫、主事的老仆、讲规矩的人。拦的人不是坏——他说的每一条都是真的：天晚、路黑、尸首不干净、明早去也一样。这张卡的分量正在于“拦的人说得对”。\n\n**玩家在哪**：玩家可以就是甲，当场决定迈出去还是收回来；可以是拦人的那个，看着甲站在门里，要不要松口也由他；也可以是那个已经躺下的人——谁来了、谁没来，只有他知道。若玩家已经不在场，卡的重点变成“谁赶上了，谁没赶上”。\n\n**那一夜是什么**：可以是真死，也可以是刚断气、还没断气、被人误传的死讯。若是误传，卡的重量从“送别”变成“来不及解释”。\n\n**这是哪**：宅门、院门口、楼道、病房外的走廊、码头、站台都可以。“明早再走”换成“等天亮了再说”“等手续办完”“等船开了”都一样。\n\n**注意**：卡停在“甲站在门里，脚迈出去一半”这一刻。不要写甲最后出没出门。那一夜里谁在场、谁不在场，是后面所有卡的底子。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是家里那个忍不住的年轻人、非亲非故却最放不下的那一个、早年间受过那人恩惠的人。甲是“这会儿不去，就再也见不着了”的那一个。"
      },
      {
        "key": "拦的人是谁",
        "value": "家里的长辈、当家的、大夫、主事的老仆、讲规矩的人。拦的人不是坏——他说的每一条都是真的：天晚、路黑、尸首不干净、明早去也一样。这张卡的分量正在于“拦的人说得对”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场决定迈出去还是收回来；可以是拦人的那个，看着甲站在门里，要不要松口也由他；也可以是那个已经躺下的人——谁来了、谁没来，只有他知道。若玩家已经不在场，卡的重点变成“谁赶上了，谁没赶上”。"
      },
      {
        "key": "那一夜是什么",
        "value": "可以是真死，也可以是刚断气、还没断气、被人误传的死讯。若是误传，卡的重量从“送别”变成“来不及解释”。"
      },
      {
        "key": "这是哪",
        "value": "宅门、院门口、楼道、病房外的走廊、码头、站台都可以。“明早再走”换成“等天亮了再说”“等手续办完”“等船开了”都一样。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲站在门里，脚迈出去一半”这一刻。不要写甲最后出没出门。那一夜里谁在场、谁不在场，是后面所有卡的底子。"
      }
    ]
  },
  {
    "id": "C13-03-尽我所有",
    "number": "C13-03",
    "name": "尽我所有",
    "type": "操办 / 铺张",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-03-尽我所有.md",
    "face": "人走了，屋里屋外乱着。族里的长辈、远近的亲戚都到了，大家都在等着听甲开口。\n\n众人劝：人已经去了，哭也没用，还是先商议怎么办要紧。\n\n甲一拍手：怎么办？不过尽我所有罢了。\n\n说完这一句，甲什么价钱也不问了，只问一样东西够不够好、够不够大、够不够体面；不够，就换更好的。\n\n有人在旁边低声说：这样办，日后家里人不好过。甲没有回头。\n\n名帖一张张送出去，一件事一件事派下去，底下的人奔跑着去办。甲要的只有一件：让所有人都看见，这一场办得有多重。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是主家的当家人、亡者的配偶或长辈、出钱的那一个、真正心疼但又非办不可的那一个。甲未必是糊涂人；他可能只是觉得“这一场办轻了，就等于这个人白死了”“不这么办，别人要说这个家不行了”。\n\n**为什么非办不可**：这一场排场是给活人看的。甲要的可能是脸面、可能是补一份亏欠、可能是向族里和外面证明自己这一房还立着、也可能是因为心里有气。哪一种都成立，但甲必须有一个说不出口的理由。\n\n**谁在劝**：族里的长辈、同辈、账房、管事的老人、亡者自己的家里人。劝的话都是实在话：家里还有老小、日子还长、过了反倒招人议论。劝的人要有分量——没分量的人劝不动，这一场就不叫铺张，叫胡闹。\n\n**玩家在哪**：玩家可以就是甲，当场把那一句“尽我所有”说出口；可以是劝的人，话说了一次、两次，最后收住了；可以是底下办事的人，看着钱流水一样出去；也可以不在场，事后只听人说“那一场办得可真重”。\n\n**这是哪**：宅院、殡仪馆、教堂、医院、公司的追思会都可以。“排场”可以是席面、是乐器班子、是车、是花圈、是一整版的讣告。\n\n**注意**：卡停在“甲把话说满了、底下人跑起来办事”这一刻。不要写这一场办完花了多少、有没有人心疼、后面谁为这笔账吃苦。那笔账是后面几张卡的入口。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是主家的当家人、亡者的配偶或长辈、出钱的那一个、真正心疼但又非办不可的那一个。甲未必是糊涂人；他可能只是觉得“这一场办轻了，就等于这个人白死了”“不这么办，别人要说这个家不行了”。"
      },
      {
        "key": "为什么非办不可",
        "value": "这一场排场是给活人看的。甲要的可能是脸面、可能是补一份亏欠、可能是向族里和外面证明自己这一房还立着、也可能是因为心里有气。哪一种都成立，但甲必须有一个说不出口的理由。"
      },
      {
        "key": "谁在劝",
        "value": "族里的长辈、同辈、账房、管事的老人、亡者自己的家里人。劝的话都是实在话：家里还有老小、日子还长、过了反倒招人议论。劝的人要有分量——没分量的人劝不动，这一场就不叫铺张，叫胡闹。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场把那一句“尽我所有”说出口；可以是劝的人，话说了一次、两次，最后收住了；可以是底下办事的人，看着钱流水一样出去；也可以不在场，事后只听人说“那一场办得可真重”。"
      },
      {
        "key": "这是哪",
        "value": "宅院、殡仪馆、教堂、医院、公司的追思会都可以。“排场”可以是席面、是乐器班子、是车、是花圈、是一整版的讣告。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲把话说满了、底下人跑起来办事”这一刻。不要写这一场办完花了多少、有没有人心疼、后面谁为这笔账吃苦。那笔账是后面几张卡的入口。"
      }
    ]
  },
  {
    "id": "C13-04-石头的嘴",
    "number": "C13-04",
    "name": "石头的嘴",
    "type": "材料 / 来历",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-04-石头的嘴.md",
    "face": "办丧事要挑材料。甲看了一遍，都不中意，嫌薄、嫌轻、嫌不够压得住。\n\n甲到的时候，那个做这行生意的商人正好在旁边。他听说甲在找东西，就说：店里存着一副，是我父亲当年带回来的。原先是替一位极有身份的人备下的，后来那人自己的事败了，一直没用上。到今天还封在库里，也没人买得起。你要，就抬来看看。\n\n抬来一看，颜色、纹路都不寻常，凑近有股说不出的气味，用手一敲，声像玉石。在场的人都说没见过这样的。\n\n一位长辈在旁边说：这样的东西，恐怕不是寻常人该享的。\n\n甲没有答这句。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是主事的当家人、亡者的配偶或长辈、掏钱的那一个。甲是那个“不挑最好的，就觉得对不起这个人”的人。\n\n**那块东西是什么**：一副别人备下又没用上的材料。可以是棺木、是一身寿衣、是一辆车、是一间墓、是一件首饰、是一处宅子。要点有三：极贵、来历和一位倒过台的人有关、一直封着没人敢用。它本身不带任何灵异，只是有人说它“不是常人该享的”。\n\n**那位商人是谁**：做这行的、手里存着旧货的、家里传下来的、想借这一场攀附上去的。他不必是坏人；他也许真心觉得“这样的东西配得上这样的人”。\n\n**谁劝、为什么劝**：一位见过世面的长辈或者老行家。他劝一句就收住了——他知道劝不动。劝的这句话是这张卡留给后面的东西：日后这家出了事，会有人想起这句话。\n\n**玩家在哪**：玩家可以就是甲，当场定不定用这一副；可以是那位长辈，话说出去，看有没有人听；可以是那个商人；也可以不在场，事后只听说“那一副东西被用掉了”。\n\n**这是哪**：棺木店、材料行、拍卖场、库房、旧宅子都可以。“不能享”的东西可以是古董、是别人退订的定制品、是不该动的存货。\n\n**注意**：卡停在“甲没有答那句话”这一刻。不要写甲用没用、也不要写这句话日后有没有人想起。那是后面的事。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是主事的当家人、亡者的配偶或长辈、掏钱的那一个。甲是那个“不挑最好的，就觉得对不起这个人”的人。"
      },
      {
        "key": "那块东西是什么",
        "value": "一副别人备下又没用上的材料。可以是棺木、是一身寿衣、是一辆车、是一间墓、是一件首饰、是一处宅子。要点有三：极贵、来历和一位倒过台的人有关、一直封着没人敢用。它本身不带任何灵异，只是有人说它“不是常人该享的”。"
      },
      {
        "key": "那位商人是谁",
        "value": "做这行的、手里存着旧货的、家里传下来的、想借这一场攀附上去的。他不必是坏人；他也许真心觉得“这样的东西配得上这样的人”。"
      },
      {
        "key": "谁劝、为什么劝",
        "value": "一位见过世面的长辈或者老行家。他劝一句就收住了——他知道劝不动。劝的这句话是这张卡留给后面的东西：日后这家出了事，会有人想起这句话。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场定不定用这一副；可以是那位长辈，话说出去，看有没有人听；可以是那个商人；也可以不在场，事后只听说“那一副东西被用掉了”。"
      },
      {
        "key": "这是哪",
        "value": "棺木店、材料行、拍卖场、库房、旧宅子都可以。“不能享”的东西可以是古董、是别人退订的定制品、是不该动的存货。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲没有答那句话”这一刻。不要写甲用没用、也不要写这句话日后有没有人想起。那是后面的事。"
      }
    ]
  },
  {
    "id": "C13-05-各随各的",
    "number": "C13-05",
    "name": "各随各的",
    "type": "殉主 / 名分",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-05-各随各的.md",
    "face": "灵前守着两个人。这两个人都是亡人使唤出来的，一个从小跟着，一个近身伺候了这些年。亡人没有子嗣，这一门往后靠谁，还没人说得清。\n\n第一夜，第一个守夜的人整夜没合眼。天亮前后，他忽然坐直了，一句话也没留，就再没有起来。\n\n屋里人先是惊，后来都叹：这样的，少见。\n\n第二个看见了这个。过了两日，他跪到主事的人跟前，当着满屋子的亲友说：亡人没有儿女，我愿认作亡人的儿女，披麻戴孝，替他摔盆引路。\n\n主事的人大喜，当即传下话去，从今往后，都按这个名分叫他。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是主事的人、亡人的家里人、灵前管事的、跟第一个下人最熟的那一个。甲是那个“得给这两件事各定一个说法”的人。\n\n**这两个下人是谁**：亡人身边最亲近、最没有退路的两个人。可以是丫鬟、跟了多年的随从、照顾病人的护工、签了卖身契的人。他们身上都拴着“主人一死，我就无处可去”这一层。若他们本来就有出路、有家可回，这张卡就不成立。\n\n**第一个为什么死了**：原作写的是撞柱而亡。卡不解释——可以是撞了、是绝食、是病、是失足，也可以是被人说是自己寻的死。它只需要成为那件“让全族都称叹”的事。若玩家就是这个人，卡的重点变成“你为什么非这样不可”。\n\n**第二个求的是什么**：一个名分。可以是义子义女、可以是一份抚恤、可以是一个能留在灵前的身份、可以是一句“往后我替亡人守这份差事”。他求的不是情，是一条活路；他挑的时机也不是偶然——当着满屋子的亲友，主事的人不好不应。\n\n**玩家在哪**：玩家可以就是第二个，当场跪下去、把话说出口；可以是主事的人，当场应不应；可以是第一个——那就要在“坐直、再没有起来”之前停住；也可以不在场，事后听说“那家有个下人跟着去了”“还有一个认了义女”。\n\n**这是哪**：灵堂、医院、工地、船、公司都可以。“披麻戴孝、摔盆引路”换成这个地方认亲、承继、领丧的任何仪式都行——关键是这个名分要在众人面前、由主事的人亲口定下来。\n\n**注意**：卡停在“主事的人传下话去，从此按这个名分叫他”这一刻。不要写第一个死得值不值、第二个后来有没有后悔、这个名分日后认不认。名分一旦给了，是能换钱、换位置、换婚配的——那是后面的事。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是主事的人、亡人的家里人、灵前管事的、跟第一个下人最熟的那一个。甲是那个“得给这两件事各定一个说法”的人。"
      },
      {
        "key": "这两个下人是谁",
        "value": "亡人身边最亲近、最没有退路的两个人。可以是丫鬟、跟了多年的随从、照顾病人的护工、签了卖身契的人。他们身上都拴着“主人一死，我就无处可去”这一层。若他们本来就有出路、有家可回，这张卡就不成立。"
      },
      {
        "key": "第一个为什么死了",
        "value": "原作写的是撞柱而亡。卡不解释——可以是撞了、是绝食、是病、是失足，也可以是被人说是自己寻的死。它只需要成为那件“让全族都称叹”的事。若玩家就是这个人，卡的重点变成“你为什么非这样不可”。"
      },
      {
        "key": "第二个求的是什么",
        "value": "一个名分。可以是义子义女、可以是一份抚恤、可以是一个能留在灵前的身份、可以是一句“往后我替亡人守这份差事”。他求的不是情，是一条活路；他挑的时机也不是偶然——当着满屋子的亲友，主事的人不好不应。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是第二个，当场跪下去、把话说出口；可以是主事的人，当场应不应；可以是第一个——那就要在“坐直、再没有起来”之前停住；也可以不在场，事后听说“那家有个下人跟着去了”“还有一个认了义女”。"
      },
      {
        "key": "这是哪",
        "value": "灵堂、医院、工地、船、公司都可以。“披麻戴孝、摔盆引路”换成这个地方认亲、承继、领丧的任何仪式都行——关键是这个名分要在众人面前、由主事的人亲口定下来。"
      },
      {
        "key": "注意",
        "value": "卡停在“主事的人传下话去，从此按这个名分叫他”这一刻。不要写第一个死得值不值、第二个后来有没有后悔、这个名分日后认不认。名分一旦给了，是能换钱、换位置、换婚配的——那是后面的事。"
      }
    ]
  },
  {
    "id": "C13-06-一句履历",
    "number": "C13-06",
    "name": "一句履历",
    "type": "名分 / 交易",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-06-一句履历.md",
    "face": "家里办丧事，来吊祭的人里头，有一位在极要紧的地方当差。\n\n甲迎进去，奉了茶，绕了几句闲话，终于把话说了：家里这个晚辈，还没有一个正经的名分。灵幡上写起来不好看，执事的人也少。能不能给他弄一个前程？\n\n来客笑了：为的是丧礼上风光些？\n\n甲说：正是。\n\n来客说：事倒凑巧，正缺着。前儿另一个门第的兄弟来求我，拿了一笔银子送到我家，我看他长辈的分上，胡乱应了。还剩了一处。既是你们家的孩子要，快写一张履历来。\n\n甲忙命人写。红纸一张，姓名、年纪，往上三代的名头，一行行排下来。\n\n来客看了，把红纸递给身边的小厮，吩咐送回去办。\n\n临走，甲问：银子我到衙门去兑，还是送到府上？\n\n来客说：到衙门兑，你又要吃亏了。不如平准一笔送到我家，就完了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是主事的当家人、亡者的父亲或兄长、家里掏钱的人。甲未必贪这个名分；他要的是“灵幡上写起来好看”“执事的人够多”“来吊祭的人挑不出礼数”。\n\n**那个名分是什么**：一个写在纸上的身份。可以是官衔、是学位、是军功、是荣誉称号、是某个圈子的会员、是一份聘书。它唯一的用处，是在这一场丧事上把排面撑起来。要虚，但要有实据：一张凭、一份执照、一枚章。\n\n**那位来客是谁**：在要紧地方当差、手里有缺、说话算数的人。他不凶，也不敲诈，反而处处替甲打算——“到衙门兑你要吃亏”“平准一笔送到我家就完了”。他的可怕正在于他把这笔买卖做得像人情。\n\n**那笔银子去哪了**：不必写。卡只写他给了这么一个价。\n\n**玩家在哪**：玩家可以就是甲，当场求不求、给多少；可以是那位来客，给不给这个缺、报多少价；可以是那个被写进履历的晚辈，人在外头，还不知道自己的名字被写进了一张纸；也可以不在场，事后听人说“给你哥办了个前程”。\n\n**这是哪**：衙门、内廷、军中、学校、行会、公司、公会都可以。“履历”可以是档案、是推荐信、是一枚章。\n\n**注意**：卡停在“来客把那张红纸递给身边的小厮”这一刻。不要写凭什么时候到、丧事上有没有人看出破绽、日后有没有人参这一本。那张纸是后面的事的由头。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是主事的当家人、亡者的父亲或兄长、家里掏钱的人。甲未必贪这个名分；他要的是“灵幡上写起来好看”“执事的人够多”“来吊祭的人挑不出礼数”。"
      },
      {
        "key": "那个名分是什么",
        "value": "一个写在纸上的身份。可以是官衔、是学位、是军功、是荣誉称号、是某个圈子的会员、是一份聘书。它唯一的用处，是在这一场丧事上把排面撑起来。要虚，但要有实据：一张凭、一份执照、一枚章。"
      },
      {
        "key": "那位来客是谁",
        "value": "在要紧地方当差、手里有缺、说话算数的人。他不凶，也不敲诈，反而处处替甲打算——“到衙门兑你要吃亏”“平准一笔送到我家就完了”。他的可怕正在于他把这笔买卖做得像人情。"
      },
      {
        "key": "那笔银子去哪了",
        "value": "不必写。卡只写他给了这么一个价。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场求不求、给多少；可以是那位来客，给不给这个缺、报多少价；可以是那个被写进履历的晚辈，人在外头，还不知道自己的名字被写进了一张纸；也可以不在场，事后听人说“给你哥办了个前程”。"
      },
      {
        "key": "这是哪",
        "value": "衙门、内廷、军中、学校、行会、公司、公会都可以。“履历”可以是档案、是推荐信、是一枚章。"
      },
      {
        "key": "注意",
        "value": "卡停在“来客把那张红纸递给身边的小厮”这一刻。不要写凭什么时候到、丧事上有没有人看出破绽、日后有没有人参这一本。那张纸是后面的事的由头。"
      }
    ]
  },
  {
    "id": "C13-07-来理家的人",
    "number": "C13-07",
    "name": "来理家的人",
    "type": "托权 / 借人",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-07-来理家的人.md",
    "face": "家里出了大事，里外要人拿主意。偏偏管着内务的那位女主人早就病着，起不来；家里辈分最高的那位又不在，出了门就不肯回来。\n\n外头要紧的人一个一个地来，都要有人陪；里头的事一样一样，都要有人问。甲一开口，底下的人看着甲，不答。\n\n甲怕的不是钱不够，是让人看出来，这个家没人管。\n\n于是甲去求能管得住她的那位长辈，说：要屈尊她一个月，来这儿照应照应，我就放心了。\n\n长辈说：她还年轻，没经过这样的事。办不好，反倒叫人笑话。\n\n甲不肯松口，说：除了她，再没有第二个人可求了。说着，眼泪就下来了。\n\n长辈不再出声。\n\n甲命人把家里那副牌子取来，交到她手里，说：你要怎么办就怎么办，要用什么，只管拿这个去取，不必问我。只求别替我省钱，要好看为上。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是主家的长辈、当家人、亡者的父亲或兄长。甲是那个“家里没人可托、只好求外人”的人。甲求的时候越低声下气，这张卡越足。\n\n**玩家在哪**：玩家可以就是要被托付的那一个，当场接不接、问不问条件、要不要用原来的旧人；可以是甲，就是那个低声下气求人的；可以是那位拦着的长辈，看甲一眼，话就咽下去；也可以是原来管家的那位女主人，躺着，听见外头把事交给了别人。若玩家不在场，卡的重点变成“这个家的权，交到了谁手上”。\n\n**为什么非得托外人**：被托付的人不该是名正言顺的继承人。名正言顺的人接手，那是过日子；外人接手，才是这张卡。她最好是晚辈、是别房的人、是从没在这个家里当过家的人。\n\n**原来那位为什么不在**：病、伤、产后、被夺了权、赌气躲起来、干脆走了，都可以。但她的缺席必须在场面上看得见：账没人记、客没人陪、下人不敢答话。\n\n**那副牌子是什么**：一串钥匙、一枚印、一本账、一道口令、一张签字权。交出去的必须是“实权”，不是一句空话。\n\n**长辈为什么拦、为什么又松口**：她怕的是丢脸——“办不好，反倒叫人笑话”。甲拿死人和自己的脸面来压她，她就只能应。这个“只能应”，是整张卡的重量。\n\n**这是哪**：大宅、宗族大院、公司、医院、飞船都可以。\n\n**注意**：卡停在“牌子交到别人手里”这一刻。不要写那个人后来怎么发号施令、下人们服不服、办成没办成。那一摊，是后面的事。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是主家的长辈、当家人、亡者的父亲或兄长。甲是那个“家里没人可托、只好求外人”的人。甲求的时候越低声下气，这张卡越足。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是要被托付的那一个，当场接不接、问不问条件、要不要用原来的旧人；可以是甲，就是那个低声下气求人的；可以是那位拦着的长辈，看甲一眼，话就咽下去；也可以是原来管家的那位女主人，躺着，听见外头把事交给了别人。若玩家不在场，卡的重点变成“这个家的权，交到了谁手上”。"
      },
      {
        "key": "为什么非得托外人",
        "value": "被托付的人不该是名正言顺的继承人。名正言顺的人接手，那是过日子；外人接手，才是这张卡。她最好是晚辈、是别房的人、是从没在这个家里当过家的人。"
      },
      {
        "key": "原来那位为什么不在",
        "value": "病、伤、产后、被夺了权、赌气躲起来、干脆走了，都可以。但她的缺席必须在场面上看得见：账没人记、客没人陪、下人不敢答话。"
      },
      {
        "key": "那副牌子是什么",
        "value": "一串钥匙、一枚印、一本账、一道口令、一张签字权。交出去的必须是“实权”，不是一句空话。"
      },
      {
        "key": "长辈为什么拦、为什么又松口",
        "value": "她怕的是丢脸——“办不好，反倒叫人笑话”。甲拿死人和自己的脸面来压她，她就只能应。这个“只能应”，是整张卡的重量。"
      },
      {
        "key": "这是哪",
        "value": "大宅、宗族大院、公司、医院、飞船都可以。"
      },
      {
        "key": "注意",
        "value": "卡停在“牌子交到别人手里”这一刻。不要写那个人后来怎么发号施令、下人们服不服、办成没办成。那一摊，是后面的事。"
      }
    ]
  },
  {
    "id": "C13-08-五件老毛病",
    "number": "C13-08",
    "name": "五件老毛病",
    "type": "接手 / 立规矩",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十三回",
    "rel": "红楼梦/现实类/第十三回/C13-08-五件老毛病.md",
    "face": "天已经黑透了。甲坐进一间空屋子，屋里只有一张桌子、一支笔。\n\n底下的人还在外头等着派差事。甲没让人进来，先自己把这一摊的事从头想了一遍。\n\n一，人杂，东西丢得没个数。二，事没专人管，临到头上就推。三，用度没有节制，随便支、随便领。四，差事不分轻重，苦的苦死，闲的闲死。五，老资格的不服管，没脸的又上不来。\n\n甲在心里把这几条排了序，又想起临走时那人交代的两句话：别替我省钱；也照那府里的样子待下人，别存心怕人抱怨。\n\n账本摊在桌上。甲提起笔，第一条还没写下去。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是刚接下这摊事的人、被临时指派的、外来的、从来不服众的那一个。甲是那个“手里有权、底下没人认”的人。这张卡的重量，在甲“第一条写什么、先动谁”。\n\n**玩家在哪**：玩家可以就是甲，当场定第一条规矩；可以是底下等着派差事的老仆，看着新主子坐进去、迟迟不发话；可以是原来管这摊事的人，眼看着自己的旧章程被一条条拆开；也可以不在场，事后听人说“新来的那位，一上手就列了五条”。\n\n**那五条是真的吗**：这五条必须在这个家里真的存在，而且不全是下人的错——有的毛病是上面惯出来的、有的是几代人攒下的、有的是为了省事才这么办。若五条都只是“底下人坏”，这张卡就变成告状，不再成立。\n\n**那句“别替我省钱”怎么办**：它和这五条是顶着的。立规矩省钱，就得罪人的脸面；不省钱，这五条立不起来。甲只能挑一样。\n\n**这是哪**：账房、办公室、库房、料场、宗族祠堂、船上的货舱都可以。“五条”可以换成三件、四件，不必凑数。\n\n**注意**：卡停在“笔提起来、第一条还没有写下去”这一刻。不要写甲写下了哪一条、谁第一个不服、规矩立没立住。那些，是后面的事。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是刚接下这摊事的人、被临时指派的、外来的、从来不服众的那一个。甲是那个“手里有权、底下没人认”的人。这张卡的重量，在甲“第一条写什么、先动谁”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场定第一条规矩；可以是底下等着派差事的老仆，看着新主子坐进去、迟迟不发话；可以是原来管这摊事的人，眼看着自己的旧章程被一条条拆开；也可以不在场，事后听人说“新来的那位，一上手就列了五条”。"
      },
      {
        "key": "那五条是真的吗",
        "value": "这五条必须在这个家里真的存在，而且不全是下人的错——有的毛病是上面惯出来的、有的是几代人攒下的、有的是为了省事才这么办。若五条都只是“底下人坏”，这张卡就变成告状，不再成立。"
      },
      {
        "key": "那句“别替我省钱”怎么办",
        "value": "它和这五条是顶着的。立规矩省钱，就得罪人的脸面；不省钱，这五条立不起来。甲只能挑一样。"
      },
      {
        "key": "这是哪",
        "value": "账房、办公室、库房、料场、宗族祠堂、船上的货舱都可以。“五条”可以换成三件、四件，不必凑数。"
      },
      {
        "key": "注意",
        "value": "卡停在“笔提起来、第一条还没有写下去”这一刻。不要写甲写下了哪一条、谁第一个不服、规矩立没立住。那些，是后面的事。"
      }
    ]
  },
  {
    "id": "C14-01-接过来",
    "number": "C14-01",
    "name": "接过来",
    "type": "受托 / 接管",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-01-接过来.md",
    "face": "里里外外的人先被叫到一处，听了一句交代：往后这边的事由另一位管事，取东西、回话，都要小心伺候。有人应了，也有人低声说，早该有人来治一治，如今太不像样了。\n\n第二天清早，那位新管事的来了。旧管事把册子、钥匙、账目、人员，一样一样交过来。\n\n新管事把话说明白：既然托了我，我就说不得要你们嫌。从前那些“这里原是这样的”话，往后不必再说，如今要依着我行。\n\n众人听着，谁也没接话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是接过这一摊事的人。可以是玩家，也可以是家里另一位当家人、新来的总管、被临时托付的亲戚。甲是那个刚刚拿到全部名分、也刚刚把所有旧人都得罪了一遍的人。\n\n**玩家在哪**：玩家可以就是甲，当场把自己的规矩立出来；可以是被叫去听交代的旧人，心里已经开始盘算怎么应付；也可以是交册子的那一位，交得甘不甘心，是这张卡的第一道暗流。\n\n**交出来的是什么**：一本册子、一串钥匙、一沓账、一份人员名分，或一句话“都归你了”。东西越具体，后面越好算账。\n\n**为什么非换人不可**：先前乱到没人管得住，或者出了事必须有人担。这一层要交代一句，但不要长——甲不是来听故事的。\n\n**旧人的脸面**：接过来的人迟早会碰到一个人的脸面，而那个人在这家里有三四辈子的资历。这张卡只把这句话摆在台面上，不写它什么时候被撞破。\n\n**托付的那一位**：可能是一位办着大事、腾不出手的主人，也可能是一个自己已经撑不住的人。他给的是全权，收回来的也是全权。\n\n**这是哪**：任何一件事临时换了主事的人的地方——宅门、作坊、铺子、学校、机关、一个村子。\n\n**注意**：卡停在“众人听着，谁也没接话”这一刻。不要写甲后来管得怎么样，也不要写谁先不服。立了规矩之后，这个家里从此多了一套说法，这套说法日后一定会拿来对付一个人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是接过这一摊事的人。可以是玩家，也可以是家里另一位当家人、新来的总管、被临时托付的亲戚。甲是那个刚刚拿到全部名分、也刚刚把所有旧人都得罪了一遍的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场把自己的规矩立出来；可以是被叫去听交代的旧人，心里已经开始盘算怎么应付；也可以是交册子的那一位，交得甘不甘心，是这张卡的第一道暗流。"
      },
      {
        "key": "交出来的是什么",
        "value": "一本册子、一串钥匙、一沓账、一份人员名分，或一句话“都归你了”。东西越具体，后面越好算账。"
      },
      {
        "key": "为什么非换人不可",
        "value": "先前乱到没人管得住，或者出了事必须有人担。这一层要交代一句，但不要长——甲不是来听故事的。"
      },
      {
        "key": "旧人的脸面",
        "value": "接过来的人迟早会碰到一个人的脸面，而那个人在这家里有三四辈子的资历。这张卡只把这句话摆在台面上，不写它什么时候被撞破。"
      },
      {
        "key": "托付的那一位",
        "value": "可能是一位办着大事、腾不出手的主人，也可能是一个自己已经撑不住的人。他给的是全权，收回来的也是全权。"
      },
      {
        "key": "这是哪",
        "value": "任何一件事临时换了主事的人的地方——宅门、作坊、铺子、学校、机关、一个村子。"
      },
      {
        "key": "注意",
        "value": "卡停在“众人听着，谁也没接话”这一刻。不要写甲后来管得怎么样，也不要写谁先不服。立了规矩之后，这个家里从此多了一套说法，这套说法日后一定会拿来对付一个人。"
      }
    ]
  },
  {
    "id": "C14-02-一本册子",
    "number": "C14-02",
    "name": "一本册子",
    "type": "立规 / 点名",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-02-一本册子.md",
    "face": "新管事的人一到，先造册子：花名、执事、器物、领用，各立一本。\n\n人到齐了，就按册子点名，一个一个叫进来，看过了，当场分派。这些人管迎来送往的茶水，那些人管本家的饭食；四十个人一班一班轮着在灵前上香、添油、守夜；四个人专管杯碟茶器，少一件，四个人分赔；八个人专管纸札灯油，总领一处，按数分派；剩下的人按房分开，某人守某处——那一处的桌椅、陈设，直到一个痰盒、一把掸子，一草一苗，丢了坏了，都问这一个人。\n\n底下的人领了东西去，各自都有了投奔，不再像先前那样，只拣便宜的做，苦差没人揽。各房里也不能再趁乱丢东西。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是造这本册子、按名字分派的人。可以是玩家，也可以是新上任的管事、被托付的当家人。\n\n**玩家在哪**：玩家可以就是甲，握着笔决定谁管哪一处；可以是册子上被分到苦差的那一个，从此不敢走开；也可以是掌着钥匙的旧人，眼看着自己从前能通融的地方一处一处被写实。\n\n**分派下来的是什么**：一间屋子、一房器物、一段地方、一桩差事。写清楚“某人守某处”，后面才有账可算。\n\n**为什么从前乱**：人多、事杂、没人总揽；做多做少一个样，于是都拣轻的。这张卡不需要解释得更深。\n\n**分赔合不合理**：一处丢了一件小东西，要一个人赔，还是四个人分赔。这个分法本身就会有后话，卡不替谁评。\n\n**被记下来的人**：册子一立，这个家里就没有没名字的人了。原先靠着资历含糊过去的人，从此都有了一栏。\n\n**这是哪**：任何靠名册和分派运转的地方——宅门、工场、铺子、军营、学校、一间公司。\n\n**注意**：卡停在“各房里也不能再趁乱丢东西”这一刻。不要写这套册子后来管用不管用，也不要写谁被罚了第一次。册子一旦立起来，东西就开始有主——人也就开始有账。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是造这本册子、按名字分派的人。可以是玩家，也可以是新上任的管事、被托付的当家人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，握着笔决定谁管哪一处；可以是册子上被分到苦差的那一个，从此不敢走开；也可以是掌着钥匙的旧人，眼看着自己从前能通融的地方一处一处被写实。"
      },
      {
        "key": "分派下来的是什么",
        "value": "一间屋子、一房器物、一段地方、一桩差事。写清楚“某人守某处”，后面才有账可算。"
      },
      {
        "key": "为什么从前乱",
        "value": "人多、事杂、没人总揽；做多做少一个样，于是都拣轻的。这张卡不需要解释得更深。"
      },
      {
        "key": "分赔合不合理",
        "value": "一处丢了一件小东西，要一个人赔，还是四个人分赔。这个分法本身就会有后话，卡不替谁评。"
      },
      {
        "key": "被记下来的人",
        "value": "册子一立，这个家里就没有没名字的人了。原先靠着资历含糊过去的人，从此都有了一栏。"
      },
      {
        "key": "这是哪",
        "value": "任何靠名册和分派运转的地方——宅门、工场、铺子、军营、学校、一间公司。"
      },
      {
        "key": "注意",
        "value": "卡停在“各房里也不能再趁乱丢东西”这一刻。不要写这套册子后来管用不管用，也不要写谁被罚了第一次。册子一旦立起来，东西就开始有主——人也就开始有账。"
      }
    ]
  },
  {
    "id": "C14-03-迟到这一次",
    "number": "C14-03",
    "name": "迟到这一次",
    "type": "立威 / 执法",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-03-迟到这一次.md",
    "face": "点卯的时候，各项人数都齐了，只有一个迎送亲友的人没到。叫进来一问，那人说是今儿来迟了一步，求主人饶过初次。\n\n正说着，外头又有人探头进来，拿着条子要领东西。管事的先把领东西的几件事一件一件发落完，才回头对迟到的人开口：明儿他也来迟，后儿我也来迟，将来就没有人了。本来要饶你，只是我头一次宽了，下次就难管别人。\n\n说到这儿她放下脸来。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是当场要做这个决定的人。可以是玩家，也可以是管事的人、做了主的当家人。甲手里握着的不是一个人的工钱，是往后所有人守不守时刻。\n\n**玩家在哪**：玩家可以就是甲；可以是站在下头等发落的那个迟到的人，说“天天都来的早，只有今儿”，眼眶已经红了；也可以是排在队伍里的人，正拿这件事量这个新管事的人到底软不软。\n\n**那个人为什么来迟**：路远、家里有事、孩子病了、睡过了头，或者不过是仗着自己有体面。哪一种都可以，但甲此刻并不知道真的原因是哪一种。\n\n**那几条领东西的单子**：插在中间的这一节不是闲笔。它让甲在众目之下多站了一会儿——底下的人在看着，甲怎么发落这几件事，就是她怎么发落下一件事。\n\n**头一次宽了会怎么样**：也不用论证。屋里所有的人都听懂了这句话，所以才没人开口。\n\n**底下的人怎么想**：怕、服、恨、暗暗高兴，都合理。这一回的规矩是谁定的，往后出了事，账就记在谁头上。\n\n**这是哪**：任何有时刻表和点名的地方——宅门、军营、工场、学校、衙门、一间店。\n\n**注意**：卡停在“她放下脸来”这一刻，也就是甲开口的前一瞬。不要写那人挨了多少、丢了多少，也不要写甲有没有心软。这一场之后，这个家里的人第一次知道：这里的规矩是真的。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是当场要做这个决定的人。可以是玩家，也可以是管事的人、做了主的当家人。甲手里握着的不是一个人的工钱，是往后所有人守不守时刻。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲；可以是站在下头等发落的那个迟到的人，说“天天都来的早，只有今儿”，眼眶已经红了；也可以是排在队伍里的人，正拿这件事量这个新管事的人到底软不软。"
      },
      {
        "key": "那个人为什么来迟",
        "value": "路远、家里有事、孩子病了、睡过了头，或者不过是仗着自己有体面。哪一种都可以，但甲此刻并不知道真的原因是哪一种。"
      },
      {
        "key": "那几条领东西的单子",
        "value": "插在中间的这一节不是闲笔。它让甲在众目之下多站了一会儿——底下的人在看着，甲怎么发落这几件事，就是她怎么发落下一件事。"
      },
      {
        "key": "头一次宽了会怎么样",
        "value": "也不用论证。屋里所有的人都听懂了这句话，所以才没人开口。"
      },
      {
        "key": "底下的人怎么想",
        "value": "怕、服、恨、暗暗高兴，都合理。这一回的规矩是谁定的，往后出了事，账就记在谁头上。"
      },
      {
        "key": "这是哪",
        "value": "任何有时刻表和点名的地方——宅门、军营、工场、学校、衙门、一间店。"
      },
      {
        "key": "注意",
        "value": "卡停在“她放下脸来”这一刻，也就是甲开口的前一瞬。不要写那人挨了多少、丢了多少，也不要写甲有没有心软。这一场之后，这个家里的人第一次知道：这里的规矩是真的。"
      }
    ]
  },
  {
    "id": "C14-04-一天只开一个口",
    "number": "C14-04",
    "name": "一天只开一个口",
    "type": "支应 / 被磨",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-04-一天只开一个口.md",
    "face": "屋里的人没有断过。\n\n这一拨进来领东西，条子上的数目对不上，甲把其中两件退回去，说算清了再来。那一拨扫兴走了。接着又有人来回话，说前头那批货已经做完，要领工钱。\n\n后头还有一处新收拾的屋子，要支纸料去糊裱，只得先收了条子记上，等前头的账交清再发。\n\n一天下来，甲统共只在两个时候离过那张桌子。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那张桌子后面的人——新接手的管事、当家人、替人看着这一摊的人。可以是玩家。\n\n**玩家在哪**：玩家可以就是甲，一天里打发掉几十拨人；可以是门外排队的那一个，等了一上午只等来一句“算清了再来”；也可以是甲身边记册子的人，眼看着每一笔账从自己笔下过。\n\n**为什么都来找甲**：因为只有甲手里的那一件东西能放行——一块牌子、一个印、一支签、一个名字。没有它，东西出不了门，账过不了手。\n\n**“算清了再来”是什么意思**：数目不合、名目对不上、前账未清。这不一定是那两件真的错了。\n\n**换手的那一笔**：有人要工钱，甲不直接给，要先等前头交过、有人回押相符，才肯放。规矩是这样，但底下的人只会记得：是他让我多跑了一趟。\n\n**甲自己的那一间屋**：甲起坐都在一处小屋里，不跟众人一处。这不是清高，是立场——她不能跟任何一方坐在一张桌上。\n\n**这是哪**：任何一个人坐在中间、所有人绕着他办事的地方——账房、柜台、值班室、接待处、一个村里管事的那间屋。\n\n**注意**：卡停在“一天下来，甲统共只在两个时候离过那张桌子”这一刻。不要写甲心里委屈不委屈，也不要写那天到最后有没有发完。这张卡不写大转折，它写的是：一个人被架在这样的位子上，从此每一件小事都要她一个人点头。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那张桌子后面的人——新接手的管事、当家人、替人看着这一摊的人。可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，一天里打发掉几十拨人；可以是门外排队的那一个，等了一上午只等来一句“算清了再来”；也可以是甲身边记册子的人，眼看着每一笔账从自己笔下过。"
      },
      {
        "key": "为什么都来找甲",
        "value": "因为只有甲手里的那一件东西能放行——一块牌子、一个印、一支签、一个名字。没有它，东西出不了门，账过不了手。"
      },
      {
        "key": "“算清了再来”是什么意思",
        "value": "数目不合、名目对不上、前账未清。这不一定是那两件真的错了。"
      },
      {
        "key": "换手的那一笔",
        "value": "有人要工钱，甲不直接给，要先等前头交过、有人回押相符，才肯放。规矩是这样，但底下的人只会记得：是他让我多跑了一趟。"
      },
      {
        "key": "甲自己的那一间屋",
        "value": "甲起坐都在一处小屋里，不跟众人一处。这不是清高，是立场——她不能跟任何一方坐在一张桌上。"
      },
      {
        "key": "这是哪",
        "value": "任何一个人坐在中间、所有人绕着他办事的地方——账房、柜台、值班室、接待处、一个村里管事的那间屋。"
      },
      {
        "key": "注意",
        "value": "卡停在“一天下来，甲统共只在两个时候离过那张桌子”这一刻。不要写甲心里委屈不委屈，也不要写那天到最后有没有发完。这张卡不写大转折，它写的是：一个人被架在这样的位子上，从此每一件小事都要她一个人点头。"
      }
    ]
  },
  {
    "id": "C14-05-年底才回",
    "number": "C14-05",
    "name": "年底才回",
    "type": "丧信 / 远人",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-05-年底才回.md",
    "face": "家里人正在外头办事，一个跑腿的人打千儿进来请安。\n\n他带来的话是这样的：家里那位老亲九月初三那天没了。出门的那位帮着料理，同那家的年轻姑娘一路把灵送回原籍，大约赶到年底才能回来。他这回是专程回来报个信、请个安，讨一句示下，顺便取几件厚衣裳带去。\n\n管事的问他：别人那里都去过了没有。他说都去过了。\n\n他就站着，等一句话。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是接这个消息的人——当家的、管事的、拿主意的那一个。可以是玩家。甲不是死者的亲人，但全家的示下都要从甲这里出。\n\n**玩家在哪**：玩家可以就是甲，当着一屋子的人听完，先得想的是“人呢、账呢、什么时候回”；可以是报信的人，一路赶回来，话已经背熟了；可以是那个死在外头的老人家里仅剩的孩子，正在几百里外的路上；也可以完全不在场，事后听人转述。\n\n**死的是谁**：与这家很亲、但不住在一处的一位长辈、一位姻亲、一位旧交。要写得像真的，就要有人为这件事停下手里的活。\n\n**“年底才回”是什么意思**：不是出差，是丧事拖出来的日子。这一句话一落地，原本说好要回来的人，就有一阵子不在了。\n\n**取几件厚衣裳**：这是这张卡最要紧的一件小东西——那个人在外头冷，需要东西，需要时间，也需要有人替他想着。\n\n**当着人来不及细问**：这是甲的处境。消息来了，事还没完，甲只能先记下，等晚上再说。压着的那一问，是下一张卡的入口。\n\n**这是哪**：任何有人在外头、消息靠人一趟一趟带回来的地方——宅门、商号、远亲、在外做工的人家。\n\n**注意**：卡停在“他就站着，等一句话”这一刻。不要写甲当场说了什么，也不要写那个人年底到底回没回。这张卡只做一件事：让一个不在场的人，从此变成全家都得替他打算的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是接这个消息的人——当家的、管事的、拿主意的那一个。可以是玩家。甲不是死者的亲人，但全家的示下都要从甲这里出。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当着一屋子的人听完，先得想的是“人呢、账呢、什么时候回”；可以是报信的人，一路赶回来，话已经背熟了；可以是那个死在外头的老人家里仅剩的孩子，正在几百里外的路上；也可以完全不在场，事后听人转述。"
      },
      {
        "key": "死的是谁",
        "value": "与这家很亲、但不住在一处的一位长辈、一位姻亲、一位旧交。要写得像真的，就要有人为这件事停下手里的活。"
      },
      {
        "key": "“年底才回”是什么意思",
        "value": "不是出差，是丧事拖出来的日子。这一句话一落地，原本说好要回来的人，就有一阵子不在了。"
      },
      {
        "key": "取几件厚衣裳",
        "value": "这是这张卡最要紧的一件小东西——那个人在外头冷，需要东西，需要时间，也需要有人替他想着。"
      },
      {
        "key": "当着人来不及细问",
        "value": "这是甲的处境。消息来了，事还没完，甲只能先记下，等晚上再说。压着的那一问，是下一张卡的入口。"
      },
      {
        "key": "这是哪",
        "value": "任何有人在外头、消息靠人一趟一趟带回来的地方——宅门、商号、远亲、在外做工的人家。"
      },
      {
        "key": "注意",
        "value": "卡停在“他就站着，等一句话”这一刻。不要写甲当场说了什么，也不要写那个人年底到底回没回。这张卡只做一件事：让一个不在场的人，从此变成全家都得替他打算的人。"
      }
    ]
  },
  {
    "id": "C14-06-住长了的",
    "number": "C14-06",
    "name": "住长了的",
    "type": "寄居 / 定局",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-06-住长了的.md",
    "face": "消息传开，屋里的人都知道了。有人叹气，有人替那孩子掉泪。\n\n管事的却转过头，对身边一个年轻人笑了一笑，说：往后你们那位妹妹，可在咱们家住长了。\n\n年轻人一听就蹙起眉来，长长叹了口气，说：了不得，这几日她不知哭成什么样。\n\n说完，两个人都没有再往下说。\n\n窗外头还有人来回话。事还没办完。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是家里那个说得上话、也开得了这种玩笑的人。可以是玩家，也可以是当家的、管事的长辈、一个惯会说笑的人。甲未必有恶意——这句话在这张卡里之所以重，是因为它说的是实情。\n\n**玩家在哪**：玩家可以就是甲，笑着说了一句自己也觉得没什么的话；可以是那个被说到的孩子，正从别处走过来，听见了半句；可以是旁边那个叹气的年轻人；也可以不在场，事后从下人口里听说“那位往后就住下了”。\n\n**那个孩子是谁**：一个丧了亲人、投在亲戚家、原以为总会有个去处的孩子。她先前住的这家人家，未必不好；只是从这一天起，她没有别的地方可去了。\n\n**“住长了”这三个字**：可以是宽慰，也可以是打发，也可以只是随口一句。它不写恶意，也不写深情——它写的是一件已经定下来的事，被一句轻话说了出来。\n\n**为什么不可逆**：从这一刻起，这个孩子在别人眼里就不再是“来做客的”“过一阵就走的”，而是“长住的”。身份一改，往后每一件小事的分量都变了。\n\n**那个叹气的人**：他想到的是那个孩子哭成什么样；他没有想到的是，这句话说出口之后，这个家往后几十年都要为它付账。\n\n**这是哪**：任何有寄居者的地方——亲戚家、宿舍、寄养的家庭、投奔来的远亲。\n\n**注意**：卡停在“两个人都没有再往下说”这一刻。不要写那个孩子听见了没有，也不要写她后来在这个家里过得怎么样。这张卡只出一句话，一句话就够把一个人的去处定下来了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是家里那个说得上话、也开得了这种玩笑的人。可以是玩家，也可以是当家的、管事的长辈、一个惯会说笑的人。甲未必有恶意——这句话在这张卡里之所以重，是因为它说的是实情。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，笑着说了一句自己也觉得没什么的话；可以是那个被说到的孩子，正从别处走过来，听见了半句；可以是旁边那个叹气的年轻人；也可以不在场，事后从下人口里听说“那位往后就住下了”。"
      },
      {
        "key": "那个孩子是谁",
        "value": "一个丧了亲人、投在亲戚家、原以为总会有个去处的孩子。她先前住的这家人家，未必不好；只是从这一天起，她没有别的地方可去了。"
      },
      {
        "key": "“住长了”这三个字",
        "value": "可以是宽慰，也可以是打发，也可以只是随口一句。它不写恶意，也不写深情——它写的是一件已经定下来的事，被一句轻话说了出来。"
      },
      {
        "key": "为什么不可逆",
        "value": "从这一刻起，这个孩子在别人眼里就不再是“来做客的”“过一阵就走的”，而是“长住的”。身份一改，往后每一件小事的分量都变了。"
      },
      {
        "key": "那个叹气的人",
        "value": "他想到的是那个孩子哭成什么样；他没有想到的是，这句话说出口之后，这个家往后几十年都要为它付账。"
      },
      {
        "key": "这是哪",
        "value": "任何有寄居者的地方——亲戚家、宿舍、寄养的家庭、投奔来的远亲。"
      },
      {
        "key": "注意",
        "value": "卡停在“两个人都没有再往下说”这一刻。不要写那个孩子听见了没有，也不要写她后来在这个家里过得怎么样。这张卡只出一句话，一句话就够把一个人的去处定下来了。"
      }
    ]
  },
  {
    "id": "C14-07-摔下去的那一声",
    "number": "C14-07",
    "name": "摔下去的那一声",
    "type": "名分 / 替位",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-07-摔下去的那一声.md",
    "face": "出殡的那天清早，天还没亮透。六十几个人一身青，抬着灵走在最前面。前面一杆长幡，上面写着这位死者的名分，一个字一个字都是现写上去的。\n\n后头跟着一个没出嫁的女孩。她穿的是重孝。\n\n到了该起灵的时候，有人把一只瓦器递到她手里。\n\n她举起来，摔在地上。一声脆响，瓦片四散。四下里哭声大起，她也跟着哭，一路扶着灵走。\n\n从这一刻起，她的名字就写进了这场丧事里。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是接过那只瓦器、把它摔下去的人。可以是玩家，也可以是那个被指到这里来的孩子、晚辈、外人。甲原本不必站在这个位置——是这个家里挑了她。\n\n**玩家在哪**：玩家可以就是甲，手已经被塞了东西；可以是指她站过去的那个长辈，一屋子人里只有她开口算数；可以是人群里的一个远亲，看着这个位置从别人手里换到另一个人手里；也可以不在场，事后听人说起那天是谁摔的。\n\n**那只瓦器是什么**：一只碗、一只盆、一只罐，什么都行。要紧的不是它，是“谁摔的”这件事——摔的人就是替死者送终的那一个。\n\n**为什么是她**：死的人没有留下能站这个位置的人。族里总要有人来当这个孝子孝女，于是挑了一个现成的。理由往往不说出口：她住在这里，她年纪合适，她没有别处可去。\n\n**这一摔换来什么**：名分、丧服、往后的日子都要按这个身份过；也换来一份谁也不好收回的义务。她从此和这个死了的人绑在一处，哪怕她本不愿。\n\n**有没有人不服**：族里一定有人心里有话——不是自己的孩子，凭什么站在那个位置。这句话这张卡不写出来，但桌上可以有人记得。\n\n**这是哪**：任何还讲究“谁替死者送终”的地方——大族、宗族、乡下、旧式人家。\n\n**注意**：卡停在“她的名字就写进了这场丧事里”这一刻。不要写这场丧事办完她怎么样，也不要写族里后来的争议。一声脆响之后，这个家里多了一个名分——也许多了一笔债。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是接过那只瓦器、把它摔下去的人。可以是玩家，也可以是那个被指到这里来的孩子、晚辈、外人。甲原本不必站在这个位置——是这个家里挑了她。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，手已经被塞了东西；可以是指她站过去的那个长辈，一屋子人里只有她开口算数；可以是人群里的一个远亲，看着这个位置从别人手里换到另一个人手里；也可以不在场，事后听人说起那天是谁摔的。"
      },
      {
        "key": "那只瓦器是什么",
        "value": "一只碗、一只盆、一只罐，什么都行。要紧的不是它，是“谁摔的”这件事——摔的人就是替死者送终的那一个。"
      },
      {
        "key": "为什么是她",
        "value": "死的人没有留下能站这个位置的人。族里总要有人来当这个孝子孝女，于是挑了一个现成的。理由往往不说出口：她住在这里，她年纪合适，她没有别处可去。"
      },
      {
        "key": "这一摔换来什么",
        "value": "名分、丧服、往后的日子都要按这个身份过；也换来一份谁也不好收回的义务。她从此和这个死了的人绑在一处，哪怕她本不愿。"
      },
      {
        "key": "有没有人不服",
        "value": "族里一定有人心里有话——不是自己的孩子，凭什么站在那个位置。这句话这张卡不写出来，但桌上可以有人记得。"
      },
      {
        "key": "这是哪",
        "value": "任何还讲究“谁替死者送终”的地方——大族、宗族、乡下、旧式人家。"
      },
      {
        "key": "注意",
        "value": "卡停在“她的名字就写进了这场丧事里”这一刻。不要写这场丧事办完她怎么样，也不要写族里后来的争议。一声脆响之后，这个家里多了一个名分——也许多了一笔债。"
      }
    ]
  },
  {
    "id": "C14-08-只等他一个人点头",
    "number": "C14-08",
    "name": "只等他一个人点头",
    "type": "验法 / 借势",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-08-只等他一个人点头.md",
    "face": "一个年轻人在屋里闹，说要支一样东西，非现在支不可。\n\n管事的说：我不给你那块牌子，你就要不成。\n\n年轻人不信。旁边有人凑趣，说两家用的都是这种牌子，万一有人私造一块，拿去支了银子，那怎么办。管事的笑说：照你这么说，都没有规矩了。\n\n年轻人便缠上来，软磨硬泡，说好话，说不给就不走。\n\n管事的被他缠得没法，叫过人来：把册子翻给他看。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是握着那一块牌子的人。可以是玩家，也可以是管事的、管账的、握着钥匙的人。甲未必是这家里最有权的人，但此刻没有甲的点头，一样东西就动不了。\n\n**玩家在哪**：玩家可以就是甲，被人当面讨要，当着满屋子的人；可以是那个来讨的年轻人，觉得这点小事不过一句话；可以是屋里凑趣的那一个，随口一句玩笑，把规矩问成了“王法”；也可以不在场，事后听说“他到底没要到”。\n\n**那块牌子是什么**：一块可以对上号的木牌、一枚印、一支签、一把钥匙、一个名字。它的全部力量在于：只有一块，只在一个人手里。\n\n**为什么这道关非过不可**：不是钱的事，是“能不能破例”的事。甲今天给他破了，往后这屋里就再没有一道关。\n\n**那两句闲话**：一句是“私造一块怎么办”，一句是“照你这么说，都没有规矩了”。前者问的是这套法子牢不牢，后者答的其实是：这套法子靠的不是牌子，是有人认它。\n\n**甲让到哪一步**：翻册子给他看，是把规矩亮出来，不是把规矩让出来。这个分寸，是这张卡真正的秤。\n\n**这是哪**：任何靠凭证放行的地方——账房、库房、柜上、衙门、一间铺子。\n\n**注意**：卡停在“把册子翻给他看”这一刻。不要写真给他看之后他说了什么，也不要写那块牌子最后发没发。这张卡问的是：当有人要你为一句私情破一次例，你用什么挡回去。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是握着那一块牌子的人。可以是玩家，也可以是管事的、管账的、握着钥匙的人。甲未必是这家里最有权的人，但此刻没有甲的点头，一样东西就动不了。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，被人当面讨要，当着满屋子的人；可以是那个来讨的年轻人，觉得这点小事不过一句话；可以是屋里凑趣的那一个，随口一句玩笑，把规矩问成了“王法”；也可以不在场，事后听说“他到底没要到”。"
      },
      {
        "key": "那块牌子是什么",
        "value": "一块可以对上号的木牌、一枚印、一支签、一把钥匙、一个名字。它的全部力量在于：只有一块，只在一个人手里。"
      },
      {
        "key": "为什么这道关非过不可",
        "value": "不是钱的事，是“能不能破例”的事。甲今天给他破了，往后这屋里就再没有一道关。"
      },
      {
        "key": "那两句闲话",
        "value": "一句是“私造一块怎么办”，一句是“照你这么说，都没有规矩了”。前者问的是这套法子牢不牢，后者答的其实是：这套法子靠的不是牌子，是有人认它。"
      },
      {
        "key": "甲让到哪一步",
        "value": "翻册子给他看，是把规矩亮出来，不是把规矩让出来。这个分寸，是这张卡真正的秤。"
      },
      {
        "key": "这是哪",
        "value": "任何靠凭证放行的地方——账房、库房、柜上、衙门、一间铺子。"
      },
      {
        "key": "注意",
        "value": "卡停在“把册子翻给他看”这一刻。不要写真给他看之后他说了什么，也不要写那块牌子最后发没发。这张卡问的是：当有人要你为一句私情破一次例，你用什么挡回去。"
      }
    ]
  },
  {
    "id": "C14-09-来看一个人",
    "number": "C14-09",
    "name": "来看一个人",
    "type": "接见 / 被看见",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十四回",
    "rel": "红楼梦/现实类/第十四回/C14-09-来看一个人.md",
    "face": "出殡的队伍走在路上，走着走着，前面停下了。\n\n路旁搭着棚子，摆着席面，一棚接着一棚，都是各处人家来送的祭。最前头那一棚，是这一带最有身份的人家设的。\n\n棚前落了一顶轿子。轿里的人下来，手下的人两边簇拥着，军民人众一例不许近前。这一家的几个长辈连忙迎上去，行的礼比对旁人都重。\n\n那人回了礼，很客气，说的还是旧交的话。说完了，他忽然问了一句：那一位，听说生下来就带着一件东西的，是哪一位？久想见一见，今天一定在这里，何不请来？",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个被叫到跟前来的孩子，也可以是必须把孩子领上前的那位父亲、长辈。甲可以不是全场最重要的人，但从这一问起，他是。\n\n**玩家在哪**：玩家可以就是那个孩子，被人从队伍里领出来，衣裳现换；可以是替孩子整衣、牵他上前的那个人；可以是站在后头看着这一幕的家人；也可以不在场，事后听满城的人说“那天人家点了他的名”。\n\n**那一件东西是什么**：一个胎记、一块随身的佩、一桩从出生就传开的异事。它必须是别人替他记着的——他自己不觉得那是身份。\n\n**看重的是哪一个**：是这件东西，还是“这一家还撑得起被人高看一眼”这件事？两头都可以落。落得越重，往后这个孩子越不能只是他自己。\n\n**那一声问的语气**：客气、随意，甚至带着好意。它之所以是转折，不是因为它凶，而是因为从这一句起，这个孩子被记进了那边的一本册子里——那本册子不会自己把这行字划掉。\n\n**父亲答得快不快**：有人当场就把孩子领上去了，有人拖了一拖，有人推到事后。这个快慢，是往后管得住管不住的分界。\n\n**这是哪**：任何“一个人被有权势的人当面点名要看”的地方——府第、军门、官府、一间大公司、一个县里的祠堂。\n\n**注意**：卡停在“何不请来”这一刻。不要写那个孩子上去之后说了什么，也不要写这一面日后结出什么果。这张卡只写一件事：一个人被点了名，从此他的名字不只属于他家里的人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个被叫到跟前来的孩子，也可以是必须把孩子领上前的那位父亲、长辈。甲可以不是全场最重要的人，但从这一问起，他是。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是那个孩子，被人从队伍里领出来，衣裳现换；可以是替孩子整衣、牵他上前的那个人；可以是站在后头看着这一幕的家人；也可以不在场，事后听满城的人说“那天人家点了他的名”。"
      },
      {
        "key": "那一件东西是什么",
        "value": "一个胎记、一块随身的佩、一桩从出生就传开的异事。它必须是别人替他记着的——他自己不觉得那是身份。"
      },
      {
        "key": "看重的是哪一个",
        "value": "是这件东西，还是“这一家还撑得起被人高看一眼”这件事？两头都可以落。落得越重，往后这个孩子越不能只是他自己。"
      },
      {
        "key": "那一声问的语气",
        "value": "客气、随意，甚至带着好意。它之所以是转折，不是因为它凶，而是因为从这一句起，这个孩子被记进了那边的一本册子里——那本册子不会自己把这行字划掉。"
      },
      {
        "key": "父亲答得快不快",
        "value": "有人当场就把孩子领上去了，有人拖了一拖，有人推到事后。这个快慢，是往后管得住管不住的分界。"
      },
      {
        "key": "这是哪",
        "value": "任何“一个人被有权势的人当面点名要看”的地方——府第、军门、官府、一间大公司、一个县里的祠堂。"
      },
      {
        "key": "注意",
        "value": "卡停在“何不请来”这一刻。不要写那个孩子上去之后说了什么，也不要写这一面日后结出什么果。这张卡只写一件事：一个人被点了名，从此他的名字不只属于他家里的人。"
      }
    ]
  },
  {
    "id": "C15-01-你不会转",
    "number": "C15-01",
    "name": "你不会转",
    "type": "开眼 / 不认得",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十五回",
    "rel": "红楼梦/现实类/第十五回/C15-01-你不会转.md",
    "face": "出城办一件大事，走到半路，进了一处农家院子歇脚。院子里堆着甲不认识的东西，一样一样看过去，都叫不出名字。\n\n墙角还有一件，甲伸手就要去摇。一个年轻女人从屋里出来，说：别弄坏了。\n\n甲带来的人立刻上前吆喝她。甲把手收回来，说我只是没见过，试一试。\n\n那女人说：你不会，等我转给你看。\n\n她坐下来，摇起来。手很稳，东西在她手里转得又匀又好看。甲站在旁边，一动不动地看。\n\n那边有人喊她。她把手一放，起身走了，没有再回头看甲一眼。\n\n傍晚车马出村，甲在车上回头，看见她站在村口，怀里抱着一个孩子，也正往这边看。车走得快，一转过去，就什么也没有了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这一队人里身份最高的那个年轻人——被人捧着、没见过这样东西、又不肯在人前失态。甲也可以是那户人家的人、跟着伺候的人、随行的亲友。若玩家占甲，卡的重点是“你要不要问一句这个人是谁”。\n\n**玩家在哪**：玩家可以是甲，站在院子里看人摇那件东西；可以是甲带来的人，那一声吆喝就是从你嘴里出来的；可以是那个年轻女人，你护着你的日子，教他转一转，然后被叫走了；也可以不在场，事后听人说“那天那位在人家院子里摆弄了半天那物件”。\n\n**那个年轻女人是谁**：十七八岁，在自家院里或帮工的院子里干活。她不认得甲，或者认得也不当回事。她开口第一句不是请安，是制止——她护的是自己的日子。她不怕他，这才是这张卡最锋利的地方。\n\n**那件东西是什么**：纺车、石磨、水车、织机、风箱、一套不认得的锅灶。必须是“她天天用、甲从来没见过”的东西。若它只是个摆设，这张卡就没有味道了——它不是一件新奇物件，是她的一双手。\n\n**甲的人为什么吆喝**：护主是他们的差事。这一声吆喝把甲放到了一个尴尬的地方：他既顾着自己的体面，又不愿意让那个女人觉得他不讲理。\n\n**后来看见她抱着孩子**：那一眼是有温度的，也是够不着的。她已经进了另一种日子，那种日子里没有甲。\n\n**这是哪**：任何一条路上——路边人家、驿站、码头、工地旁、村子、集市。路上遇上的人，一辈子只见一面。\n\n**注意**：卡停在“车一转过去，什么也没有了”这一刻。不要写甲有没有再问起她、有没有记住她。甲这一生记住的，偏偏是一个没把他当回事的人——这一条，日后再用。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这一队人里身份最高的那个年轻人——被人捧着、没见过这样东西、又不肯在人前失态。甲也可以是那户人家的人、跟着伺候的人、随行的亲友。若玩家占甲，卡的重点是“你要不要问一句这个人是谁”。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，站在院子里看人摇那件东西；可以是甲带来的人，那一声吆喝就是从你嘴里出来的；可以是那个年轻女人，你护着你的日子，教他转一转，然后被叫走了；也可以不在场，事后听人说“那天那位在人家院子里摆弄了半天那物件”。"
      },
      {
        "key": "那个年轻女人是谁",
        "value": "十七八岁，在自家院里或帮工的院子里干活。她不认得甲，或者认得也不当回事。她开口第一句不是请安，是制止——她护的是自己的日子。她不怕他，这才是这张卡最锋利的地方。"
      },
      {
        "key": "那件东西是什么",
        "value": "纺车、石磨、水车、织机、风箱、一套不认得的锅灶。必须是“她天天用、甲从来没见过”的东西。若它只是个摆设，这张卡就没有味道了——它不是一件新奇物件，是她的一双手。"
      },
      {
        "key": "甲的人为什么吆喝",
        "value": "护主是他们的差事。这一声吆喝把甲放到了一个尴尬的地方：他既顾着自己的体面，又不愿意让那个女人觉得他不讲理。"
      },
      {
        "key": "后来看见她抱着孩子",
        "value": "那一眼是有温度的，也是够不着的。她已经进了另一种日子，那种日子里没有甲。"
      },
      {
        "key": "这是哪",
        "value": "任何一条路上——路边人家、驿站、码头、工地旁、村子、集市。路上遇上的人，一辈子只见一面。"
      },
      {
        "key": "注意",
        "value": "卡停在“车一转过去，什么也没有了”这一刻。不要写甲有没有再问起她、有没有记住她。甲这一生记住的，偏偏是一个没把他当回事的人——这一条，日后再用。"
      }
    ]
  },
  {
    "id": "C15-02-歇在这边",
    "number": "C15-02",
    "name": "歇在这边",
    "type": "落脚 / 托付",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十五回",
    "rel": "红楼梦/现实类/第十五回/C15-02-歇在这边.md",
    "face": "大事办完，来送的人一路散尽。主家都要回城，只有一个人不肯走。\n\n那是个半大的孩子，跟着长辈来的，说这一趟还没玩够：再住一天，明儿一准回去。\n\n家里派来的人劝过，长辈也劝过，都不听。长辈没法，当着一圈人把这个孩子交给了他在这里最信得过的那个当家人，只交代两句：多穿两件衣裳；没事宁可回去。然后带着人先走了。\n\n车马走空了。留下的人也各有去处：有的挤在办丧事的那处院子里，有的嫌那里不方便，另在城外寻了一处清静地方落脚。\n\n晚饭摆上来，灯点上，这孩子挨着那个当家人坐着，一点要回去的意思也没有。\n\n甲是那个替他张罗住处的人。住处有了，一夜也就有了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是替这孩子张罗住处的人，可以是那个被留下来照看他的当家人，也可以是这个孩子本人。甲必须是“本来该走、结果留下了”的那一个——这一夜的分量全在这里。\n\n**玩家在哪**：玩家可以是甲，替人收拾出一间屋子、再替他挡掉家里派来的人；可以是那个当家人，当着众人接下一句“交给你了”；可以是那个孩子，所有人都在等你上车，你说不走；也可以不在场，事后听说这一夜你是被谁留下的。\n\n**为什么留下来**：玩心、恋着这里的某个人、怕一回去就被关起来念书、头一回出远门。理由可以换，“该走的时候不肯走”这一条不能换。\n\n**那位长辈为什么把孩子交给他**：因为这一处只有这个人管得住他。这一交，就是把孩子的一夜交出去了——交的人知道，接的人也知道。\n\n**这一夜为什么住得成**：办丧事的地方本来留了铺盖，是为等着做完道场的人备的；嫌不方便的，才另寻去处。住一夜不是什么事——但这一夜之后，许多本来做不成的事，就有了做的空。\n\n**还有谁在这几处院子里**：几个本家的女眷、几个等日子才散的近亲、几个闲下来就凑在一处说话的婆子。人在一个院子里住一夜，话是藏不住的。\n\n**这是哪**：任何“大事办完之后，剩下的人各自找地方过夜”的场合——婚礼、丧礼、考试、开工、远行途中的头一个晚上。\n\n**注意**：卡停在“住处有了，一夜也就有了”这一刻。不要写这一夜出了什么事。留下的人和受托的那个人，从这一夜起，都少了一句“我本来可以回去”。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是替这孩子张罗住处的人，可以是那个被留下来照看他的当家人，也可以是这个孩子本人。甲必须是“本来该走、结果留下了”的那一个——这一夜的分量全在这里。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，替人收拾出一间屋子、再替他挡掉家里派来的人；可以是那个当家人，当着众人接下一句“交给你了”；可以是那个孩子，所有人都在等你上车，你说不走；也可以不在场，事后听说这一夜你是被谁留下的。"
      },
      {
        "key": "为什么留下来",
        "value": "玩心、恋着这里的某个人、怕一回去就被关起来念书、头一回出远门。理由可以换，“该走的时候不肯走”这一条不能换。"
      },
      {
        "key": "那位长辈为什么把孩子交给他",
        "value": "因为这一处只有这个人管得住他。这一交，就是把孩子的一夜交出去了——交的人知道，接的人也知道。"
      },
      {
        "key": "这一夜为什么住得成",
        "value": "办丧事的地方本来留了铺盖，是为等着做完道场的人备的；嫌不方便的，才另寻去处。住一夜不是什么事——但这一夜之后，许多本来做不成的事，就有了做的空。"
      },
      {
        "key": "还有谁在这几处院子里",
        "value": "几个本家的女眷、几个等日子才散的近亲、几个闲下来就凑在一处说话的婆子。人在一个院子里住一夜，话是藏不住的。"
      },
      {
        "key": "这是哪",
        "value": "任何“大事办完之后，剩下的人各自找地方过夜”的场合——婚礼、丧礼、考试、开工、远行途中的头一个晚上。"
      },
      {
        "key": "注意",
        "value": "卡停在“住处有了，一夜也就有了”这一刻。不要写这一夜出了什么事。留下的人和受托的那个人，从这一夜起，都少了一句“我本来可以回去”。"
      }
    ]
  },
  {
    "id": "C15-03-没有手段",
    "number": "C15-03",
    "name": "没有手段",
    "type": "求人 / 激将",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十五回",
    "rel": "红楼梦/现实类/第十五回/C15-03-没有手段.md",
    "face": "人都散了，院里只剩几个心腹。管着这处院子的那个女人进来坐下，先问了一句安，然后说：我有一件事，先请您示下。\n\n她讲的是别人家的一桩官司：两家为一个女孩儿定过亲，后来一户更有势力的人家看上了她，非娶不可；女方想退，男方不肯，两家就闹起来，如今女方赌气，偏要把这门亲退了。她替女方求一句话——求这家的女主人往远处递个话，让那边松口。\n\n她说：要是肯行，那一家哪怕倾家相谢，也是情愿的。\n\n女主人听完，笑了一笑，说：这事倒不大。只是家里那一位早就不管这些事了。\n\n她点头，说：那一位不管，您自己可以主张。\n\n女主人说：我也不等钱使，也不做这样的事。\n\n屋里静了一会儿。那位管院子的女人叹了一口气，说：\n\n话不是这么说。那一家如今已经知道来求过这一家了。您要是不管，人家不会说是没工夫、不图谢礼——倒像是这一家连这点子手段也没有。\n\n女主人听了这一句，坐直了些。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个被求的人——手里有路子、又不肯白使路子的那一个。甲也可以是那位来求人的女主人，一句一句把话往上递。\n\n**玩家在哪**：玩家可以是甲，坐在灯下听一个人替别人家求你；可以是那位来求人的，正把最后那一句放出去；可以是在旁伺候的人，这句“没手段”从谁的嘴里出去、传到哪里，你最清楚；也可以不在场，日后只听说这一夜有人在这院里求过人。\n\n**求的是什么**：不是钱，是一句话。一句话要过好几道手才到得了那边，所以听起来不难，做起来也不脏。这正是它最容易被答应的地方。\n\n**为什么求到这一家**：这家的男人和那边有旧；那一家不缺钱，缺的是脸面；她一个出家人、一个外人，只有一张嘴和一本旧人情。\n\n**那根刺是什么**：不是骂，是替她算账——传出去的不是“不肯管”，是“管不了”。在这样的人家，这两件事不是一回事。这一句是这张卡的机关：它不动她的心，动的是她的名。\n\n**她为什么先推**：不是不要钱，是还没到时候；也不是不肯管，是不肯为这点小钱落个“替人跑腿”的名。她要的是对方把话说得更大，把她的身价抬出来。\n\n**那桩官司是真的吗**：可以真有其事，也可以只是这位管院子的女人编的。两种都成立。不论哪一种，女方那一家如今都在等一个回话。\n\n**那个女孩儿呢**：从头到尾，没有一个人问过她的意思。这一条不要写进卡面，但要记着——六张卡里，她是唯一一个不出场的人。\n\n**这是哪**：任何一处“求人”的门槛——宅子、衙门、公司、书院、宗祠、病房外的走廊。\n\n**注意**：卡停在“女主人坐直了些”。不要写她答没答应、开口要了什么。这一句落在她心上之后，事情就已经不在这位管院子的女人手里了。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个被求的人——手里有路子、又不肯白使路子的那一个。甲也可以是那位来求人的女主人，一句一句把话往上递。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，坐在灯下听一个人替别人家求你；可以是那位来求人的，正把最后那一句放出去；可以是在旁伺候的人，这句“没手段”从谁的嘴里出去、传到哪里，你最清楚；也可以不在场，日后只听说这一夜有人在这院里求过人。"
      },
      {
        "key": "求的是什么",
        "value": "不是钱，是一句话。一句话要过好几道手才到得了那边，所以听起来不难，做起来也不脏。这正是它最容易被答应的地方。"
      },
      {
        "key": "为什么求到这一家",
        "value": "这家的男人和那边有旧；那一家不缺钱，缺的是脸面；她一个出家人、一个外人，只有一张嘴和一本旧人情。"
      },
      {
        "key": "那根刺是什么",
        "value": "不是骂，是替她算账——传出去的不是“不肯管”，是“管不了”。在这样的人家，这两件事不是一回事。这一句是这张卡的机关：它不动她的心，动的是她的名。"
      },
      {
        "key": "她为什么先推",
        "value": "不是不要钱，是还没到时候；也不是不肯管，是不肯为这点小钱落个“替人跑腿”的名。她要的是对方把话说得更大，把她的身价抬出来。"
      },
      {
        "key": "那桩官司是真的吗",
        "value": "可以真有其事，也可以只是这位管院子的女人编的。两种都成立。不论哪一种，女方那一家如今都在等一个回话。"
      },
      {
        "key": "那个女孩儿呢",
        "value": "从头到尾，没有一个人问过她的意思。这一条不要写进卡面，但要记着——六张卡里，她是唯一一个不出场的人。"
      },
      {
        "key": "这是哪",
        "value": "任何一处“求人”的门槛——宅子、衙门、公司、书院、宗祠、病房外的走廊。"
      },
      {
        "key": "注意",
        "value": "卡停在“女主人坐直了些”。不要写她答没答应、开口要了什么。这一句落在她心上之后，事情就已经不在这位管院子的女人手里了。"
      }
    ]
  },
  {
    "id": "C15-04-我说行就行",
    "number": "C15-04",
    "name": "我说行就行",
    "type": "行权 / 开价",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十五回",
    "rel": "红楼梦/现实类/第十五回/C15-04-我说行就行.md",
    "face": "灯下只剩两个人。那位管院子的女人又把话往上抬了一层：这点子事，在别人自然忙得不知怎么样；在您跟前，再添上些也不够您一办的。又说了一句保重身子。\n\n甲听着，越听越受用，也不困了。\n\n甲说：你是素日知道我的。我从来不信什么报应。凭是什么事，我说要行就行。你叫他们拿三千来，我就替他出这口气。\n\n对面的人忙说：有，有，这个不难。\n\n甲又说：我比不得那些替人说合拉纤的，图几个钱。这笔不过是给跑腿的人做盘缠，让他们赚几个辛苦钱儿，我一个钱也不要。就是三万，我这会子也还拿得出来。\n\n对面连声应着，说明儿就开恩罢了。\n\n甲说：你瞧瞧我忙的，那一处少得了我？我既应了你，自然给你了结。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个能一句话差动人的人。她不是被别人买下来的，是她自己要卖这个面子。甲若是个心软的人，这张卡就没有味道；甲若是个只知道钱的人，也没有——她要的是“我说要行就行”被人当真。\n\n**玩家在哪**：玩家可以是甲，在灯下听人奉承，然后落那一句；可以是那位求人的女人，一路奉承，等着这句话；可以是那个被派去跑腿的下人，你不必知道全貌，你只知道要往哪里送一封信；也可以不在场，日后只听说这一笔是谁应下的。\n\n**卡面写的是哪一种落法**：卡面写的是原作里的那一种。若玩家占甲的槽，这一句要不要说出口、说到哪一句为止，由甲自己落——卡只把这一夜推到这个位置。\n\n**她要的是什么**：不是钱。钱是“给跑腿的人的盘缠”，她一个也不要——这句话必须由她说出来。她要的是她那一句被人当真，而且要当着外人的面被当真。\n\n**价钱为什么是这个数**：不能太低，低了是跑腿；不能太高，高了是勒索。要让求人的那一家“倾家”也肯拿出来，又不能真把人家逼到绝路。这个数要当场定下来，定下来就不能再改。\n\n**那句“我不信报应”**：这是这张卡的开门句。她不求来世，也不怕有人来找她；这句话说出来，往后每一件事都只能在这一世里算账。\n\n**那一句怎么落到人间**：在她这边是一句话，到外头要有人去写、去送、去等回话；中间经几道手、用什么名义、先找谁后找谁。每一道都是把柄，每一道也都有人记着自己的功劳。\n\n**对面那个女人**：她是个说客。她替人跑这一趟，自己得了一份人情，也担着“说成了／没说成”的名声。这种人不会只来这一次。\n\n**事情办成的样子**：不必有打、有审、有判。书信来去，几日工夫，那边受这家旧恩的人“这些小事岂有不允之理”，一封信就办了。这是这张卡真正的重量——从头到尾没有一个坏人出场。\n\n**这是哪**：任何有“能差动人的人”的世界——大家族、官场、公司、宗门、帮派、经纪行、镇上的头面人家。\n\n**注意**：卡停在“我既应了你，自然给你了结”。不要写这件事办成什么样，也不要写那一家后来的下场。甲说过“我一个钱也不要”——这一句日后会回来找她。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个能一句话差动人的人。她不是被别人买下来的，是她自己要卖这个面子。甲若是个心软的人，这张卡就没有味道；甲若是个只知道钱的人，也没有——她要的是“我说要行就行”被人当真。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，在灯下听人奉承，然后落那一句；可以是那位求人的女人，一路奉承，等着这句话；可以是那个被派去跑腿的下人，你不必知道全貌，你只知道要往哪里送一封信；也可以不在场，日后只听说这一笔是谁应下的。"
      },
      {
        "key": "卡面写的是哪一种落法",
        "value": "卡面写的是原作里的那一种。若玩家占甲的槽，这一句要不要说出口、说到哪一句为止，由甲自己落——卡只把这一夜推到这个位置。"
      },
      {
        "key": "她要的是什么",
        "value": "不是钱。钱是“给跑腿的人的盘缠”，她一个也不要——这句话必须由她说出来。她要的是她那一句被人当真，而且要当着外人的面被当真。"
      },
      {
        "key": "价钱为什么是这个数",
        "value": "不能太低，低了是跑腿；不能太高，高了是勒索。要让求人的那一家“倾家”也肯拿出来，又不能真把人家逼到绝路。这个数要当场定下来，定下来就不能再改。"
      },
      {
        "key": "那句“我不信报应”",
        "value": "这是这张卡的开门句。她不求来世，也不怕有人来找她；这句话说出来，往后每一件事都只能在这一世里算账。"
      },
      {
        "key": "那一句怎么落到人间",
        "value": "在她这边是一句话，到外头要有人去写、去送、去等回话；中间经几道手、用什么名义、先找谁后找谁。每一道都是把柄，每一道也都有人记着自己的功劳。"
      },
      {
        "key": "对面那个女人",
        "value": "她是个说客。她替人跑这一趟，自己得了一份人情，也担着“说成了／没说成”的名声。这种人不会只来这一次。"
      },
      {
        "key": "事情办成的样子",
        "value": "不必有打、有审、有判。书信来去，几日工夫，那边受这家旧恩的人“这些小事岂有不允之理”，一封信就办了。这是这张卡真正的重量——从头到尾没有一个坏人出场。"
      },
      {
        "key": "这是哪",
        "value": "任何有“能差动人的人”的世界——大家族、官场、公司、宗门、帮派、经纪行、镇上的头面人家。"
      },
      {
        "key": "注意",
        "value": "卡停在“我既应了你，自然给你了结”。不要写这件事办成什么样，也不要写那一家后来的下场。甲说过“我一个钱也不要”——这一句日后会回来找她。"
      }
    ]
  },
  {
    "id": "C15-05-出了这个坑",
    "number": "C15-05",
    "name": "出了这个坑",
    "type": "私情 / 条件",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十五回",
    "rel": "红楼梦/现实类/第十五回/C15-05-出了这个坑.md",
    "face": "白天在堂屋里，一个女孩儿端茶过来，两个人抢着要，她抿着嘴笑：一碗茶也争，难道我手上有蜜。\n\n夜里，人都歇下了。那一个摸到后头屋里，她一个人在那儿洗碗。\n\n他从后头搂上来。她跺着脚推开，说这是做什么，就要喊。他说：好妹妹，我急死了，你今儿再不依我，我就死在这里。\n\n她还是不肯。她说：你要怎么样，除非我出了这个坑，离了这些人才好呢。\n\n他说：这也容易，只是远水解不得近渴。\n\n她还要说什么，灯忽然灭了，屋里漆黑。\n\n再往下，一双手从后头按上来，不出声。两个人都唬住了。黑暗里“嗤”的一笑——是跟着那一个一道来的另一个少年。\n\n他起来了，恼了，说这算什么。那少年说：你倒不依？咱们就嚷出来。\n\n黑地里一阵乱，她趁这一阵跑了。剩下两个人在屋里，外头那一个笑着说：你可还强嘴不强。\n\n那一个笑道：好哥哥，你只别嚷，你要怎么着都使的。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。这一场要成立，得有两个条件：一个有身份、能到处走动的外人；一个被关在一处、不许出去的年轻女人。\n\n**甲是谁**：甲可以是那个求她的人，也可以是那个从后头按上来的人，也可以是那个说“除非”的女孩儿。三种占法，三种分量。\n\n**玩家在哪**：玩家可以是那个求她的人——你要不要拿一句空话去换这一夜；可以是那个撞进来的人——你要不要嚷出来；可以是那个女孩儿——你手上只有这一样东西，你要不要用它换一个出去的门；也可以不在场，日后从别人口中听说这一夜谁在后头屋里。\n\n**那个“坑”是什么**：庙里、工坊、大户人家的后院、船队、帮佣的人家、学徒的铺子、寄住的亲戚家——一个她出不去、也不许出去的地方。她在这里除了一个名字，什么身份也没有。\n\n**她为什么要这个条件**：不是矜持。这件事是她身上唯一还由自己说了算的东西；她要的不是这一夜，是出去。这个条件一说出口，她就已经把自己押上去了。\n\n**那句“这也容易”是什么意思**：不是答应，是敷衍。一个“容易”把她的条件挪到以后；以后就没有以后了。\n\n**撞进来的人要什么**：不一定是要她。他要的是那一个从此欠他。这一夜之后，那一个就再没有第二句话好说——这一条才是这张卡留在桌上的东西。\n\n**灯为什么这时候灭**：灭灯是这一场里最关键的一步。黑了，谁都可以说不是自己；也就谁都可以说是我。\n\n**白天那一碗茶**：不是闲笔。两个人当着她的面争一碗茶，就说明她在他们眼里是什么——一件可以拿来赌气的东西。她笑的那一句“难道我手上有蜜”，是她最后的体面。\n\n**这是哪**：任何“外人进得来、里面的人出不去”的地方。\n\n**注意**：卡停在“你要怎么着都使的”。不要写那一个答应了什么、后来做没做。她提的条件已经说出口，而且被人听见了——这就是这张卡留下的东西。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。这一场要成立，得有两个条件：一个有身份、能到处走动的外人；一个被关在一处、不许出去的年轻女人。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是那个求她的人，也可以是那个从后头按上来的人，也可以是那个说“除非”的女孩儿。三种占法，三种分量。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个求她的人——你要不要拿一句空话去换这一夜；可以是那个撞进来的人——你要不要嚷出来；可以是那个女孩儿——你手上只有这一样东西，你要不要用它换一个出去的门；也可以不在场，日后从别人口中听说这一夜谁在后头屋里。"
      },
      {
        "key": "那个“坑”是什么",
        "value": "庙里、工坊、大户人家的后院、船队、帮佣的人家、学徒的铺子、寄住的亲戚家——一个她出不去、也不许出去的地方。她在这里除了一个名字，什么身份也没有。"
      },
      {
        "key": "她为什么要这个条件",
        "value": "不是矜持。这件事是她身上唯一还由自己说了算的东西；她要的不是这一夜，是出去。这个条件一说出口，她就已经把自己押上去了。"
      },
      {
        "key": "那句“这也容易”是什么意思",
        "value": "不是答应，是敷衍。一个“容易”把她的条件挪到以后；以后就没有以后了。"
      },
      {
        "key": "撞进来的人要什么",
        "value": "不一定是要她。他要的是那一个从此欠他。这一夜之后，那一个就再没有第二句话好说——这一条才是这张卡留在桌上的东西。"
      },
      {
        "key": "灯为什么这时候灭",
        "value": "灭灯是这一场里最关键的一步。黑了，谁都可以说不是自己；也就谁都可以说是我。"
      },
      {
        "key": "白天那一碗茶",
        "value": "不是闲笔。两个人当着她的面争一碗茶，就说明她在他们眼里是什么——一件可以拿来赌气的东西。她笑的那一句“难道我手上有蜜”，是她最后的体面。"
      },
      {
        "key": "这是哪",
        "value": "任何“外人进得来、里面的人出不去”的地方。"
      },
      {
        "key": "注意",
        "value": "卡停在“你要怎么着都使的”。不要写那一个答应了什么、后来做没做。她提的条件已经说出口，而且被人听见了——这就是这张卡留下的东西。"
      }
    ]
  },
  {
    "id": "C15-06-不肯回家",
    "number": "C15-06",
    "name": "不肯回家",
    "type": "留下 / 无门",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十五回",
    "rel": "红楼梦/现实类/第十五回/C15-06-不肯回家.md",
    "face": "那个人停在偏室里。天不亮就有人进去上香、换供、烧纸。\n\n事情办完了，一大家子要回城。车马已经套好，行李往车上搬。死者的配偶、长辈、族里几个管事的男人都在等，只等一个人上车。\n\n那一个人不肯走。\n\n她不是死者的亲属。她是死者身边最近的那个年轻女人，没有名分，也没有娘家可以回。她只说要留在这里，陪着，守着。\n\n族里的人劝过，说这里冷清，说一个年轻女孩儿家不成体统。她不听。\n\n最后，那个管事的男人没法，叫来两个妇人，吩咐跟着一道留下，照看她。车马走了。\n\n偏室门口，她站着。来送的人都是外人，一个个从她面前过去。\n\n甲是最后上车的那一个。车门关上的时候，甲回头看了一眼，门口还站着那个人。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。还要先确认这个年轻女人在故事里是什么位置：若是死者的至亲，这不算选择；若是一个没有名分、又没有退路的人，这才会成为一件事。\n\n**甲是谁**：甲是那个要当场决定“让不让她留”的人——死者的配偶、当家的、族里的长辈。甲也可以是最后上车的那一个，站在车门那儿回头。\n\n**玩家在哪**：玩家可以是甲，被一个人当着全家人的面将住；可以是本来要走的那个，站在门口，谁劝都不动；可以是那个管事的男人派去陪她的妇人，从此你的日子跟一个不相干的人绑在一处；也可以不在场，日后听人说“那家那位姑娘没回来”。\n\n**她为什么不走**：可以是为死者，也可以是为自己——回了城，她就是一个没有去处的人。两条都要留着：前一条体面，后一条才真。\n\n**“陪”是什么意思**：不是殉，是把往后的日子放进一间屋子。她从此不嫁、不出门、不替自己打算。在她的处境里，这未必是牺牲，也可能是唯一一条她自己能选的路。\n\n**那个管事的男人为什么答应**：他嫌麻烦。劝一个不肯走的人，比留两个妇人陪着她麻烦得多。他答应的不是她，是自己省事。\n\n**后来那间屋子是什么样**：每月有人送米送炭，逢年过节有人来一趟，别的事再没有人过问。她是那个“陪着的人”——这个名分好听，也最没有着落。这是余波，不要写进卡面。\n\n**死者是谁**：这一回里刚死的那个人；若是前面几回死的人，就用那个人的位置，卡不变。\n\n**这是哪**：任何“丧事办完，各人回各人的地方”的世界。\n\n**注意**：卡停在“车门关上的时候，甲回头看了一眼”。不要写她后来守了多久、有没有后悔。有人自愿留在一个没有门的地方——这一件事本身，就是这张卡要留下的。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。还要先确认这个年轻女人在故事里是什么位置：若是死者的至亲，这不算选择；若是一个没有名分、又没有退路的人，这才会成为一件事。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个要当场决定“让不让她留”的人——死者的配偶、当家的、族里的长辈。甲也可以是最后上车的那一个，站在车门那儿回头。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，被一个人当着全家人的面将住；可以是本来要走的那个，站在门口，谁劝都不动；可以是那个管事的男人派去陪她的妇人，从此你的日子跟一个不相干的人绑在一处；也可以不在场，日后听人说“那家那位姑娘没回来”。"
      },
      {
        "key": "她为什么不走",
        "value": "可以是为死者，也可以是为自己——回了城，她就是一个没有去处的人。两条都要留着：前一条体面，后一条才真。"
      },
      {
        "key": "“陪”是什么意思",
        "value": "不是殉，是把往后的日子放进一间屋子。她从此不嫁、不出门、不替自己打算。在她的处境里，这未必是牺牲，也可能是唯一一条她自己能选的路。"
      },
      {
        "key": "那个管事的男人为什么答应",
        "value": "他嫌麻烦。劝一个不肯走的人，比留两个妇人陪着她麻烦得多。他答应的不是她，是自己省事。"
      },
      {
        "key": "后来那间屋子是什么样",
        "value": "每月有人送米送炭，逢年过节有人来一趟，别的事再没有人过问。她是那个“陪着的人”——这个名分好听，也最没有着落。这是余波，不要写进卡面。"
      },
      {
        "key": "死者是谁",
        "value": "这一回里刚死的那个人；若是前面几回死的人，就用那个人的位置，卡不变。"
      },
      {
        "key": "这是哪",
        "value": "任何“丧事办完，各人回各人的地方”的世界。"
      },
      {
        "key": "注意",
        "value": "卡停在“车门关上的时候，甲回头看了一眼”。不要写她后来守了多久、有没有后悔。有人自愿留在一个没有门的地方——这一件事本身，就是这张卡要留下的。"
      }
    ]
  },
  {
    "id": "C16-01-改换衣裳",
    "number": "C16-01",
    "name": "改换衣裳",
    "type": "传唤 / 喜讯",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-01-改换衣裳.md",
    "face": "这天家里正在办事，席摆开了，人人都在座。忽然门上的人进来报：外头来了一位，坐着车，带着随从，说是上头叫他来的。\n\n戏停了，席撤了，香案摆出来，中门打开，一家上下跪下去接。\n\n来的人没有带文书。他下了车，走上厅，面朝南站着，脸上带着笑，只说了一句：上头要立刻见你家做主的那个人。说完也不喝茶，上车就走了。\n\n做主的那个人换了衣裳出门。一屋子女眷聚在廊下，谁也说不清是祸是福，一趟一趟地派人出去打听。\n\n过了两个时辰，管事的满头是汗跑进来，一路喊着报喜。他还没喘匀气，就说出了那个位号，又说：请老太太领着太太们，进宫谢恩。\n\n一屋子的女人，从惶惶变成喜，立刻各自回房，按品改换衣裳，一乘一乘的轿子抬出去。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这一家做主的人——家长、户主、族长、东家，也可以是玩家。若不是玩家，就让甲和玩家有直接的关系：父亲、伯父、养你长大的人。\n\n**玩家在哪**：玩家可以在场，是这一家的一员，跟着跪、跟着换衣裳；可以是那个被叫走的人，出了门就再没有消息；也可以不在场，回来时发现门上挂着红，全屋子的人都在换衣裳，没人顾得上告诉你为什么。\n\n**这一场分两拍**：第一拍是**来的人**——不说缘由，只说\"上头要见\"，越客气越吓人。第二拍是**报喜**——消息从门房一路传进来，谁先知道、谁后知道，本身就是一份次序。\n\n**为什么先慌后喜**：因为\"上头叫你\"这件事，可以是升，也可以是拿。这个家里的人不敢往好处想，也不敢往坏处想，只能派人一趟一趟地跑。这份悬着的时间，是这张卡最值钱的地方。\n\n**位号是什么**：一个封号、一个官职、一个品级、一个头衔、一个\"被上面点了名\"的身份。它给的不是钱，是名分。名分一变，这一家在亲戚、邻里、同僚眼里的分量全变。\n\n**改换衣裳是什么**：按品级、按身份、按场合换的行头。换衣裳这个动作要演出来：谁去换了、谁没有资格换、谁的衣服是临时借的、谁换到一半发现自己那件不合规矩。\n\n**这是哪**：任何有\"上头\"和\"名分\"的世界——朝廷、官府、军队、公司、门派、宗门。上头可以是皇帝、上司、董事会、掌门、宗主。\n\n**注意**：卡停在\"一乘一乘的轿子抬出去\"这一刻。不要写这一家从此怎么得意，也不要写这道恩典日后要付什么账。留在场上的只有这一件事：**从今天起，这一家人的名字前面，多了一个身份。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这一家做主的人——家长、户主、族长、东家，也可以是玩家。若不是玩家，就让甲和玩家有直接的关系：父亲、伯父、养你长大的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是这一家的一员，跟着跪、跟着换衣裳；可以是那个被叫走的人，出了门就再没有消息；也可以不在场，回来时发现门上挂着红，全屋子的人都在换衣裳，没人顾得上告诉你为什么。"
      },
      {
        "key": "这一场分两拍",
        "value": "第一拍是**来的人**——不说缘由，只说\"上头要见\"，越客气越吓人。第二拍是**报喜**——消息从门房一路传进来，谁先知道、谁后知道，本身就是一份次序。"
      },
      {
        "key": "为什么先慌后喜",
        "value": "因为\"上头叫你\"这件事，可以是升，也可以是拿。这个家里的人不敢往好处想，也不敢往坏处想，只能派人一趟一趟地跑。这份悬着的时间，是这张卡最值钱的地方。"
      },
      {
        "key": "位号是什么",
        "value": "一个封号、一个官职、一个品级、一个头衔、一个\"被上面点了名\"的身份。它给的不是钱，是名分。名分一变，这一家在亲戚、邻里、同僚眼里的分量全变。"
      },
      {
        "key": "改换衣裳是什么",
        "value": "按品级、按身份、按场合换的行头。换衣裳这个动作要演出来：谁去换了、谁没有资格换、谁的衣服是临时借的、谁换到一半发现自己那件不合规矩。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"上头\"和\"名分\"的世界——朝廷、官府、军队、公司、门派、宗门。上头可以是皇帝、上司、董事会、掌门、宗主。"
      },
      {
        "key": "注意",
        "value": "卡停在\"一乘一乘的轿子抬出去\"这一刻。不要写这一家从此怎么得意，也不要写这道恩典日后要付什么账。留在场上的只有这一件事：**从今天起，这一家人的名字前面，多了一个身份。**"
      }
    ]
  },
  {
    "id": "C16-02-八九分",
    "number": "C16-02",
    "name": "八九分",
    "type": "恩典 / 动工",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-02-八九分.md",
    "face": "一个人回来，刚坐下，就有人追着问那件事到底准了没有。\n\n他说：还不十分准，也有八九分了。\n\n问的人一拍手，说这可是当今的恩典，从来听戏听书，古时候也没有过。旁边一个上了年纪的女仆听不明白，问：说了半天，到底是怎么个恩典？\n\n于是有人从头讲给她听：上头体谅宫里的人多年见不着父母，开了恩，除了逢日子许家里人进宫请安，还许有像样院子的人家，把宫里的仪仗接到自己家里来住几天。这条恩典一出来，举国上下谁不踊跃？如今已经有两家动工了，一家在城里修院子，一家在城外踏看地方。\n\n\"这样说起来，咱们家也要预备着了？\"\n\n\"这还用说？不然这几天忙的是什么？\"\n\n当天下午，管事的就带着人量地基去了：从东边一带起，一直量到西边，一共三里半大，画图样的人当天就到。第二天起，拆墙的拆墙，引水的引水，旧园子里的石头树木，能挪的都往一处挪。\n\n工地上各行匠役齐全，金铜土木的物件一车一车往里运。管事的、监工的、记账的，人人手里有差事。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是家里能定事的人——当家做主的那一个，或者是回来传话的那一个。他手里有一句还没落地的话，和一片已经动起来的地。\n\n**玩家在哪**：玩家可以在场，是这一家的人，正被派去量地、画图、监工；可以是那个回来传话的人，被一屋子人围着问；也可以不在场，回来时家里已经拆了半座宅子，没有人觉得需要跟你解释。\n\n**为什么\"八九分\"就够开工**：因为体面这件事等不得。等旨意真下来，图样、木料、人手、日子全都赶不上；先动土的人家，才有脸面。这句话是这一家的判断，不是卡替他们做的决定。\n\n**这个院子是给谁的**：给那位进了宫的人——她是这一家最尊贵的客人，也是这一家从此必须伺候好的人。院子修得越大，往后要维持的东西越多。\n\n**代价在哪**：拆掉的墙、挪走的树、占去的地、被赶出去的下人。要当着桌上的人把这些念出来：为了这一件事，谁搬了家、谁让了院子、谁的屋子从此见不到太阳。\n\n**这是哪**：任何有\"上头要来\"的世界——迎驾、接驾、上级视察、大人物到访、宗门贵客驻留、总部来的人住进分公司。\n\n**注意**：卡停在\"人人手里有差事\"这一刻。不要写这一家后来花了多少、撑不撑得住，也不要写那位贵人来了以后满不满意。留在场上的是这件事：**上头还没有准话，这一家已经拆了半座宅子。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是家里能定事的人——当家做主的那一个，或者是回来传话的那一个。他手里有一句还没落地的话，和一片已经动起来的地。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，是这一家的人，正被派去量地、画图、监工；可以是那个回来传话的人，被一屋子人围着问；也可以不在场，回来时家里已经拆了半座宅子，没有人觉得需要跟你解释。"
      },
      {
        "key": "为什么\"八九分\"就够开工",
        "value": "因为体面这件事等不得。等旨意真下来，图样、木料、人手、日子全都赶不上；先动土的人家，才有脸面。这句话是这一家的判断，不是卡替他们做的决定。"
      },
      {
        "key": "这个院子是给谁的",
        "value": "给那位进了宫的人——她是这一家最尊贵的客人，也是这一家从此必须伺候好的人。院子修得越大，往后要维持的东西越多。"
      },
      {
        "key": "代价在哪",
        "value": "拆掉的墙、挪走的树、占去的地、被赶出去的下人。要当着桌上的人把这些念出来：为了这一件事，谁搬了家、谁让了院子、谁的屋子从此见不到太阳。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"上头要来\"的世界——迎驾、接驾、上级视察、大人物到访、宗门贵客驻留、总部来的人住进分公司。"
      },
      {
        "key": "注意",
        "value": "卡停在\"人人手里有差事\"这一刻。不要写这一家后来花了多少、撑不撑得住，也不要写那位贵人来了以后满不满意。留在场上的是这件事：**上头还没有准话，这一家已经拆了半座宅子。**"
      }
    ]
  },
  {
    "id": "C16-03-动一处银子",
    "number": "C16-03",
    "name": "动一处银子",
    "type": "银钱 / 体面",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-03-动一处银子.md",
    "face": "屋里几个人围着灯坐，商量这一趟出门办事的银子从哪里出。\n\n有人报账：家里现银不趁手，也不用从城里带。早年有一笔钱存在外省一户亲戚家里，数目还在，凭一封信去支就是。\n\n坐着的人点头：那就写一封信去，先支一半，剩下的一半留在那边，等回来买那些花灯、蜡烛、帘帐的时候再用。\n\n旁边一个上了年纪的女仆听着，插了一句嘴。她说：这样的排场，我年轻时候见过一回。那时候一家人接驾，银子花得跟淌海水似的。\n\n又有人说：如今还有一家，接过四回，那才叫势派。世上有的东西，他家没有一样不是堆山积海的；\"罪过可惜\"四个字，竟顾不得了。\n\n那女仆说了一句：也不过是拿着上头家的银子，往上头身上使罢了。谁家有那些钱，买这个虚热闹去。\n\n这句话说出来，屋里静了一下，没有人接。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是能点头的人——当家的、管账的、拿印的、签字的那个。他不一定有钱，但他能决定动哪一笔。\n\n**玩家在哪**：玩家可以就是甲，当场要在这张纸上签一个字；可以是那个报账的人，你报的这笔账其实早就不趁手了；可以是那个老女仆，你说了一句实话，屋里没有人接；也可以不在场，事后只知道家里动了一笔钱。\n\n**这笔银子是什么**：一笔早年寄存在亲戚家的钱、一笔存在别处的家底、一笔不在自己账上的产业、一份存在别人名下的股。它是实东西，只是不在这家的柜子里。\n\n**为什么不用自家的钱**：现银要留着日常开销，或者自家的账上根本不好看；存在别人家里的那一笔，是这一家最不惹眼的钱。用它，是账上的讲究，不是没有钱。\n\n**那老女仆是谁**：家里跟过上一辈、见过上一场大排场的旧人。她见过，所以她说得出这句话。她的话不进账本，也不进任何人的决定，只是让在座的人心里过了一下。\n\n**她的那句话是什么意思**：这场热闹花的钱，本来就不是自家的钱；花出去，是给上头看的。她不说这是好是坏，她只把这层说出来。\n\n**这是哪**：任何有\"公账\"和\"私账\"、\"家里的钱\"和\"上头的钱\"的世界——官府、衙门、公司、宗门、大家族、军府。\n\n**注意**：卡停在\"没有人接\"这一刻。不要写这笔银子后来支了没有、花了多少、够不够。留在场上的是这件事：**这一笔钱不是这一家的，但只有这一家花得动它。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是能点头的人——当家的、管账的、拿印的、签字的那个。他不一定有钱，但他能决定动哪一笔。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，当场要在这张纸上签一个字；可以是那个报账的人，你报的这笔账其实早就不趁手了；可以是那个老女仆，你说了一句实话，屋里没有人接；也可以不在场，事后只知道家里动了一笔钱。"
      },
      {
        "key": "这笔银子是什么",
        "value": "一笔早年寄存在亲戚家的钱、一笔存在别处的家底、一笔不在自己账上的产业、一份存在别人名下的股。它是实东西，只是不在这家的柜子里。"
      },
      {
        "key": "为什么不用自家的钱",
        "value": "现银要留着日常开销，或者自家的账上根本不好看；存在别人家里的那一笔，是这一家最不惹眼的钱。用它，是账上的讲究，不是没有钱。"
      },
      {
        "key": "那老女仆是谁",
        "value": "家里跟过上一辈、见过上一场大排场的旧人。她见过，所以她说得出这句话。她的话不进账本，也不进任何人的决定，只是让在座的人心里过了一下。"
      },
      {
        "key": "她的那句话是什么意思",
        "value": "这场热闹花的钱，本来就不是自家的钱；花出去，是给上头看的。她不说这是好是坏，她只把这层说出来。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"公账\"和\"私账\"、\"家里的钱\"和\"上头的钱\"的世界——官府、衙门、公司、宗门、大家族、军府。"
      },
      {
        "key": "注意",
        "value": "卡停在\"没有人接\"这一刻。不要写这笔银子后来支了没有、花了多少、够不够。留在场上的是这件事：**这一笔钱不是这一家的，但只有这一家花得动它。**"
      }
    ]
  },
  {
    "id": "C16-04-带两个人去",
    "number": "C16-04",
    "name": "带两个人去",
    "type": "差事 / 人情",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-04-带两个人去.md",
    "face": "屋里夫妻两个坐着吃酒。门上来报：管事的两个年轻人来了，来回一件差事。\n\n先说定的是院子：地基量过了，图样明日就得，请不必再跑一趟，有话明早面议。\n\n再说的是一件出远门的事：要去南边请人、采买、置办乐器行头，主事的人派了其中一个年轻人去，带着管家的两个儿子，还有两位门下的清客。\n\n坐着的那位打量他，笑了一句：你办得了这个么？这差事看着不大，里头有藏掖的。\n\n年轻人陪着笑：只好学着办罢了。\n\n另一个人站在灯影后头，悄悄拉了一下管事的衣角。等出了门，他跟上去，低声说：您要什么东西，开个单子，我按着置办了来。\n\n被啐了回去：你拿东西换我的人情来了么？\n\n这时候，一个上了年纪的女仆进来了。她是这家男主人的奶妈。她不要酒，也不要钱，只要一句话：她有两个儿子，至今闲在家里，先前答应过她的，一直没落地。她说，如今家里正有这样一桩大事，哪里不用人？靠着她奶大的那位，只怕她早饿死了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是能派差事的人——当家的、管事的、手里有位置的。他一句话，能让人出远门，也能让人继续闲着。\n\n**玩家在哪**：玩家可以就是甲，面前站着三个等回话的人；可以是那个被派出去的年轻人，你还没办过事，先学会了收东西；可以是那两个年轻人里的一个，你正想着怎么把好处递出去；也可以是那个老女仆，你讨的是你早就该得的那一份。\n\n**为什么这件事值得成卡**：一桩正经的差事刚下来，半天之内就有三拨人来分它——出力的、搭便的、讨旧账的。差事还没出门，人情已经先走了一趟。\n\n**\"里头有藏掖\"是什么意思**：采买这一行，报价和实价之间有一层。派谁去，就等于把这一层交给谁。这一句是提醒，也是默许。\n\n**那老女仆的分量**：她不是外人，是喂大过这一家男主人的人。她讨的不是钱，是位置。她的两个儿子叫什么名字，得当场定下来，不然这趟差事就走。\n\n**旧账是什么旧账**：答应过的话、许过的事、家里上一辈欠下的人情。她记得比谁都清，因为她没有别的依靠。\n\n**这是哪**：任何有\"差事\"和\"人情\"的世界——衙门、商号、公司、门派、剧组、家族。出远门办事、采购、请人，都是同一张卡。\n\n**注意**：卡停在\"她还在等一句话\"这一刻。不要写甲给不给位置、带不带那个人去。留在场上的是这件事：**差事一出，来分的人比办事的人多。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是能派差事的人——当家的、管事的、手里有位置的。他一句话，能让人出远门，也能让人继续闲着。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，面前站着三个等回话的人；可以是那个被派出去的年轻人，你还没办过事，先学会了收东西；可以是那两个年轻人里的一个，你正想着怎么把好处递出去；也可以是那个老女仆，你讨的是你早就该得的那一份。"
      },
      {
        "key": "为什么这件事值得成卡",
        "value": "一桩正经的差事刚下来，半天之内就有三拨人来分它——出力的、搭便的、讨旧账的。差事还没出门，人情已经先走了一趟。"
      },
      {
        "key": "\"里头有藏掖\"是什么意思",
        "value": "采买这一行，报价和实价之间有一层。派谁去，就等于把这一层交给谁。这一句是提醒，也是默许。"
      },
      {
        "key": "那老女仆的分量",
        "value": "她不是外人，是喂大过这一家男主人的人。她讨的不是钱，是位置。她的两个儿子叫什么名字，得当场定下来，不然这趟差事就走。"
      },
      {
        "key": "旧账是什么旧账",
        "value": "答应过的话、许过的事、家里上一辈欠下的人情。她记得比谁都清，因为她没有别的依靠。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"差事\"和\"人情\"的世界——衙门、商号、公司、门派、剧组、家族。出远门办事、采购、请人，都是同一张卡。"
      },
      {
        "key": "注意",
        "value": "卡停在\"她还在等一句话\"这一刻。不要写甲给不给位置、带不带那个人去。留在场上的是这件事：**差事一出，来分的人比办事的人多。**"
      }
    ]
  },
  {
    "id": "C16-05-一笔进项",
    "number": "C16-05",
    "name": "一笔进项",
    "type": "私房 / 瞒着",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-05-一笔进项.md",
    "face": "有人到房里来回话。她刚开口，就看见男主人也在屋里，话说到一半停住了，改口说起别的事。坐了一会儿，走了。\n\n等人出去，她走回女主人身边，凑近了低声说：那笔银子送来了。幸亏我在外间碰见，先接了过来。那个人越来越不会看时候，挑着男主人在家，偏这时候送进来。要是他径直来回话，让男主人听见了，依着男主人的性子，油锅里的钱都要捞出来花，往后还不知怎么大胆。\n\n女主人听完，笑了笑，说：我说呢，怎么巴巴地打发个人来。原来是你这蹄子闹鬼。\n\n银子已经收下，话已经圆过去，屋里又剩下两个人。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个把银子接过来的人——管事的、贴身的人、管账的人，也可以是那位女主人自己。甲手里过的钱，比账本上写的多。\n\n**玩家在哪**：玩家可以就是甲，站在门口，来送钱的人已经到了台阶下；可以是女主人，你得决定这笔钱往哪里放、这件事跟不跟枕边的人提；可以是男主人，你什么都不知道，但屋里那两个人刚才停了一下；也可以不在场，日后从一笔对不上的账上发现它。\n\n**这笔进项是什么**：放出去的银子每月收上来的利、一笔不写在自己名下的收益、替别人办事收下的东西、外头送进来的例钱。它是实的，数目清楚，就是不上账。\n\n**为什么瞒着**：因为说出去就留不住。男主人手里松，谁开口都拿得走；女主人手里紧，这笔钱是她给自己留的底。这不是谁比谁坏，是两个人的用法不同。\n\n**\"你这蹄子闹鬼\"是什么意思**：她不但没有怪，还夸了一句机灵。这说明瞒着这件事，在这一家是常态，不是意外。\n\n**代价在哪**：从这一刻起，屋里多了一个知道这件事的人。她知道，来送钱的人也知道；而男主人不知道。这三个人往后每一次见面，都要绕开这一笔钱。\n\n**这是哪**：任何有\"公中\"和\"私房\"的世界——大家族、公司、合伙生意、夫妻共同财产、门派账房。\n\n**注意**：卡停在\"屋里又剩下两个人\"这一刻。不要写这笔钱后来被谁发现了，也不要写女主人拿它做了什么。留在场上的是这件事：**有一笔钱进了这间屋子，而这间屋子里有一个人不知道。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个把银子接过来的人——管事的、贴身的人、管账的人，也可以是那位女主人自己。甲手里过的钱，比账本上写的多。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，站在门口，来送钱的人已经到了台阶下；可以是女主人，你得决定这笔钱往哪里放、这件事跟不跟枕边的人提；可以是男主人，你什么都不知道，但屋里那两个人刚才停了一下；也可以不在场，日后从一笔对不上的账上发现它。"
      },
      {
        "key": "这笔进项是什么",
        "value": "放出去的银子每月收上来的利、一笔不写在自己名下的收益、替别人办事收下的东西、外头送进来的例钱。它是实的，数目清楚，就是不上账。"
      },
      {
        "key": "为什么瞒着",
        "value": "因为说出去就留不住。男主人手里松，谁开口都拿得走；女主人手里紧，这笔钱是她给自己留的底。这不是谁比谁坏，是两个人的用法不同。"
      },
      {
        "key": "\"你这蹄子闹鬼\"是什么意思",
        "value": "她不但没有怪，还夸了一句机灵。这说明瞒着这件事，在这一家是常态，不是意外。"
      },
      {
        "key": "代价在哪",
        "value": "从这一刻起，屋里多了一个知道这件事的人。她知道，来送钱的人也知道；而男主人不知道。这三个人往后每一次见面，都要绕开这一笔钱。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"公中\"和\"私房\"的世界——大家族、公司、合伙生意、夫妻共同财产、门派账房。"
      },
      {
        "key": "注意",
        "value": "卡停在\"屋里又剩下两个人\"这一刻。不要写这笔钱后来被谁发现了，也不要写女主人拿它做了什么。留在场上的是这件事：**有一笔钱进了这间屋子，而这间屋子里有一个人不知道。**"
      }
    ]
  },
  {
    "id": "C16-06-赶出去",
    "number": "C16-06",
    "name": "赶出去",
    "type": "私情 / 处置",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-06-赶出去.md",
    "face": "有一个人，常常借着由头进这一家的门。这一天，他私底下来找这家里的一个年轻人，被家里知道了。\n\n家里没有骂他，也没有装作不知道。管事的人把他叫到门口，当着人，一句一句说给他听：你从今往后不要再来了。你也不要再见他。\n\n说完，就让人把他送出去。\n\n那人被推出门，站在街上。他没有家，没有别处可去；来的路很远，回去的路也一样远。他回头看了一眼那扇门，门在他面前关上。\n\n院子里安静下来。那个年轻人被关在屋里，隔着窗子听着外头的动静。刚才那几句话，屋里的人都听见了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个被赶出去的人，也可以是下令赶人的那一个，或者是屋里那个年轻人。三方都有得应对：走、留、还是把门再开一次。\n\n**玩家在哪**：玩家可以就是站在门外的那个人——你身上没有钱，也不知道今晚住哪里；可以是屋里的人，隔着一道墙听见自己的名字被念出来；可以是下令的人，你要决定门关不关；也可以不在场，事后从别人口中听说有这么一个人来过。\n\n**被赶出去的人是谁**：一个和这家年轻人走得近的外人。他可能是被托付过的、被收养过的、来投奔过的，也可能是自己寻上门的。他的处境是：他在这世上没有别的地方可回。\n\n**为什么\"赶出去\"就够了**：这一家不必动手，也不必罚他。只要把他从这扇门里挪出去，他就什么都做不成了——他没有钱、没有名分、没有人替他说话。门里门外，只隔一步，走的路却是两样。\n\n**那个年轻人此刻在哪**：被关在屋里，或者被人看着，不许出去。他能做的只有听着。这一场里他一句话也没有，这正是这张卡的重量。\n\n**这是哪**：任何有\"门\"和\"外人\"的世界——宅门、宗门、公司宿舍、学校、帮派、家族。门可以是家法、可以是辞退、可以是调令、可以是断绝关系。\n\n**注意**：卡停在\"门在他面前关上\"这一刻。不要写他去了哪里，也不要写屋里那两个人后来还见不见。留在场上的是这件事：**有人被从这扇门里挪出去了，而他连今晚住哪里都还不知道。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个被赶出去的人，也可以是下令赶人的那一个，或者是屋里那个年轻人。三方都有得应对：走、留、还是把门再开一次。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是站在门外的那个人——你身上没有钱，也不知道今晚住哪里；可以是屋里的人，隔着一道墙听见自己的名字被念出来；可以是下令的人，你要决定门关不关；也可以不在场，事后从别人口中听说有这么一个人来过。"
      },
      {
        "key": "被赶出去的人是谁",
        "value": "一个和这家年轻人走得近的外人。他可能是被托付过的、被收养过的、来投奔过的，也可能是自己寻上门的。他的处境是：他在这世上没有别的地方可回。"
      },
      {
        "key": "为什么\"赶出去\"就够了",
        "value": "这一家不必动手，也不必罚他。只要把他从这扇门里挪出去，他就什么都做不成了——他没有钱、没有名分、没有人替他说话。门里门外，只隔一步，走的路却是两样。"
      },
      {
        "key": "那个年轻人此刻在哪",
        "value": "被关在屋里，或者被人看着，不许出去。他能做的只有听着。这一场里他一句话也没有，这正是这张卡的重量。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"门\"和\"外人\"的世界——宅门、宗门、公司宿舍、学校、帮派、家族。门可以是家法、可以是辞退、可以是调令、可以是断绝关系。"
      },
      {
        "key": "注意",
        "value": "卡停在\"门在他面前关上\"这一刻。不要写他去了哪里，也不要写屋里那两个人后来还见不见。留在场上的是这件事：**有人被从这扇门里挪出去了，而他连今晚住哪里都还不知道。**"
      }
    ]
  },
  {
    "id": "C16-07-失手",
    "number": "C16-07",
    "name": "失手",
    "type": "家法 / 收不住手",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-07-失手.md",
    "face": "家里的人把那个年轻人叫到跟前。他做的事，家里已经知道了。规矩是现成的：跪下，动手。\n\n动手的是他家里最亲的那个人。他打的时候一句话也没有，打完了，叫人把年轻人抬回屋里去。\n\n打完之后，他自己的病就上来了。他本来就有旧病，这一场气顶上来，三五天工夫，人就没了。\n\n那个年轻人本来病着。听说打他的那个人死了，他悔得说不出话来，添了新的病，从此卧床不起。\n\n两个人死在一处，前后不过十天。\n\n家里挂起白，门口挂起白。有人说这家出了事，也有人说是那孩子把老人气死的。没有一个人说：那一下是他自己动的手。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是动手的那个人，也可以是挨打的那个人，还可以是这家别的人——妻子的、兄弟的、管事的。谁站在这间屋里，谁就要接住这十天。\n\n**玩家在哪**：玩家可以就是动手的人，你得决定手停在什么地方；可以是挨打的人，你疼、你悔、你没有力气再开口；可以是旁边看着的人，你要决定拦不拦；也可以不在场，回来时家里已经挂着白，没有人肯把经过说全。\n\n**这两条命为什么连在一起**：不是报应，也不是天意。是：一个正在病里的老人受不了一场气；一个正在病里的年轻人受不了自己把老人气死了。这两样都是医书上写得下的东西。\n\n**为什么没有人说破**：因为说破了，这一家就得承认是自家人把自家人打死的。所以外头传的版本是\"那孩子把老人气死了\"，家里的人也愿意认这个版本。\n\n**代价在哪**：动手的人到死也没有跟那个年轻人说过一句话；那个年轻人到死都在悔这一件事。这一家里从此少了一个长辈、一个晚辈，多了一件谁都不提的事。\n\n**轻重**：这是这一回最重的一张。它不给\"该不该管\"留任何余地——管是对的，问题只出在那一下没有收住。所以不要演成\"管教\"和\"放纵\"之争。\n\n**这是哪**：任何有\"家法\"和\"管教\"的世界——家族、宗门、军队、学校、公司里的上下级。规矩可以是打、是关、是除名、是断供。\n\n**注意**：卡停在\"两个人死在一处\"这一刻。不要写这一家后来怎么对外说，也不要写那个年轻人最后有没有被救回来。留在场上的是这件事：**动手的人和挨打的人，一起没了。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是动手的那个人，也可以是挨打的那个人，还可以是这家别的人——妻子的、兄弟的、管事的。谁站在这间屋里，谁就要接住这十天。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是动手的人，你得决定手停在什么地方；可以是挨打的人，你疼、你悔、你没有力气再开口；可以是旁边看着的人，你要决定拦不拦；也可以不在场，回来时家里已经挂着白，没有人肯把经过说全。"
      },
      {
        "key": "这两条命为什么连在一起",
        "value": "不是报应，也不是天意。是：一个正在病里的老人受不了一场气；一个正在病里的年轻人受不了自己把老人气死了。这两样都是医书上写得下的东西。"
      },
      {
        "key": "为什么没有人说破",
        "value": "因为说破了，这一家就得承认是自家人把自家人打死的。所以外头传的版本是\"那孩子把老人气死了\"，家里的人也愿意认这个版本。"
      },
      {
        "key": "代价在哪",
        "value": "动手的人到死也没有跟那个年轻人说过一句话；那个年轻人到死都在悔这一件事。这一家里从此少了一个长辈、一个晚辈，多了一件谁都不提的事。"
      },
      {
        "key": "轻重",
        "value": "这是这一回最重的一张。它不给\"该不该管\"留任何余地——管是对的，问题只出在那一下没有收住。所以不要演成\"管教\"和\"放纵\"之争。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"家法\"和\"管教\"的世界——家族、宗门、军队、学校、公司里的上下级。规矩可以是打、是关、是除名、是断供。"
      },
      {
        "key": "注意",
        "value": "卡停在\"两个人死在一处\"这一刻。不要写这一家后来怎么对外说，也不要写那个年轻人最后有没有被救回来。留在场上的是这件事：**动手的人和挨打的人，一起没了。**"
      }
    ]
  },
  {
    "id": "C16-08-不许多耽搁",
    "number": "C16-08",
    "name": "不许多耽搁",
    "type": "探望 / 时限",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-08-不许多耽搁.md",
    "face": "一个人急急忙忙跑来报信，站在门外探头缩脑，不肯进来。他说：那个人不中用了。\n\n甲吓了一跳，问他什么时候的事。报信的人说不上来，只说刚才是那家的老家人特意来告诉的。\n\n甲转身进去回明家里的长辈。长辈吩咐：派妥当的人跟着去，到那里尽一尽同窗的情分就回来，不许多耽搁。\n\n甲忙着换衣裳出门。车还没有备好，他站在厅上乱转。车到了，他上车就走，跟去的人一路小跑。\n\n到了那家门口，悄无一人。甲一直走进内室，里头几个女眷和姐妹躲之不迭，乱成一团。\n\n床上的人已经换过了地方，躺得很低。他瘦得脱了形，闭着眼，胸口还有一口气，在枕上翻来覆去。\n\n甲叫了他两三声。他不应。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个非去不可的人——同窗、朋友、表亲、一起长大的、欠着他一句话的。甲得有一个理由：这个人对他有分量。\n\n**玩家在哪**：玩家可以就是甲，站在床边，被限着时间；可以是家里发话的长辈，你要决定派谁去、准多久；可以是跟去的人，你手里握着时辰；也可以是那个来报信的人，你只是传了一句实话。\n\n**\"不许多耽搁\"是什么意思**：家里的意思是：可以去看一眼，但不要沾上事。这一句把探望变成了一次限时的差事——去、看一眼、回来，不能留、不能问、不能答应什么。\n\n**为什么那家人躲之不迭**：因为这一家已经准备着了。人还没走，屋里的东西已经挪过、位置已经换过；来一个外人，就是要他们把这个准备摊开给人看。\n\n**那报信的人为什么不肯进来**：这种话不能当着人说。他站在门外，说的是一件已经定了的事。\n\n**这一场里没有一个人做错事**：长辈限了时间，是为了家里的事要紧；跟去的人一路小跑，是尽职；那家人挪了地方，是为了让病人少受一点罪。每个人都在做对的事，所以这件事推不动。\n\n**这是哪**：任何有\"病危\"和\"规矩\"的世界——宅门、病房、军营、宿舍、单位。探望可以是一次探视、一次通话、一次请假。\n\n**注意**：卡停在\"他不应\"这一刻。不要写甲待了多久、走没走，也不要写床上的人后来醒不醒。留在场上的是这件事：**人已经躺在床上不认人了，而你只能待一会儿。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个非去不可的人——同窗、朋友、表亲、一起长大的、欠着他一句话的。甲得有一个理由：这个人对他有分量。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，站在床边，被限着时间；可以是家里发话的长辈，你要决定派谁去、准多久；可以是跟去的人，你手里握着时辰；也可以是那个来报信的人，你只是传了一句实话。"
      },
      {
        "key": "\"不许多耽搁\"是什么意思",
        "value": "家里的意思是：可以去看一眼，但不要沾上事。这一句把探望变成了一次限时的差事——去、看一眼、回来，不能留、不能问、不能答应什么。"
      },
      {
        "key": "为什么那家人躲之不迭",
        "value": "因为这一家已经准备着了。人还没走，屋里的东西已经挪过、位置已经换过；来一个外人，就是要他们把这个准备摊开给人看。"
      },
      {
        "key": "那报信的人为什么不肯进来",
        "value": "这种话不能当着人说。他站在门外，说的是一件已经定了的事。"
      },
      {
        "key": "这一场里没有一个人做错事",
        "value": "长辈限了时间，是为了家里的事要紧；跟去的人一路小跑，是尽职；那家人挪了地方，是为了让病人少受一点罪。每个人都在做对的事，所以这件事推不动。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"病危\"和\"规矩\"的世界——宅门、病房、军营、宿舍、单位。探望可以是一次探视、一次通话、一次请假。"
      },
      {
        "key": "注意",
        "value": "卡停在\"他不应\"这一刻。不要写甲待了多久、走没走，也不要写床上的人后来醒不醒。留在场上的是这件事：**人已经躺在床上不认人了，而你只能待一会儿。**"
      }
    ]
  },
  {
    "id": "C16-09-第三次醒",
    "number": "C16-09",
    "name": "第三次醒",
    "type": "病重 / 守夜",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-09-第三次醒.md",
    "face": "这个人病了好些天了。起先是咳嗽、伤风、吃不下东西；后来挨了一顿打，又听说家里最亲的那个人没了，病就一天重过一天。\n\n这几天里，他昏过去两三次。请来看的人换了几个，药方也换了几张。屋里的人轮流守着，该备的东西悄悄备下了，谁也不提。\n\n这一天他又醒过来一次。眼睛睁着，看得到人，也听得见话。屋里的人一个个凑上去问：你要什么？你认得我么？\n\n他一个都不应。\n\n他只是攒着一口气，不肯松。有人替他把枕头垫高些，有人给他擦汗，有人站在门边不出声。谁都不知道他在等什么。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是守在这屋里的人——家里人、旧仆、同窗、医生，也可以是床上那个人自己。\n\n**玩家在哪**：玩家可以就是守在床边的人，你得决定叫不叫他等的那个名字；可以是床上的人，你只剩一口气，还惦记着两件事没有着落；可以不在场，事后听说他醒过、又不肯走。\n\n**\"昏过去两三次\"是什么意思**：这不是奇迹，是病重的人常有的反复。要紧的是屋里人的反应——有人开始备后事，有人还抱着指望，两拨人挤在一间屋子里。\n\n**\"不肯松\"是什么**：医书上没有这一条。他还有一口气，就是不咽。屋里的人看得出来他在等，但不知道等谁。这一件事没有道理可讲，也没有人能替他办。\n\n**屋里人为什么不说破**：说了，就等于替他把这件事定了。谁也不想当那个开口的人。\n\n**他惦记着什么**：两件没有着落的事——一件是家里往后怎么办，一件是那个被赶出去的人现在在哪里。这两件事都不在这间屋子里，所以他闭不上眼。\n\n**这是哪**：任何有\"病危\"和\"守夜\"的世界——宅门、病房、 hospice、战地救护所、宗门里的静室。只要有一屋子人在等一个人咽气，这张卡就成立。\n\n**注意**：卡停在\"谁都不知道他在等什么\"这一刻。不要写他等的人来没来，也不要写屋里人有没有猜出来。留在场上的是这件事：**人已经该走了，他不肯走，而屋里没有一个人知道为什么。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是守在这屋里的人——家里人、旧仆、同窗、医生，也可以是床上那个人自己。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是守在床边的人，你得决定叫不叫他等的那个名字；可以是床上的人，你只剩一口气，还惦记着两件事没有着落；可以不在场，事后听说他醒过、又不肯走。"
      },
      {
        "key": "\"昏过去两三次\"是什么意思",
        "value": "这不是奇迹，是病重的人常有的反复。要紧的是屋里人的反应——有人开始备后事，有人还抱着指望，两拨人挤在一间屋子里。"
      },
      {
        "key": "\"不肯松\"是什么",
        "value": "医书上没有这一条。他还有一口气，就是不咽。屋里的人看得出来他在等，但不知道等谁。这一件事没有道理可讲，也没有人能替他办。"
      },
      {
        "key": "屋里人为什么不说破",
        "value": "说了，就等于替他把这件事定了。谁也不想当那个开口的人。"
      },
      {
        "key": "他惦记着什么",
        "value": "两件没有着落的事——一件是家里往后怎么办，一件是那个被赶出去的人现在在哪里。这两件事都不在这间屋子里，所以他闭不上眼。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"病危\"和\"守夜\"的世界——宅门、病房、 hospice、战地救护所、宗门里的静室。只要有一屋子人在等一个人咽气，这张卡就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在\"谁都不知道他在等什么\"这一刻。不要写他等的人来没来，也不要写屋里人有没有猜出来。留在场上的是这件事：**人已经该走了，他不肯走，而屋里没有一个人知道为什么。**"
      }
    ]
  },
  {
    "id": "C16-11-拿过的东西",
    "number": "C16-11",
    "name": "拿过的东西",
    "type": "礼物 / 界限",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-11-拿过的东西.md",
    "face": "一个人刚回来，另一个人来看她。两个人说了一回话。\n\n临走的时候，他想起一件东西，珍重地取出来，双手递过去。他说：这是好东西，我一直收着，特意留给你的。\n\n那件东西在递的人手里，已经戴过、用过。\n\n她接过来，看了一眼，没有往身上比。她把它放回去，说了一句：这是别人拿过的东西，我不要。\n\n东西被还回来。递的人只得收回，把它放回原处，暂且无话。\n\n屋里还坐着别的人。这句话，在场的人都听见了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是递东西的那个人，也可以是那个不肯收的人，还可以是旁边坐着的人。三个人各有各的难处：递的人一片好意，不收的人有她的道理，旁边的人看着这一下怎么收场。\n\n**玩家在哪**：玩家可以就是递东西的人——你要不要再递一次，还是收回；可以是接东西的人，你一句话就把这份心意挡回去了；可以不在场，事后听说有一件东西被退回来了。\n\n**那件东西是什么**：一件首饰、一块佩、一串珠子、一件旧物。要紧的不是它值多少，是**它先经了别人的手**。这一点，才是她不肯收的理由。\n\n**她为什么不肯收**：她刚从很远的地方回来，刚办完自己父亲的丧事。那件东西是别处转来的、是别人戴过的、是这家里正在走运的人随手给出来的。她不想沾。这个理由，卡里不说破，留给桌上的人自己填。\n\n**为什么这句话是重的**：它不是在挑东西，是在划一条线——**什么是我可以拿的，什么不是**。这一句话出口，两个人往后的来往就有了分寸。旁边坐着的人都听见了，所以这条线也是当众划下的。\n\n**代价在哪**：递的人当着人把东西收了回去。这一下，他往后给她什么东西，都要先想一想。\n\n**这是哪**：任何有\"礼物\"和\"界限\"的世界——亲戚之间、同门之间、同事之间、两个家族之间。东西可以是礼物、好意、人情、一次提拔。\n\n**注意**：卡停在\"暂且无话\"这一刻。不要写她心里怎么想，也不要写他往后还送不送。留在场上的是这件事：**一件东西递出去，又被退了回来，两个人都没有把话说明。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是递东西的那个人，也可以是那个不肯收的人，还可以是旁边坐着的人。三个人各有各的难处：递的人一片好意，不收的人有她的道理，旁边的人看着这一下怎么收场。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是递东西的人——你要不要再递一次，还是收回；可以是接东西的人，你一句话就把这份心意挡回去了；可以不在场，事后听说有一件东西被退回来了。"
      },
      {
        "key": "那件东西是什么",
        "value": "一件首饰、一块佩、一串珠子、一件旧物。要紧的不是它值多少，是**它先经了别人的手**。这一点，才是她不肯收的理由。"
      },
      {
        "key": "她为什么不肯收",
        "value": "她刚从很远的地方回来，刚办完自己父亲的丧事。那件东西是别处转来的、是别人戴过的、是这家里正在走运的人随手给出来的。她不想沾。这个理由，卡里不说破，留给桌上的人自己填。"
      },
      {
        "key": "为什么这句话是重的",
        "value": "它不是在挑东西，是在划一条线——**什么是我可以拿的，什么不是**。这一句话出口，两个人往后的来往就有了分寸。旁边坐着的人都听见了，所以这条线也是当众划下的。"
      },
      {
        "key": "代价在哪",
        "value": "递的人当着人把东西收了回去。这一下，他往后给她什么东西，都要先想一想。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"礼物\"和\"界限\"的世界——亲戚之间、同门之间、同事之间、两个家族之间。东西可以是礼物、好意、人情、一次提拔。"
      },
      {
        "key": "注意",
        "value": "卡停在\"暂且无话\"这一刻。不要写她心里怎么想，也不要写他往后还送不送。留在场上的是这件事：**一件东西递出去，又被退了回来，两个人都没有把话说明。**"
      }
    ]
  },
  {
    "id": "C16-12-回到这里",
    "number": "C16-12",
    "name": "回到这里",
    "type": "寄居 / 位子",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十六回",
    "rel": "红楼梦/现实类/第十六回/C16-12-回到这里.md",
    "face": "一个人走了很远的路，今天回来了。她这一趟是去送一个人下葬的。丧事办完了，她从那边动身，赶在年前回到这里。\n\n这一家刚办完喜事，门上还挂着红。\n\n她进府，先见过长辈，一一见过屋里的人。众人看她，都说她比先前出落得好了，也比先前瘦。\n\n她的屋子早就收拾出来了：东西摆得整整齐齐，用的人也都配齐了。她带回来的箱子一只只打开，里头多是书、纸笔、墨。她一样一样往外分：给这位的、给那位的、给小的、给亲戚家的。分完了，她自己那点东西，反倒没有地方摆。\n\n全屋的人都在看她。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是回来的人，也可以是这一家里做主的人——安排屋子、分派人手的那一个，还可以是站在旁边看她分东西的人。\n\n**玩家在哪**：玩家可以就是她，站在满屋子人中间，把箱子一件件打开；可以是当家的，你得决定给她哪间屋子、派谁伺候、按什么位分待她；可以不在场，回来时听说家里住进来一个人，人人都说她好。\n\n**她为什么只能回这里**：她在那边没有产业，也没有人替她做主；这一边是她母亲娘家的门，是她唯一还有位置的地方。这不是投奔，是回自己的门——可这个门里，已经重新排过一遍了。\n\n**\"门上还挂着红\"是什么意思**：这一家正在喜里。她的丧不能摆出来，也不该摆出来。她只能自己把这件事收着，收着还要替人高兴。\n\n**为什么是书和纸笔**：她带回来的不是钱，也不是首饰。这是她在那几年里做过的唯一一件事，也是她要在这家里重新认下的那一点东西。\n\n**\"分完了没有地方摆\"是什么意思**：她把自己的东西都分了出去，等于当众说明：我在这里不占地方。这句话不必说出口，做出来就够了。\n\n**代价在哪**：从今天起，她吃的、住的、用的，都是这一家的。她得学会怎么在这里不添麻烦——这是后面每一张卡的底子。\n\n**这是哪**：任何有\"寄居\"和\"位分\"的世界——大家族、亲戚家、宗门、宿舍、寄宿学校、被收留的人。\n\n**注意**：卡停在\"全屋的人都在看她\"这一刻。不要写她住得惯不惯，也不要写这家里的人待她好不好。留在场上的是这件事：**她回来了，带着一身丧气，站在一屋子的喜气里。**",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是回来的人，也可以是这一家里做主的人——安排屋子、分派人手的那一个，还可以是站在旁边看她分东西的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是她，站在满屋子人中间，把箱子一件件打开；可以是当家的，你得决定给她哪间屋子、派谁伺候、按什么位分待她；可以不在场，回来时听说家里住进来一个人，人人都说她好。"
      },
      {
        "key": "她为什么只能回这里",
        "value": "她在那边没有产业，也没有人替她做主；这一边是她母亲娘家的门，是她唯一还有位置的地方。这不是投奔，是回自己的门——可这个门里，已经重新排过一遍了。"
      },
      {
        "key": "\"门上还挂着红\"是什么意思",
        "value": "这一家正在喜里。她的丧不能摆出来，也不该摆出来。她只能自己把这件事收着，收着还要替人高兴。"
      },
      {
        "key": "为什么是书和纸笔",
        "value": "她带回来的不是钱，也不是首饰。这是她在那几年里做过的唯一一件事，也是她要在这家里重新认下的那一点东西。"
      },
      {
        "key": "\"分完了没有地方摆\"是什么意思",
        "value": "她把自己的东西都分了出去，等于当众说明：我在这里不占地方。这句话不必说出口，做出来就够了。"
      },
      {
        "key": "代价在哪",
        "value": "从今天起，她吃的、住的、用的，都是这一家的。她得学会怎么在这里不添麻烦——这是后面每一张卡的底子。"
      },
      {
        "key": "这是哪",
        "value": "任何有\"寄居\"和\"位分\"的世界——大家族、亲戚家、宗门、宿舍、寄宿学校、被收留的人。"
      },
      {
        "key": "注意",
        "value": "卡停在\"全屋的人都在看她\"这一刻。不要写她住得惯不惯，也不要写这家里的人待她好不好。留在场上的是这件事：**她回来了，带着一身丧气，站在一屋子的喜气里。**"
      }
    ]
  },
  {
    "id": "C17-01-叫他过来",
    "number": "C17-01",
    "name": "叫他过来",
    "type": "当众考 / 展示",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-01-叫他过来.md",
    "face": "一处刚收拾好的地方，花木、墙、路都是新起的。管事的人来请甲去看，说有几处地方还空着，要请甲拿个主意。\n\n甲看了一遍，说：有几处得让人看一眼，才能有个说法。\n\n一起去的还有几个客。他们的儿子，一个也不在跟前。\n\n甲忽然想起自己家的那个。这孩子念书不用心，闲话上倒是被人夸过两句。\n\n甲就说：叫他过来。\n\n有人小跑着去了。不多一会儿，那孩子被带到众人面前，站在甲身后半步的地方，不知道叫自己来是做什么。\n\n来的人都在看。看这家的长辈，拿出一套什么脸色。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这一家的长辈，手里有这个新地方，也有“叫谁来看”的资格。甲平时不管这孩子的事，此刻要管，是因为这处地方非有字不可，而现成的人都试过了，甲一个也不满意。\n\n**玩家在哪**：玩家可以是那个被叫来的孩子——站在半步之外，不知道为什么叫自己来；可以是那一群客里的一个，看着这家的长辈怎么当众管自己的孩子；可以是跑腿去叫人的那个，只照吩咐办事；也可以不在场，事后只听说“那天老爷把少爷叫进园子里去了”。若玩家就是那个孩子，卡的重点变成“你被推到人前，还没人告诉你为什么”。\n\n**那个孩子是谁**：他不必是甲亲生的——甲的儿女、侄子、收养的孩子、徒弟、托在膝下养的一个晚辈，都可以。关键只有一条：甲平时对他没多少指望，可有人夸过他。\n\n**那群客是谁**：有交情、有见识、将来会把今天这一场说出去的人。他们不能是摆设——他们得是那些“甲愿意让他们看看”的人。\n\n**甲为什么挑这个时候**：这处地方要用了。字要有人写，名要有人定，甲自己不肯写，现成的人又不合用。\n\n**代价**：叫了，甲就把自家的名声押在这孩子身上；孩子当众出丑，众人只会替甲难堪，那一圈笑话日后都归在甲头上。不叫，甲回去交不出任何东西，也堵不住那些说这孩子将来不成的闲话。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。“新收拾好的地方”可以是园子、宅子、铺子、公司、展厅、舰队；但“有一群人在旁边看着”这一层必须留着。\n\n**注意**：卡停在“来的人都在看，长辈拿出了一套脸色”这一刻。不要写这孩子答得好不好，也不要写甲叫他是为了抬他还是压他。这一场从甲开口起就收不回去了：往后孩子做的任何一件事，都会被挂到这一场上来讲。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这一家的长辈，手里有这个新地方，也有“叫谁来看”的资格。甲平时不管这孩子的事，此刻要管，是因为这处地方非有字不可，而现成的人都试过了，甲一个也不满意。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个被叫来的孩子——站在半步之外，不知道为什么叫自己来；可以是那一群客里的一个，看着这家的长辈怎么当众管自己的孩子；可以是跑腿去叫人的那个，只照吩咐办事；也可以不在场，事后只听说“那天老爷把少爷叫进园子里去了”。若玩家就是那个孩子，卡的重点变成“你被推到人前，还没人告诉你为什么”。"
      },
      {
        "key": "那个孩子是谁",
        "value": "他不必是甲亲生的——甲的儿女、侄子、收养的孩子、徒弟、托在膝下养的一个晚辈，都可以。关键只有一条：甲平时对他没多少指望，可有人夸过他。"
      },
      {
        "key": "那群客是谁",
        "value": "有交情、有见识、将来会把今天这一场说出去的人。他们不能是摆设——他们得是那些“甲愿意让他们看看”的人。"
      },
      {
        "key": "甲为什么挑这个时候",
        "value": "这处地方要用了。字要有人写，名要有人定，甲自己不肯写，现成的人又不合用。"
      },
      {
        "key": "代价",
        "value": "叫了，甲就把自家的名声押在这孩子身上；孩子当众出丑，众人只会替甲难堪，那一圈笑话日后都归在甲头上。不叫，甲回去交不出任何东西，也堵不住那些说这孩子将来不成的闲话。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。“新收拾好的地方”可以是园子、宅子、铺子、公司、展厅、舰队；但“有一群人在旁边看着”这一层必须留着。"
      },
      {
        "key": "注意",
        "value": "卡停在“来的人都在看，长辈拿出了一套脸色”这一刻。不要写这孩子答得好不好，也不要写甲叫他是为了抬他还是压他。这一场从甲开口起就收不回去了：往后孩子做的任何一件事，都会被挂到这一场上来讲。\n---"
      }
    ]
  },
  {
    "id": "C17-02-借古人",
    "number": "C17-02",
    "name": "借古人",
    "type": "陪考 / 让位",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-02-借古人.md",
    "face": "一行人走到第一处要留字的地方。那地方正对着来路，头一眼就看见，绕不过去。\n\n甲先问众人：这里写什么好。\n\n众人早就等着这一问。他们一口气报了一长串听着很响的说法，一个比一个漂亮，却没有一个真说到那处地方。\n\n他们知道甲要试的是谁。所以他们说的全是不真不假的话。\n\n甲听完了，一个也不要。他回头去叫那个跟来的孩子。\n\n那孩子也说了一句话，说与其自己编新的，不如用古人现成的话，写在这儿倒也大方。\n\n众人立刻齐声叫好，叫得比刚才大声，把刚才那些主意一句不提。\n\n甲笑了一下，也说了孩子一句。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是出题的人，也是这一家里说话能算的人。他起头问一句，底下的人就得报；他摇头，底下的人就得换。\n\n**玩家在哪**：玩家可以是那一群客里的一个——你知道这一场是给谁的，你得决定自己让不让；可以是那个被叫来的孩子，站在旁边听着一串漂亮话；可以是端茶送水的，站在外圈听完全场；也可以不在场，事后从别人口中听说“今天几位老先生说了什么，老爷一个也没用”。\n\n**那群客为什么说差话**：他们吃这一家的饭。主家要试自家孩子，你若真报一个绝的，就是把主家和你自己一起架在火上；你说差的，主家高兴，孩子有台阶，人人都有面子。\n\n**那个孩子说的这句话分量在哪**：他不是答得更漂亮，他是换了个法子——把标准从“谁编得好”挪到“用现成的就行”。这一挪，众人刚才报的那些就都不必比了。\n\n**代价**：众客这一场把自己的名声打了折——孩子真说了好的，他们的“差”被反衬得更差；孩子说不出，他们更亏，陪了半天，谁也没落着东西。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。园子、评审会、招标现场、宗族议事，只要有“主家出题、陪客答话”这一层，就成立。\n\n**注意**：卡停在“众人齐声叫好，甲也说了孩子一句”这一刻。不要写甲心里信不信这句话，也不要写众客是不是真的服。让路的这一场，从这一句话起，后头的事就都带着它的影子。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是出题的人，也是这一家里说话能算的人。他起头问一句，底下的人就得报；他摇头，底下的人就得换。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那一群客里的一个——你知道这一场是给谁的，你得决定自己让不让；可以是那个被叫来的孩子，站在旁边听着一串漂亮话；可以是端茶送水的，站在外圈听完全场；也可以不在场，事后从别人口中听说“今天几位老先生说了什么，老爷一个也没用”。"
      },
      {
        "key": "那群客为什么说差话",
        "value": "他们吃这一家的饭。主家要试自家孩子，你若真报一个绝的，就是把主家和你自己一起架在火上；你说差的，主家高兴，孩子有台阶，人人都有面子。"
      },
      {
        "key": "那个孩子说的这句话分量在哪",
        "value": "他不是答得更漂亮，他是换了个法子——把标准从“谁编得好”挪到“用现成的就行”。这一挪，众人刚才报的那些就都不必比了。"
      },
      {
        "key": "代价",
        "value": "众客这一场把自己的名声打了折——孩子真说了好的，他们的“差”被反衬得更差；孩子说不出，他们更亏，陪了半天，谁也没落着东西。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。园子、评审会、招标现场、宗族议事，只要有“主家出题、陪客答话”这一层，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“众人齐声叫好，甲也说了孩子一句”这一刻。不要写甲心里信不信这句话，也不要写众客是不是真的服。让路的这一场，从这一句话起，后头的事就都带着它的影子。\n---"
      }
    ]
  },
  {
    "id": "C17-03-都似不妥",
    "number": "C17-03",
    "name": "都似不妥",
    "type": "当众驳 / 得罪",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-03-都似不妥.md",
    "face": "走到第二处地方，众人报了两个现成的说法。\n\n甲说：俗。又报了两个，甲说：也俗。\n\n甲于是回头问那个跟来的孩子：你说，他们说的有没有能用的？\n\n那孩子想也没想，就说了一句：都不妥当。\n\n先前出主意的人都不说话了。他们脸上没变，只是把眼睛挪开。\n\n甲冷笑了一声，问他：怎么不妥当？\n\n那孩子就说下去了，一条一条，说得也还成理。他一个也没有留下，连那两个“俗”字都替甲省了。\n\n众人在旁边说：妙。说得比刚才还响。\n\n甲把话说成了一半，说这孩子狂，说这一回且容他。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是问话的人。他要的就是这个答案——他先当众把众人的话驳了两个“俗”，再把话头递给孩子。孩子怎么答，甲都得接着。\n\n**玩家在哪**：玩家可以是那个被问的孩子——你说这句话的时候，满屋子人都在等你；可以是出主意的客人里那一个，你的话被一句“都不妥当”扫了；可以是站在外圈听见这一句的下人；也可以不在场，事后听说“今天少爷把几位老先生都驳了”。若玩家就是那个孩子，这一句说出去，往后这屋里一半人不会再替你说话。\n\n**那个孩子有才没才**：卡里不判。他驳得成不成理，由桌上的人说；卡只写他说了，和他说了以后各人怎么办。\n\n**众客为什么当场不说话**：他们不是被驳倒了，是被驳了面子。他们的反应是“把眼睛挪开”，不是吵起来。\n\n**选择**：由孩子做——说“有一句能用的”，还是说“都不妥当”。说“有一句能用的”，是做人，也是给自己留台阶；说“都不妥当”，是让所有人都得重新站一次。甲再逼一遍，他还可以改口。\n\n**代价**：说“都不妥当”，众人的面子当场落在地上；往后这屋子里推举什么人、替谁说话，都会先想起这一句。这句换来的是“他看不起人”，换来的是“他有本事”——两样都是真的。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。匾对、评审会、提案会、辩论场、长老议事——只要有“一个人当众否掉所有人”的位置，就成立。\n\n**注意**：卡停在“甲说这孩子狂，这一回且容他”这一刻。不要写这句驳得对不对，也不要写众客日后怎么算这笔账——账已经记下了，什么时候翻出来是后面的事。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是问话的人。他要的就是这个答案——他先当众把众人的话驳了两个“俗”，再把话头递给孩子。孩子怎么答，甲都得接着。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个被问的孩子——你说这句话的时候，满屋子人都在等你；可以是出主意的客人里那一个，你的话被一句“都不妥当”扫了；可以是站在外圈听见这一句的下人；也可以不在场，事后听说“今天少爷把几位老先生都驳了”。若玩家就是那个孩子，这一句说出去，往后这屋里一半人不会再替你说话。"
      },
      {
        "key": "那个孩子有才没才",
        "value": "卡里不判。他驳得成不成理，由桌上的人说；卡只写他说了，和他说了以后各人怎么办。"
      },
      {
        "key": "众客为什么当场不说话",
        "value": "他们不是被驳倒了，是被驳了面子。他们的反应是“把眼睛挪开”，不是吵起来。"
      },
      {
        "key": "选择",
        "value": "由孩子做——说“有一句能用的”，还是说“都不妥当”。说“有一句能用的”，是做人，也是给自己留台阶；说“都不妥当”，是让所有人都得重新站一次。甲再逼一遍，他还可以改口。"
      },
      {
        "key": "代价",
        "value": "说“都不妥当”，众人的面子当场落在地上；往后这屋子里推举什么人、替谁说话，都会先想起这一句。这句换来的是“他看不起人”，换来的是“他有本事”——两样都是真的。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。匾对、评审会、提案会、辩论场、长老议事——只要有“一个人当众否掉所有人”的位置，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲说这孩子狂，这一回且容他”这一刻。不要写这句驳得对不对，也不要写众客日后怎么算这笔账——账已经记下了，什么时候翻出来是后面的事。\n---"
      }
    ]
  },
  {
    "id": "C17-04-天然",
    "number": "C17-04",
    "name": "天然",
    "type": "说真话 / 被赶",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-04-天然.md",
    "face": "走到一处照着乡下样子修的地方。土墙、草顶、篱笆、一口井，田里的菜一行一行，长得齐整。\n\n甲一进去就说好，说这地方勾起了他的心思，说人辛苦半生，倒不如这样过日子。\n\n甲回头问那个跟来的孩子：你看这里如何？\n\n旁边的人都在推他，小声教他说：说好，说好就是了。\n\n那孩子没有听。他说：不如刚才那处。\n\n甲的脸沉下来了，说他一味只认富贵，不懂这样的清静，终究是不读书的缘故。\n\n那孩子站住，反问了一句：古时候说的“天然”，到底是什么意思？\n\n旁边的人忙替他解释：天然就是自己长成的，不是人做出来的。\n\n那孩子就接着说：那这一处田庄，分明是人做出来的。远没有村子，近不挨城，背后没有山，前面没有水，是硬生生搁在这儿的。\n\n他没有说完。甲喝了一声，叫他出去。\n\n他刚退到门口，甲又喝了一声：回来。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这一家的长辈，也是这处地方的主人。他不是不许人说真话——他自己刚说完“这地方好，勾起我的心思”，所以这一句反驳才格外疼：被驳的不是一句话，是他自己刚花了心思也刚夸过的地方。\n\n**玩家在哪**：玩家可以是那个被推着说话的孩子——旁边的人按着你的袖子教你答，你答不答这个“好”；可以是那一群客里的一个，你知道该推他，也知道推不动；可以是站在门外听这一声“出去”“回来”的下人；也可以不在场，事后听说“今天少爷说了句什么，老爷把他赶出来了，又叫回去了”。若玩家就是那个孩子，卡的重点变成“明知道说出口要挨这一声，你还说不说”。\n\n**那一句真话有多重**：他说“不如刚才那处”，等于当众把甲的眼光按了下去；他再把“天然”两个字拿来做题目，就是把甲刚说的话拆开给人看。这不是抬杠，是把“这是假的”说出口了。\n\n**选择**：由孩子做——顺着众人的推，说一个好字；还是把“这是假的”说出口。第二个岔路是甲的：喝出去就完了，还是像这样叫回来。\n\n**代价**：说真话，甲当众被驳在自己出钱修的地方上，这一口气没处放；孩子落一个“说得出真话、留不住嘴”的名声，也从此知道在这个人面前真话能说到哪一步。说好，这一场就过去了，可这屋里从此多了一条不能说的话。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。新修的园子、装修好的会所、仿古的宅子、宣传片里的外景、用术法堆出来的道场——只要“这地方是造的，有人要当它是真的”这一层在，就成立。\n\n**注意**：卡停在“他退到门口，甲又叫了一声回来”这一刻。不要写他有没有把话说完，不要写甲后面罚没罚他。“出去”和“回来”这两声，就是这一场最重的地方——赶他走，是还要用他；叫他回来，是还要罚他。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这一家的长辈，也是这处地方的主人。他不是不许人说真话——他自己刚说完“这地方好，勾起我的心思”，所以这一句反驳才格外疼：被驳的不是一句话，是他自己刚花了心思也刚夸过的地方。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个被推着说话的孩子——旁边的人按着你的袖子教你答，你答不答这个“好”；可以是那一群客里的一个，你知道该推他，也知道推不动；可以是站在门外听这一声“出去”“回来”的下人；也可以不在场，事后听说“今天少爷说了句什么，老爷把他赶出来了，又叫回去了”。若玩家就是那个孩子，卡的重点变成“明知道说出口要挨这一声，你还说不说”。"
      },
      {
        "key": "那一句真话有多重",
        "value": "他说“不如刚才那处”，等于当众把甲的眼光按了下去；他再把“天然”两个字拿来做题目，就是把甲刚说的话拆开给人看。这不是抬杠，是把“这是假的”说出口了。"
      },
      {
        "key": "选择",
        "value": "由孩子做——顺着众人的推，说一个好字；还是把“这是假的”说出口。第二个岔路是甲的：喝出去就完了，还是像这样叫回来。"
      },
      {
        "key": "代价",
        "value": "说真话，甲当众被驳在自己出钱修的地方上，这一口气没处放；孩子落一个“说得出真话、留不住嘴”的名声，也从此知道在这个人面前真话能说到哪一步。说好，这一场就过去了，可这屋里从此多了一条不能说的话。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。新修的园子、装修好的会所、仿古的宅子、宣传片里的外景、用术法堆出来的道场——只要“这地方是造的，有人要当它是真的”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“他退到门口，甲又叫了一声回来”这一刻。不要写他有没有把话说完，不要写甲后面罚没罚他。“出去”和“回来”这两声，就是这一场最重的地方——赶他走，是还要用他；叫他回来，是还要罚他。\n---"
      }
    ]
  },
  {
    "id": "C17-05-题不出来",
    "number": "C17-05",
    "name": "题不出来",
    "type": "卡住 / 限期",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-05-题不出来.md",
    "face": "走到一处最要紧的地方。石头门楼，龙盘在上面，四面全是雕出来的花纹，在这一整片地方的正中间。\n\n这是第一要紧的地方，将来什么人来了，都从这里过。\n\n甲问众人：这里该写什么？\n\n众人说了一串好话，说这地方非比寻常，该用最响的话来配它。\n\n甲摇了摇头，没有说话。\n\n甲回头，叫了一声那个跟来的孩子。\n\n那孩子站在门楼下，仰着头看，看了很久。他没有在听甲问什么，也没有在听旁人说。\n\n他记得自己来过这里。一定是来过的。可他想不起来，是哪一年，哪一天，跟谁一起来的。\n\n甲又叫了一遍。\n\n那孩子还是没有开口。\n\n众人忙替他说话，说这半天下来，人也乏了，词也使尽了，明日再写也罢。\n\n甲冷笑了一声，说：也罢，限你一日。明日写不出来，定不饶你。这是第一要紧的地方，好生写。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是出题的人，也是这一家里最看重这处地方的人。他一路试下来，到这里已经不光是想看孩子有没有本事——他还要看这孩子在这处最要紧的地方端不端得住。\n\n**玩家在哪**：玩家可以是那个被问的孩子——你站在门楼底下，仰着头，脑子里过的是别的什么东西；可以是那一群客里的一个，你替他挡了一句，你也不知道他怎么了；可以是外头等着的人，只听说今天在最要紧那处没写出字来；也可以不在场，事后听说“老爷限了他一日”。\n\n**那张限期是什么**：它不解决任何事，只把这一场挂到明天。今天在这里没说的话，明天还得当众说一遍。\n\n**那个孩子为什么站着不说话**：卡里不解释。你可以把它演成一时发晕、想起旧事、心里有别的事，或者他就是不肯在这处地方随便写一句。要给桌上一个能演的东西，就用一句“他记得自己来过这里”；要怎么算，是桌上的事。\n\n**选择**：由孩子做——硬写一句交上去，还是认下“现在写不出来”。第二个岔路是甲的：限一日，还是当场逼、逼不出来就罚。\n\n**代价**：认下写不出来，孩子在所有人面前第一次有了“不会”的东西，这一屋人往后说起他，会有一个现成的例子；他也保住了那处地方，没在上面留下一句自己都不认的话。甲限这一日，是把一件东西挂在孩子头上：明日写出来，又是当众；写不出来，甲说过“定不饶你”。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。正殿牌坊、城标、舰徽、开幕词、一句谁都得听的口号——只要“这东西最要紧，非得他说”这一层在，就成立。\n\n**注意**：卡停在“限你一日，这是第一要紧的地方，好生写”这一刻。不要写他明天到底写出来没有，也不要解释他为什么觉得自己来过这里。这一张给桌上留下的，是一个悬着的日子。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是出题的人，也是这一家里最看重这处地方的人。他一路试下来，到这里已经不光是想看孩子有没有本事——他还要看这孩子在这处最要紧的地方端不端得住。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个被问的孩子——你站在门楼底下，仰着头，脑子里过的是别的什么东西；可以是那一群客里的一个，你替他挡了一句，你也不知道他怎么了；可以是外头等着的人，只听说今天在最要紧那处没写出字来；也可以不在场，事后听说“老爷限了他一日”。"
      },
      {
        "key": "那张限期是什么",
        "value": "它不解决任何事，只把这一场挂到明天。今天在这里没说的话，明天还得当众说一遍。"
      },
      {
        "key": "那个孩子为什么站着不说话",
        "value": "卡里不解释。你可以把它演成一时发晕、想起旧事、心里有别的事，或者他就是不肯在这处地方随便写一句。要给桌上一个能演的东西，就用一句“他记得自己来过这里”；要怎么算，是桌上的事。"
      },
      {
        "key": "选择",
        "value": "由孩子做——硬写一句交上去，还是认下“现在写不出来”。第二个岔路是甲的：限一日，还是当场逼、逼不出来就罚。"
      },
      {
        "key": "代价",
        "value": "认下写不出来，孩子在所有人面前第一次有了“不会”的东西，这一屋人往后说起他，会有一个现成的例子；他也保住了那处地方，没在上面留下一句自己都不认的话。甲限这一日，是把一件东西挂在孩子头上：明日写出来，又是当众；写不出来，甲说过“定不饶你”。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。正殿牌坊、城标、舰徽、开幕词、一句谁都得听的口号——只要“这东西最要紧，非得他说”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“限你一日，这是第一要紧的地方，好生写”这一刻。不要写他明天到底写出来没有，也不要解释他为什么觉得自己来过这里。这一张给桌上留下的，是一个悬着的日子。\n---"
      }
    ]
  },
  {
    "id": "C17-06-一样的脸",
    "number": "C17-06",
    "name": "一样的脸",
    "type": "迷路 / 认不出",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-06-一样的脸.md",
    "face": "那一处屋子，人一进去就分不清东南西北。\n\n四面全是雕花的板，一会儿是窗，一会儿是门，一会儿又成了一架书；往前一步，有一扇窗挡住了去路；退一步，又有别的门开着。\n\n甲往里走，走了两层，就迷了路。\n\n左边看有门能通，右边看有窗隔着；走到跟前，被一架书挡住；回过头，窗纱又透出门径来。\n\n身边的人都不在跟前了。甲也没有开口叫。\n\n甲走到一扇门前，迎面也有一个人走过来，穿的衣服、走路的架子，都和他自己一样。\n\n甲站住了。\n\n那不是人。那是一面极大的镜子。\n\n甲站着，没有动。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是走进去的那个人，也是这处地方的主人。这屋子是他叫人修的，他以为自己熟。\n\n**玩家在哪**：玩家可以是甲——你走进去，走迷了，前头还有一个和你一模一样的人迎着你走过来；可以是跟在后面的一个下人，你站在外圈，眼看着主家在里面转了两圈，不敢叫他；可以是那个知道路的人，众人都等着你开口；也可以不在场，事后听说“老爷在那间屋子里转了半天才出来”。\n\n**那一面镜子照出了什么**：只照出一件事——这屋子不是给人住的，是给人迷路用的。甲自己出钱修的屋子，把他自己也绕进去了。\n\n**选择**：由甲做——站着，还是开口叫人；上前一步看清那张脸，还是转身再找一条路。若玩家占的是后面那个下人的槽，选择就变成“叫不叫住他”：叫了是提醒主家迷路了，不叫就让他自己转出来。\n\n**代价**：开口叫人，等于当众承认自己在这间屋子里不认得路；再转，就得在这间屋子里继续转下去。站着不动的时间越长，外头的人越会往坏处想。\n\n**这是一张喘气的卡**：它不制造冲突，也不留下什么账。它的用处是让人在这处地方站一会儿——这整片地方不是给人住的，是给人看和给人跪的，谁进来都一样。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。迷宫似的宅子、样板间、镜面装置、玻璃幕墙、幻阵——只要“这地方是照着让人迷路的样子修的”这一层在，就成立。\n\n**注意**：卡停在“甲站着，没有动”这一刻。不要写这面镜子有灵性，也不要写甲在镜子前想起了什么。它就是一面做得太大的镜子。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是走进去的那个人，也是这处地方的主人。这屋子是他叫人修的，他以为自己熟。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲——你走进去，走迷了，前头还有一个和你一模一样的人迎着你走过来；可以是跟在后面的一个下人，你站在外圈，眼看着主家在里面转了两圈，不敢叫他；可以是那个知道路的人，众人都等着你开口；也可以不在场，事后听说“老爷在那间屋子里转了半天才出来”。"
      },
      {
        "key": "那一面镜子照出了什么",
        "value": "只照出一件事——这屋子不是给人住的，是给人迷路用的。甲自己出钱修的屋子，把他自己也绕进去了。"
      },
      {
        "key": "选择",
        "value": "由甲做——站着，还是开口叫人；上前一步看清那张脸，还是转身再找一条路。若玩家占的是后面那个下人的槽，选择就变成“叫不叫住他”：叫了是提醒主家迷路了，不叫就让他自己转出来。"
      },
      {
        "key": "代价",
        "value": "开口叫人，等于当众承认自己在这间屋子里不认得路；再转，就得在这间屋子里继续转下去。站着不动的时间越长，外头的人越会往坏处想。"
      },
      {
        "key": "这是一张喘气的卡",
        "value": "它不制造冲突，也不留下什么账。它的用处是让人在这处地方站一会儿——这整片地方不是给人住的，是给人看和给人跪的，谁进来都一样。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。迷宫似的宅子、样板间、镜面装置、玻璃幕墙、幻阵——只要“这地方是照着让人迷路的样子修的”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲站着，没有动”这一刻。不要写这面镜子有灵性，也不要写甲在镜子前想起了什么。它就是一面做得太大的镜子。\n---"
      }
    ]
  },
  {
    "id": "C17-07-一件件对",
    "number": "C17-07",
    "name": "一件件对",
    "type": "当众对账 / 不齐",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-07-一件件对.md",
    "face": "走到一处屋子前面，甲忽然站住了。\n\n甲问管事的人：屋子、家什都有了，那些帐子、帘子、桌上铺的、床上罩的，可都配齐了？\n\n管事的人回话说：家什早添了许多，到日子自然现摆。帐幔帘子那一头，是另一个人管的；听说还不全。\n\n甲就不走了。甲叫人把那个管事的叫来。\n\n人来了，甲问：一共几样？到了几样？还欠几样？\n\n那个人不慌不忙，从身上摸出一张单子来，展开，看了一遍，一样一样报。\n\n报到中间，甲不说话了。报到末尾，那个人自己也慢了下来，说：秋天都全。\n\n甲没有再问。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是验收的人，也是这一家的长辈。他一路看下来都还满意，到这一处忽然想起东西不齐——他不是要挑毛病，是这处地方再过些日子就要用了。\n\n**玩家在哪**：玩家可以是那个被叫来对账的人——你身上就揣着那张单子，主家当众问你三个数；可以是先被问的那个管事的人，你把话推给了别人；可以是跟着走的下人，站在外圈看这一场；也可以不在场，事后听说“那天老爷问了几样东西齐不齐”。若玩家就是那个对账的人，卡的重点变成“你自己写下的那张单子，你照着报，还是先把总数说圆”。\n\n**那个“秋天”是什么**：那个人自己说出来的期限。他不是被逼的，是自己给自己定了日子——这一句话一出口，就归他自己了。\n\n**选择**：由那个对账的人做——照单实报，还是先把总数说圆。第二个岔路是甲的：问到底，还是就此放过。\n\n**代价**：实报，他当众把“还欠”两个字交到甲手里，这一摊不齐的责任从此有一半记在他名下，也等于替自己定了一个期限；说圆，这一场过得去，日后各处逐一核对，一件件都要翻回到今天这张单子上。甲放过，就是自己也认了“先凑合着办”。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。验收新宅、交付前的例会、开业前查库存、神殿落成点法器——只要“有一张单子，当众报，报不完”这一层在，就成立。\n\n**注意**：卡停在“秋天都全，甲没有再问”这一刻。不要写那些东西是什么、值多少；也不要写秋天到底齐了没有。这一张给桌上留下的，是一个悬着的秋天。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是验收的人，也是这一家的长辈。他一路看下来都还满意，到这一处忽然想起东西不齐——他不是要挑毛病，是这处地方再过些日子就要用了。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个被叫来对账的人——你身上就揣着那张单子，主家当众问你三个数；可以是先被问的那个管事的人，你把话推给了别人；可以是跟着走的下人，站在外圈看这一场；也可以不在场，事后听说“那天老爷问了几样东西齐不齐”。若玩家就是那个对账的人，卡的重点变成“你自己写下的那张单子，你照着报，还是先把总数说圆”。"
      },
      {
        "key": "那个“秋天”是什么",
        "value": "那个人自己说出来的期限。他不是被逼的，是自己给自己定了日子——这一句话一出口，就归他自己了。"
      },
      {
        "key": "选择",
        "value": "由那个对账的人做——照单实报，还是先把总数说圆。第二个岔路是甲的：问到底，还是就此放过。"
      },
      {
        "key": "代价",
        "value": "实报，他当众把“还欠”两个字交到甲手里，这一摊不齐的责任从此有一半记在他名下，也等于替自己定了一个期限；说圆，这一场过得去，日后各处逐一核对，一件件都要翻回到今天这张单子上。甲放过，就是自己也认了“先凑合着办”。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。验收新宅、交付前的例会、开业前查库存、神殿落成点法器——只要“有一张单子，当众报，报不完”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“秋天都全，甲没有再问”这一刻。不要写那些东西是什么、值多少；也不要写秋天到底齐了没有。这一张给桌上留下的，是一个悬着的秋天。\n---"
      }
    ]
  },
  {
    "id": "C17-08-替我拿着",
    "number": "C17-08",
    "name": "替我拿着",
    "type": "赏 / 被剥",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-08-替我拿着.md",
    "face": "那孩子从里头出来，脸上还带着一点光。\n\n一出门，跟着他的人都围上来，说：今日老爷喜欢，老太太打发人出来问了好几遍，我们都回说老爷喜欢。要不是这样，老太太早叫你进去了，哪能展才？人人都说你的那些话比众人都强，今儿得了彩头，该赏我们了！\n\n那孩子笑了，说：每人一吊。\n\n围着的人不依：谁没见过那一吊钱！把这荷包赏了罢。\n\n说着，一个个都上来，解荷包，解扇袋，不容分说。\n\n那孩子身上佩的东西，一件一件，都到了别人手里。\n\n众人又说：好生送上去罢。便一拥着，把他送到老太太门前去。\n\n等人散了，他身上一件也不剩。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**那个孩子是谁**：他刚在人前得了一句夸。他是这一家里被捧着的那个，也是被人伺候着长大的那个。玩家可以就是他——一群伺候你的人围着你，你要给，还是不给。\n\n**玩家在哪**：玩家可以是那个孩子；可以是伸手的其中一个——你知道他身上有东西，你也知道你伺候了一场该分一点；可以是站在远处看着的那个人，你身上什么也没被解走；也可以不在场，事后只听说“今天少爷身上的东西被他们分光了”。\n\n**他们为什么敢伸手**：这不是恶仆。这一场是他们伺候出来的，伺候一场要点东西，是这地方的规矩。他们先夸，再要，最后不容分说——三步是一套的。\n\n**这件事的时机**：就在他刚得了一句夸之后。人正在高兴里，最不经人围。\n\n**选择**：由那个孩子做——给钱，还是给身上的东西；给到哪一件为止，拦不拦。\n\n**代价**：由着人解，这些人高兴了，可他从这一刻起欠了一样东西的账——那件东西不是他买的，是有人替他收着的。拦，这一屋子人当场就没趣，他们是伺候他的，拦了他们，往后这一路就不好走。只给钱，一吊钱在这些人眼里不算什么，回去还会说这孩子小气。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。席散之后、演出之后、比赛之后、述职之后——只要“刚被捧过的人身上带着东西，旁边是一群伺候他的人”这一层在，就成立。\n\n**注意**：卡停在“等人散了，他身上一件也不剩”这一刻。不要写他生不生气，也不要写这些人是不是太过分。他身上空了的这件事，会有人看见，也会有人记住。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "那个孩子是谁",
        "value": "他刚在人前得了一句夸。他是这一家里被捧着的那个，也是被人伺候着长大的那个。玩家可以就是他——一群伺候你的人围着你，你要给，还是不给。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个孩子；可以是伸手的其中一个——你知道他身上有东西，你也知道你伺候了一场该分一点；可以是站在远处看着的那个人，你身上什么也没被解走；也可以不在场，事后只听说“今天少爷身上的东西被他们分光了”。"
      },
      {
        "key": "他们为什么敢伸手",
        "value": "这不是恶仆。这一场是他们伺候出来的，伺候一场要点东西，是这地方的规矩。他们先夸，再要，最后不容分说——三步是一套的。"
      },
      {
        "key": "这件事的时机",
        "value": "就在他刚得了一句夸之后。人正在高兴里，最不经人围。"
      },
      {
        "key": "选择",
        "value": "由那个孩子做——给钱，还是给身上的东西；给到哪一件为止，拦不拦。"
      },
      {
        "key": "代价",
        "value": "由着人解，这些人高兴了，可他从这一刻起欠了一样东西的账——那件东西不是他买的，是有人替他收着的。拦，这一屋子人当场就没趣，他们是伺候他的，拦了他们，往后这一路就不好走。只给钱，一吊钱在这些人眼里不算什么，回去还会说这孩子小气。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。席散之后、演出之后、比赛之后、述职之后——只要“刚被捧过的人身上带着东西，旁边是一群伺候他的人”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“等人散了，他身上一件也不剩”这一刻。不要写他生不生气，也不要写这些人是不是太过分。他身上空了的这件事，会有人看见，也会有人记住。\n---"
      }
    ]
  },
  {
    "id": "C17-09-一样不剩",
    "number": "C17-09",
    "name": "一样不剩",
    "type": "认错人 / 当场撕破",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-09-一样不剩.md",
    "face": "屋里的人端了茶来，一抬头，看见那孩子身上一件佩的东西也没有了。\n\n屋里的人笑着说：又是那起没脸的东西们，解了去了。\n\n话还没落地，另一个人走进来，一眼就瞧见了，站住了，问：我给你的那个荷包，也给他们了？你明儿再想我的东西，可不能够了！\n\n说完就回房去了。\n\n那孩子赶过去的时候，那个人已经从屋里拿出一件做到一半的物件，正拿着剪子剪。剪子一下去，布就破了。\n\n那孩子站住了，看着那件东西。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**那个动手的人是谁**：她做东西给这孩子，不是头一回；她对这孩子的心意，落在手上的活里。她不是小心眼的人——她剪的是自己这些天的工夫，这比剪别人更疼。\n\n**玩家在哪**：玩家可以是那个动手的人——你看见他身上空了，你要不要先问一句；可以是那孩子，你赶过去的时候，东西已经破了；可以是端茶进来的那个，你只是笑着说了一句实话；也可以不在场，事后听说“那两个人今天闹了一场”。\n\n**她为什么问都不问就剪**：这句话“我给你的那个荷包，也给他们了”，本身就是最伤人的问法。她当着他的面这样问，就是已经先信了；一转身回房拿剪子，是不想在人前哭。\n\n**她剪的不是本来要给他的那件**：这一件是另一件，做到一半的。她剪的是手里的活，也是自己心里的那口气。\n\n**选择**：由那个动手的人做——剪下去，还是先问一句。第二个岔路是那孩子的：冲进去抢下剪子，还是站在门口看着。\n\n**代价**：剪了，那件做到一半的东西再也做不完，这不是钱能赔的，因为做的人只有一个；她剪破的也是自己这些天的心思。不剪，这口气就压回去，压到自己身上。抢剪子，两个人当场在屋里拉扯，外头的人都会知道。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。绣到一半的东西、织了一半的围巾、写了一半的稿子、打了半件的法器——只要“有人替你做了大半，你把它转手了”这一层在，就成立。\n\n**注意**：卡停在“布破了，那孩子站住了”这一刻。不要写这两个人和好没有，也不要写那孩子有没有抢下剪子。这一剪之后，屋里的人都会知道这两个人之间有一件东西坏了。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "那个动手的人是谁",
        "value": "她做东西给这孩子，不是头一回；她对这孩子的心意，落在手上的活里。她不是小心眼的人——她剪的是自己这些天的工夫，这比剪别人更疼。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个动手的人——你看见他身上空了，你要不要先问一句；可以是那孩子，你赶过去的时候，东西已经破了；可以是端茶进来的那个，你只是笑着说了一句实话；也可以不在场，事后听说“那两个人今天闹了一场”。"
      },
      {
        "key": "她为什么问都不问就剪",
        "value": "这句话“我给你的那个荷包，也给他们了”，本身就是最伤人的问法。她当着他的面这样问，就是已经先信了；一转身回房拿剪子，是不想在人前哭。"
      },
      {
        "key": "她剪的不是本来要给他的那件",
        "value": "这一件是另一件，做到一半的。她剪的是手里的活，也是自己心里的那口气。"
      },
      {
        "key": "选择",
        "value": "由那个动手的人做——剪下去，还是先问一句。第二个岔路是那孩子的：冲进去抢下剪子，还是站在门口看着。"
      },
      {
        "key": "代价",
        "value": "剪了，那件做到一半的东西再也做不完，这不是钱能赔的，因为做的人只有一个；她剪破的也是自己这些天的心思。不剪，这口气就压回去，压到自己身上。抢剪子，两个人当场在屋里拉扯，外头的人都会知道。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。绣到一半的东西、织了一半的围巾、写了一半的稿子、打了半件的法器——只要“有人替你做了大半，你把它转手了”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“布破了，那孩子站住了”这一刻。不要写这两个人和好没有，也不要写那孩子有没有抢下剪子。这一剪之后，屋里的人都会知道这两个人之间有一件东西坏了。\n---"
      }
    ]
  },
  {
    "id": "C17-10-我还收着",
    "number": "C17-10",
    "name": "我还收着",
    "type": "翻出旧物 / 收不了场",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-10-我还收着.md",
    "face": "那件东西已经破了，剪它的人还在气头上。\n\n那孩子赶过来，一边走一边解衣领，从最里面的衣襟上，解下一样东西来，递到那人面前，说：你瞧瞧，这是什么？我何尝把你的东西给过人了？\n\n那人看着那件东西，看见它是贴身穿着的，是收在最里头一层，怕人拿去的那一层。\n\n那人低下头，一句话也不说。\n\n那孩子又说：你也不用剪了。我知道你是懒得给我东西。我连这个也还你，如何？\n\n他把那件东西丢到那人怀里去了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**那孩子为什么先从衣领上解**：他要证明的不是“我给过你东西”，是“我一直收着”。收在最里面那一层，本身就是一句话——他怕人拿去。\n\n**玩家在哪**：玩家可以是那个把东西解出来的人——你走进去，身上还带着那件贴身的旧物，你解不解；可以是那个动手的人，东西摆在你眼前，你认不认这个错；可以是屋里的第三个人，你看着这一幕，谁也没法替他们说话；也可以不在场，事后听说“今天那两个人把话都说到底了”。\n\n**选择**：由那个孩子做——把收在最里面的东西拿出来给她看，还是等她自己消气。第二个岔路是那动手的人：认这个错，还是不认。\n\n**代价**：拿出来，他洗清了自己，也让她当面明白剪错了，这个明白比剪破一件东西更难受；丢过去，这一丢，把“我收着你的东西”变成了“这东西我也不要了”——道理赢了，话也砸了。不拿出来，这一场吵到最后，谁也不知道那件东西其实还在。\n\n**那句话里的刺**：“我知道你是懒得给我东西”——这句话不是安抚，是补上去的一刀。卡不判他这刀补得对不对。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。贴身的信物、夹在钱包里的一张照片、一直没删的一条记录、挂在心口的一块玉——只要“他一直收着，没人知道”这一层在，就成立。\n\n**注意**：卡停在“东西丢进怀里”这一刻。不要写这两个人和好了，也不要写他们真的散了。东西已经掏出来，也丢出去了，两样都收不回去。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "那孩子为什么先从衣领上解",
        "value": "他要证明的不是“我给过你东西”，是“我一直收着”。收在最里面那一层，本身就是一句话——他怕人拿去。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个把东西解出来的人——你走进去，身上还带着那件贴身的旧物，你解不解；可以是那个动手的人，东西摆在你眼前，你认不认这个错；可以是屋里的第三个人，你看着这一幕，谁也没法替他们说话；也可以不在场，事后听说“今天那两个人把话都说到底了”。"
      },
      {
        "key": "选择",
        "value": "由那个孩子做——把收在最里面的东西拿出来给她看，还是等她自己消气。第二个岔路是那动手的人：认这个错，还是不认。"
      },
      {
        "key": "代价",
        "value": "拿出来，他洗清了自己，也让她当面明白剪错了，这个明白比剪破一件东西更难受；丢过去，这一丢，把“我收着你的东西”变成了“这东西我也不要了”——道理赢了，话也砸了。不拿出来，这一场吵到最后，谁也不知道那件东西其实还在。"
      },
      {
        "key": "那句话里的刺",
        "value": "“我知道你是懒得给我东西”——这句话不是安抚，是补上去的一刀。卡不判他这刀补得对不对。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。贴身的信物、夹在钱包里的一张照片、一直没删的一条记录、挂在心口的一块玉——只要“他一直收着，没人知道”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“东西丢进怀里”这一刻。不要写这两个人和好了，也不要写他们真的散了。东西已经掏出来，也丢出去了，两样都收不回去。\n---"
      }
    ]
  },
  {
    "id": "C17-11-一张请帖",
    "number": "C17-11",
    "name": "一张请帖",
    "type": "相请 / 逼请",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-11-一张请帖.md",
    "face": "这一家要办一件大事，各处都添了人。添乐班的、添女孩子的、添念经的、添侍候的，一样一样，都有了着落。\n\n只差一处。有人来回：城西一处小院里，住着一个不出门的姑娘，原是读书人家出身，小时候总也不好，家里人替她请神拜佛、买了替身，都不中用，后来送她出了家，才算好了，所以带发修行。今年十八岁。\n\n她父母都没有了，身边只有两个老仆和一个小丫头。\n\n她的师父去年冬天走了。走之前留下一句话：不要回乡，在这里静候，自有结果。\n\n所以她一直没有回去。\n\n来回报的人又添了一句：她说过，那种人家必拿身份压人，她不去的。\n\n听的人说：既是读书人家的姑娘，自然要有些脾性。下一张请帖，请她来便是。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**说话的是谁**：这一家的主母。她要办一件大事，各处都要齐整；她不是仗势的人，她用的是“礼”——下一张请帖，比派人去叫更周到，也更不容推。\n\n**玩家在哪**：玩家可以是主母——你退了这一步，把“请”字写在纸上；可以是那个被请的人，你守着一句遗言，也守着一身脾气；可以是来回话的那个管事，你夹在两边，一句话说差就要跑第二趟；也可以不在场，事后听说“那家下帖子请了城西那位姑娘”。\n\n**那个“结果”是什么**：卡里不解释。它是她留着不出门的一件凭据，也是她不必动的理由。要演，就演她守着它；至于它真不真，是桌上算的。\n\n**选择**：由主母做——发这张请帖，还是算了。第二个岔路是那个被请的人：接帖子，还是照旧推。\n\n**代价**：发帖子，主母是退了一步，面子上很好看，可这一张纸上写的是“请”，落下去的意思却是“这一家的体面，不能因为一个人破例”；她若接了，是给了主母面子，她若再推，就是驳主母本人。算了，这场大事办得成，只是少一个该到的人，往后这一家再有这样的事，也不会再来问了。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。大户人家办大事去请一位难请的客、公司开年会请一个早就不露面的人、新栏目开播去请一位多年不接受采访的人——只要“请”这个字本身就带着“非来不可”的分量，就成立。\n\n**注意**：卡停在“下一张请帖，请她来便是”这一刻。不要写她到底来不来，也不要写主母心里是不是真敬着她。这张纸一出，事情就从“人家想不想来”变成了“人家给不给这个面子”。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "说话的是谁",
        "value": "这一家的主母。她要办一件大事，各处都要齐整；她不是仗势的人，她用的是“礼”——下一张请帖，比派人去叫更周到，也更不容推。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是主母——你退了这一步，把“请”字写在纸上；可以是那个被请的人，你守着一句遗言，也守着一身脾气；可以是来回话的那个管事，你夹在两边，一句话说差就要跑第二趟；也可以不在场，事后听说“那家下帖子请了城西那位姑娘”。"
      },
      {
        "key": "那个“结果”是什么",
        "value": "卡里不解释。它是她留着不出门的一件凭据，也是她不必动的理由。要演，就演她守着它；至于它真不真，是桌上算的。"
      },
      {
        "key": "选择",
        "value": "由主母做——发这张请帖，还是算了。第二个岔路是那个被请的人：接帖子，还是照旧推。"
      },
      {
        "key": "代价",
        "value": "发帖子，主母是退了一步，面子上很好看，可这一张纸上写的是“请”，落下去的意思却是“这一家的体面，不能因为一个人破例”；她若接了，是给了主母面子，她若再推，就是驳主母本人。算了，这场大事办得成，只是少一个该到的人，往后这一家再有这样的事，也不会再来问了。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。大户人家办大事去请一位难请的客、公司开年会请一个早就不露面的人、新栏目开播去请一位多年不接受采访的人——只要“请”这个字本身就带着“非来不可”的分量，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“下一张请帖，请她来便是”这一刻。不要写她到底来不来，也不要写主母心里是不是真敬着她。这张纸一出，事情就从“人家想不想来”变成了“人家给不给这个面子”。\n---"
      }
    ]
  },
  {
    "id": "C17-12-再等一年",
    "number": "C17-12",
    "name": "再等一年",
    "type": "守着一句话 / 算卦",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十七回",
    "rel": "红楼梦/现实类/第十七回/C17-12-再等一年.md",
    "face": "那个姑娘打小就不好。家里人替她请神、拜佛、买替身，一样一样都试过了，全不中用。\n\n后来有一位算命的替她看了一回，说：这个孩子留不住，不如送出去出家。\n\n她就这样出了家。人居然也好了。所以她没有落发，只算是修行，还留着一头头发。\n\n父母后来都没有了。她身边只剩两个老仆和一个小丫头。\n\n她的师父专会算这些。去年冬天，师父也走了。\n\n走之前，师父留下一句话：这个人不宜回乡，在这里静候，自有结果。\n\n她就没有回去。一年了，她一直在这座城里住着，等那个结果。\n\n有人来请她的时候，她推了，说：这种人家，必拿身份压人，我不去。\n\n这话传了回去。过了两天，人家送了一张请帖来，是备了车轿来请的。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**玩家在哪**：玩家可以是那个守着话的人——车轿停在门口，你上不上；可以是来接的人，你备了车轿，人家不出来，你回去怎么回话；可以是她身边的那个老仆，你伺候了她这些年，你知道她为什么不动；也可以不在场，事后听说“那位姑娘还是没有出门”。\n\n**那句话是谁说的**：一个已经死了的人。她守着它，是因为说这话的人走了以后，再没有人能替这句话负责。\n\n**卡里不判它对不对**：那句话可以是一位老人的一个判断，也可以是她自己给自己找的一个不必动的理由。桌上要演的是“她守着”，不是“它准不准”。\n\n**选择**：由她做——跟来接的人走，还是守着那句话再等一年。\n\n**代价**：走了，她守了一年的东西从这一天起不算数；出门之后，她的身份、脾气、体面，都要在人家屋檐底下重新分一次。不走，车轿回去，这一家从此不会再请她第二回，她还得替这一年找一个说法——是那句话说得对，还是自己怕了。\n\n**这是哪**：古代、现代、奇幻、科幻都可以。算命的说这孩子留不住、送去别处养、多年后一位医生或老师留下了一句话、有人来请她出山而她说“那种地方必拿架子压人”——只要“一句死去的人留下的话，管着一个活人的路”这一层在，就成立。\n\n**注意**：卡停在“车轿停在门口，她还没有动”这一刻。不要写她最后上没上车。这一张给桌上留下的，是一句要兑现的话。\n\n---",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是那个守着话的人——车轿停在门口，你上不上；可以是来接的人，你备了车轿，人家不出来，你回去怎么回话；可以是她身边的那个老仆，你伺候了她这些年，你知道她为什么不动；也可以不在场，事后听说“那位姑娘还是没有出门”。"
      },
      {
        "key": "那句话是谁说的",
        "value": "一个已经死了的人。她守着它，是因为说这话的人走了以后，再没有人能替这句话负责。"
      },
      {
        "key": "卡里不判它对不对",
        "value": "那句话可以是一位老人的一个判断，也可以是她自己给自己找的一个不必动的理由。桌上要演的是“她守着”，不是“它准不准”。"
      },
      {
        "key": "选择",
        "value": "由她做——跟来接的人走，还是守着那句话再等一年。"
      },
      {
        "key": "代价",
        "value": "走了，她守了一年的东西从这一天起不算数；出门之后，她的身份、脾气、体面，都要在人家屋檐底下重新分一次。不走，车轿回去，这一家从此不会再请她第二回，她还得替这一年找一个说法——是那句话说得对，还是自己怕了。"
      },
      {
        "key": "这是哪",
        "value": "古代、现代、奇幻、科幻都可以。算命的说这孩子留不住、送去别处养、多年后一位医生或老师留下了一句话、有人来请她出山而她说“那种地方必拿架子压人”——只要“一句死去的人留下的话，管着一个活人的路”这一层在，就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“车轿停在门口，她还没有动”这一刻。不要写她最后上没上车。这一张给桌上留下的，是一句要兑现的话。\n---"
      }
    ]
  },
  {
    "id": "C18-01-接旨",
    "number": "C18-01",
    "name": "接旨",
    "type": "召见 / 变数",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十八回",
    "rel": "红楼梦/现实类/第十八回/C18-01-接旨.md",
    "face": "这一天家里正办着事。是家里一位长辈的好日子，满屋子的人，满桌子的酒，谁也不提外头的事。\n\n忽然门上的人跑进来报：外头来人了，叫家里做主的人出去接。\n\n堂上一下子静了。有人先站起来，把杯子放下，手有点抖。家里的人一样一样地把礼数摆出来，摆得比平时快，也乱。堂上点起了香，铺开了垫子。\n\n来的人站在上头，念了一纸东西。念完，把家里人叫起来，说恭喜。又说：日子定了，到时候再来传。\n\n一屋子的人先是不敢出声，接着都跪下去，朝着一个方向谢了恩，起来的时候脸上是笑的。有人回头看甲，那意思是：原来不是坏事。\n\n来的人临走，又回头跟家里那位长辈说了一句话。话不重，听着却不像单单是恭喜。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是这家做主的人，也是被点名要出门的那一个。他可以是玩家，也可以是玩家的父亲、母亲、长辈、兄长。\n\n**玩家在哪**：玩家可以就是甲，站在院子当中听人来传话；可以是家里任何一个在场的人，看着自家人被叫出去；也可以完全不在场，事后才知道这一天家里变了个样。若玩家是那位长辈，卡的重点是后半句——“你养的人，往后归别处了”。\n\n**那张纸是什么**：一道传召、一纸公文、一份调令、一封盖了印的信。它上头有名目、有期限、有去处。它是喜事，也是从此不能推的事。\n\n**为什么先是慌**：因为来的人带着印，话说得比平时规矩，而家里没有一个人知道是为什么。慌是这张卡的前半段，不是结果。\n\n**为什么笑**：因为最坏的一种比这更坏。“只是升了”已经算好。喜气是靠比较得来的。\n\n**这事怎么来的**：多数时候，家里并不知道是谁说了话、递了话、花了什么换来的。这一层不知道，就是这张卡留下的账。\n\n**这是哪**：任何“一句话就能把人调走”的世界——官府、宫里、军中、门派、船队、公司、宗族。\n\n**注意**：卡停在“门里报喜、人已经归了别处”这一刻。不要写甲是被送去的还是自己想去的，也不要写这一家从此发达。那张纸上的名目，就是这张卡留下的东西。留给下一张卡的是：日子已经定了，这一家从今天起要为那一天活着。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是这家做主的人，也是被点名要出门的那一个。他可以是玩家，也可以是玩家的父亲、母亲、长辈、兄长。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以就是甲，站在院子当中听人来传话；可以是家里任何一个在场的人，看着自家人被叫出去；也可以完全不在场，事后才知道这一天家里变了个样。若玩家是那位长辈，卡的重点是后半句——“你养的人，往后归别处了”。"
      },
      {
        "key": "那张纸是什么",
        "value": "一道传召、一纸公文、一份调令、一封盖了印的信。它上头有名目、有期限、有去处。它是喜事，也是从此不能推的事。"
      },
      {
        "key": "为什么先是慌",
        "value": "因为来的人带着印，话说得比平时规矩，而家里没有一个人知道是为什么。慌是这张卡的前半段，不是结果。"
      },
      {
        "key": "为什么笑",
        "value": "因为最坏的一种比这更坏。“只是升了”已经算好。喜气是靠比较得来的。"
      },
      {
        "key": "这事怎么来的",
        "value": "多数时候，家里并不知道是谁说了话、递了话、花了什么换来的。这一层不知道，就是这张卡留下的账。"
      },
      {
        "key": "这是哪",
        "value": "任何“一句话就能把人调走”的世界——官府、宫里、军中、门派、船队、公司、宗族。"
      },
      {
        "key": "注意",
        "value": "卡停在“门里报喜、人已经归了别处”这一刻。不要写甲是被送去的还是自己想去的，也不要写这一家从此发达。那张纸上的名目，就是这张卡留下的东西。留给下一张卡的是：日子已经定了，这一家从今天起要为那一天活着。"
      }
    ]
  },
  {
    "id": "C18-02-先看一出戏",
    "number": "C18-02",
    "name": "先看一出戏",
    "type": "礼序 / 往后排",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十八回",
    "rel": "红楼梦/现实类/第十八回/C18-02-先看一出戏.md",
    "face": "日子到了。天刚擦黑，一条街上的人都出来了。灯火一路摆过去，轿马、执事、随从，一样一样从街心过。有人从早上站到天黑，就为看她一眼。\n\n这一家早把住处收拾出来了：该挂的挂了，该换的换了，该铺的铺了。家里人一个不少，按着位次站着，从大门站到里屋，脚都站麻了。\n\n队伍到了门口，她先没有进来。她去了别处——那里备着戏台、点着灯，一群人在等她。台上开戏了，一出，两出，三出。她在那里按着单子行礼、坐下、看戏、受礼、再行礼。\n\n里头的人还站着。家里辈分最高的那位老人，和几位长辈，早就让人引到了里屋坐着，一坐坐到菜都不热了。管事的进来一趟又出去一趟，出来一趟就问一句：到这屋还要多会儿。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是做主的那个当家人，也可以是坐在里屋等的那位老人，或者是那个一趟趟出去问“还要多会儿”的管事人。三个人等的不是同一件事。\n\n**玩家在哪**：玩家可以站在门外等，站在里屋等，或者在戏台那边做事；也可以完全不在场，事后听说“那天晚上，家里的老人一直在等她”。若玩家是那个等的人，卡的重点是这一晚你什么都没说。\n\n**她先去的地方是什么**：一处要紧的场所，一处要按次序到的处所，一趟必须先走的过场——公事、正殿、祠堂、官署、礼堂、一个大场面。她在那里演的不是自己，是那个位置。\n\n**为什么那场戏推不掉**：因为次序不是她定的。她要是先进了里屋，往后这一整晚、乃至往后好几年，都要替这一次还账。\n\n**里屋坐着的是谁**：老人、母亲、婆婆、长辈、孩子的母亲。谁站在这张卡的后面，谁就是那种“不能先叫人、只能等人来叫”的人。\n\n**这一家的排场是谁摆的**：多半不是她要求摆的。家里人自己把钱拿出来，把体面撑到满，指望把这一天办成能讲出去的一天——这也是账。\n\n**这是哪**：任何有大场面、有先后次序的地方——迎亲、上香、接站、典礼、年会、登门、上任。\n\n**注意**：卡停在“里屋的人还坐着等”这一刻。不要写谁抱怨了什么，也不要写她知不知道有人在等。那场戏已经唱完了；接下来她进门，是另一张卡。\n\n**附**：这一张可以当“等待”用——没有一个人做得出格，所有人都在按规矩等，而时间只往前走。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是做主的那个当家人，也可以是坐在里屋等的那位老人，或者是那个一趟趟出去问“还要多会儿”的管事人。三个人等的不是同一件事。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以站在门外等，站在里屋等，或者在戏台那边做事；也可以完全不在场，事后听说“那天晚上，家里的老人一直在等她”。若玩家是那个等的人，卡的重点是这一晚你什么都没说。"
      },
      {
        "key": "她先去的地方是什么",
        "value": "一处要紧的场所，一处要按次序到的处所，一趟必须先走的过场——公事、正殿、祠堂、官署、礼堂、一个大场面。她在那里演的不是自己，是那个位置。"
      },
      {
        "key": "为什么那场戏推不掉",
        "value": "因为次序不是她定的。她要是先进了里屋，往后这一整晚、乃至往后好几年，都要替这一次还账。"
      },
      {
        "key": "里屋坐着的是谁",
        "value": "老人、母亲、婆婆、长辈、孩子的母亲。谁站在这张卡的后面，谁就是那种“不能先叫人、只能等人来叫”的人。"
      },
      {
        "key": "这一家的排场是谁摆的",
        "value": "多半不是她要求摆的。家里人自己把钱拿出来，把体面撑到满，指望把这一天办成能讲出去的一天——这也是账。"
      },
      {
        "key": "这是哪",
        "value": "任何有大场面、有先后次序的地方——迎亲、上香、接站、典礼、年会、登门、上任。"
      },
      {
        "key": "注意",
        "value": "卡停在“里屋的人还坐着等”这一刻。不要写谁抱怨了什么，也不要写她知不知道有人在等。那场戏已经唱完了；接下来她进门，是另一张卡。"
      },
      {
        "key": "附",
        "value": "这一张可以当“等待”用——没有一个人做得出格，所有人都在按规矩等，而时间只往前走。"
      }
    ]
  },
  {
    "id": "C18-03-唤祖母",
    "number": "C18-03",
    "name": "唤祖母",
    "type": "相见 / 称呼",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十八回",
    "rel": "红楼梦/现实类/第十八回/C18-03-唤祖母.md",
    "face": "她进到里屋了。屋里的人全都站起来。\n\n她走到那位老人跟前。老人先要往下跪——那一位是家里的长辈，此刻却要向她行那个礼。她先一步拦住了，两边的手都停在半空。\n\n两个人就那样站着，谁也不说话。过了一会儿，她坐下，把老人和几位长辈叫到跟前。她开口，第一句没说出来，先哭了。老人跟着哭。屋里的人一齐哭起来。\n\n哭了很久，她收住泪，说：当初把我送到那种地方去，今日好容易回来一趟，不说说笑笑，反倒哭起来。\n\n这句话说完，屋里又哭了一回。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是被叫到跟前的那个长辈，也可以是回来的人，还可以是屋里任何一个站着看的人。\n\n**玩家在哪**：玩家可以在场，站在屋里；也可以就是那位长辈，手停在半空里；也可以就是回来的人，整晚说不出一句真话；也可以完全不在场，只听说那天晚上屋里哭成一团。若玩家在场，这张卡给你的选择只有一个——要不要跪。跪不跪，比说什么都重。\n\n**为什么是重的**：这一晚之前，她是这个家的孩子；这一晚之后，家里的人见了她，得先看她坐在哪儿。称呼也变了，有人从此改口，不再按原来的叫法叫她。\n\n**老人为什么会跪**：不是怕她，是怕规矩。跪下来的是这一家的体面，也是这一家人往后的活路。\n\n**“那种地方”是哪**：宫里、府里、门里、深宅、边地、一个进去了就出不来的位置。卡不点明，也不评价。\n\n**她哭的是什么**：不是委屈，是“难得回来一趟，我却不能只是回来”。她越是有身份，这一屋子越没有一处能让她放下。\n\n**这是哪**：任何“身份换了、亲情还在”的场合——嫁出去的女儿、升上去的下属、出家的子女、过继的孩子、做了官的门生。\n\n**注意**：卡停在“门关上了、外头还有人在等”这一刻。不要写她后来跟谁单独说了什么。这张卡不评断规矩，只呈现代价：这一家人从此用一个位置来叫一个人。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是被叫到跟前的那个长辈，也可以是回来的人，还可以是屋里任何一个站着看的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场，站在屋里；也可以就是那位长辈，手停在半空里；也可以就是回来的人，整晚说不出一句真话；也可以完全不在场，只听说那天晚上屋里哭成一团。若玩家在场，这张卡给你的选择只有一个——要不要跪。跪不跪，比说什么都重。"
      },
      {
        "key": "为什么是重的",
        "value": "这一晚之前，她是这个家的孩子；这一晚之后，家里的人见了她，得先看她坐在哪儿。称呼也变了，有人从此改口，不再按原来的叫法叫她。"
      },
      {
        "key": "老人为什么会跪",
        "value": "不是怕她，是怕规矩。跪下来的是这一家的体面，也是这一家人往后的活路。"
      },
      {
        "key": "“那种地方”是哪",
        "value": "宫里、府里、门里、深宅、边地、一个进去了就出不来的位置。卡不点明，也不评价。"
      },
      {
        "key": "她哭的是什么",
        "value": "不是委屈，是“难得回来一趟，我却不能只是回来”。她越是有身份，这一屋子越没有一处能让她放下。"
      },
      {
        "key": "这是哪",
        "value": "任何“身份换了、亲情还在”的场合——嫁出去的女儿、升上去的下属、出家的子女、过继的孩子、做了官的门生。"
      },
      {
        "key": "注意",
        "value": "卡停在“门关上了、外头还有人在等”这一刻。不要写她后来跟谁单独说了什么。这张卡不评断规矩，只呈现代价：这一家人从此用一个位置来叫一个人。"
      }
    ]
  },
  {
    "id": "C18-04-把旧字磨掉",
    "number": "C18-04",
    "name": "把旧字磨掉",
    "type": "题名 / 抹去",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十八回",
    "rel": "红楼梦/现实类/第十八回/C18-04-把旧字磨掉.md",
    "face": "她要去看一看那处新收拾出来的地方。是她小时候住过的那一片。\n\n一路走过去，每一处都新题了字，挂在门上的旧字已经摘下来，靠在墙边。她走到一处，说：这一处，用不着那些字。旁边的人当然照办，当场换掉。又走到一处，她念了念上头那几个字，说：这几个不好。也换了。\n\n有几处，是她自己从前起的名字。一处一处，都被换掉。\n\n有人拿着一本册子站在旁边记。她说什么，那上头就写什么。\n\n她改完之后说：这样就好了。既然要留一份记录，就照这个记，将来一并刻出来。\n\n她改的时候，心里想的是几处；本子上记下来的，是要刻出去的那些。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是那个回来的人，也可以是拿本子记的人，还可以是当初题那几处字的人。\n\n**玩家在哪**：玩家可以跟着一路走，听她一处一处地改；可以是记本子的那一个，她说什么你写什么；可以是当初题字的那个人，站在旁边看着自己的字被摘下来。也可以不在场，改完了才知道。\n\n**那些字是谁写的**：家里的小辈、清客、幕僚、属官、请来的人；其中几处，正是她小时候住在这儿的时候，自己起的。改掉的第一个是她自己的，这一点最见深浅。\n\n**为什么一定要换掉**：要留成记录、要刻出来给人看，字就得挑得过去，不能留着不肯长大的旧称呼。\n\n**她换掉的是哪些**：最私人、最像她自己的那几个。留下的多半是名目、籍贯、吉利话。改完之后，哪儿都干净了，只有她记得原来叫什么。\n\n**定下来之后就不再改吗**：会再改。今天觉得这个好，明天觉得不如原来的，可石头已经刻好了，要磨掉重来。磨的过程，就是这张卡的余波。\n\n**这是哪**：任何有“字要留给人看”的地方——匾额、门牌、碑文、档案、署名、账号、族谱、公司年报。\n\n**注意**：卡停在“记录已经带走、人还没有走”这一刻。不要写那些旧字日后会不会被人想起来。写下来的是她的位置，改掉的是她的从前。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是那个回来的人，也可以是拿本子记的人，还可以是当初题那几处字的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以跟着一路走，听她一处一处地改；可以是记本子的那一个，她说什么你写什么；可以是当初题字的那个人，站在旁边看着自己的字被摘下来。也可以不在场，改完了才知道。"
      },
      {
        "key": "那些字是谁写的",
        "value": "家里的小辈、清客、幕僚、属官、请来的人；其中几处，正是她小时候住在这儿的时候，自己起的。改掉的第一个是她自己的，这一点最见深浅。"
      },
      {
        "key": "为什么一定要换掉",
        "value": "要留成记录、要刻出来给人看，字就得挑得过去，不能留着不肯长大的旧称呼。"
      },
      {
        "key": "她换掉的是哪些",
        "value": "最私人、最像她自己的那几个。留下的多半是名目、籍贯、吉利话。改完之后，哪儿都干净了，只有她记得原来叫什么。"
      },
      {
        "key": "定下来之后就不再改吗",
        "value": "会再改。今天觉得这个好，明天觉得不如原来的，可石头已经刻好了，要磨掉重来。磨的过程，就是这张卡的余波。"
      },
      {
        "key": "这是哪",
        "value": "任何有“字要留给人看”的地方——匾额、门牌、碑文、档案、署名、账号、族谱、公司年报。"
      },
      {
        "key": "注意",
        "value": "卡停在“记录已经带走、人还没有走”这一刻。不要写那些旧字日后会不会被人想起来。写下来的是她的位置，改掉的是她的从前。"
      }
    ]
  },
  {
    "id": "C18-05-一首一首接着写",
    "number": "C18-05",
    "name": "一首一首接着写",
    "type": "代笔 / 才名",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十八回",
    "rel": "红楼梦/现实类/第十八回/C18-05-一首一首接着写.md",
    "face": "席上的人，一个一个被点着名要交一首。先是能写的人，写完一份，念一份，赏一份。念到后来，点到了几个孩子。\n\n那个少年被点了好几处，一个人要交好几份，写一份，再写一份，写到后头，眼睛都花了。旁边有人替他着急，也有人只是看。\n\n比他更会写的那个人，趁人不注意，替他写了他那一份。写完，看了一遍，把纸推回去，一个字也没多说。\n\n掌事的人把这几份一起拿起来念。念到那一份，念的人点头，说好，说这一句最见心思；又问是谁写的，众人说就是那位少年。于是赏了下来，还往上头报了。\n\n念的人都夸那个少年有出息。替他写的那一个，站在旁边，一句话也没有。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是被点着名交东西的那个少年，也可以是替他写的那一个，还可以是那个说“好”的掌事人。\n\n**玩家在哪**：玩家可以是被点名的人，卡在“交不交得出”上；可以是代笔的人，写不写由你，说不说也由你；可以是评的人，拿着几份不知道谁写的纸；也可以不在场，事后听说全屋子都在夸那个名字。\n\n**写的到底是什么**：一首诗、一份对、一篇文字、一段话、一张布置——总之是当场要交、当场要念、当场要评、还要往上报的东西。\n\n**为什么是重的**：这一晚之后，那几份东西会被当成本事记下来；而被记下的名字，和写的人不是同一个。这不是一时的小事，是一笔没对上的账。\n\n**那个少年为什么写不出**：不是不会，是被挤住了。一屋子人看着，往上比的都是“今天该好”，越到后头越写不成。\n\n**代笔的人为什么肯写**：因为在她那里，写得出只是件顺手的事；也因为这件事里，只有这一处她还做得了主。\n\n**评的人知不知道**：多数时候不知道。他评的是那几行字，不是那个人；他要的是一个体面的结果，好往上头说。\n\n**这是哪**：任何有“当场交、具名、往上评”的地方——考试、献诗、征稿、比稿、献策、公司汇报、论文署名。\n\n**注意**：卡停在“赏下来了，名字不是写的人”这一刻。不要写他后来有没有说出来，也不要写那少年知不知道、什么时候知道。若这一份日后出事——被人追问、被人认出笔迹、被人拿去说事——根就在这一刻。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是被点着名交东西的那个少年，也可以是替他写的那一个，还可以是那个说“好”的掌事人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是被点名的人，卡在“交不交得出”上；可以是代笔的人，写不写由你，说不说也由你；可以是评的人，拿着几份不知道谁写的纸；也可以不在场，事后听说全屋子都在夸那个名字。"
      },
      {
        "key": "写的到底是什么",
        "value": "一首诗、一份对、一篇文字、一段话、一张布置——总之是当场要交、当场要念、当场要评、还要往上报的东西。"
      },
      {
        "key": "为什么是重的",
        "value": "这一晚之后，那几份东西会被当成本事记下来；而被记下的名字，和写的人不是同一个。这不是一时的小事，是一笔没对上的账。"
      },
      {
        "key": "那个少年为什么写不出",
        "value": "不是不会，是被挤住了。一屋子人看着，往上比的都是“今天该好”，越到后头越写不成。"
      },
      {
        "key": "代笔的人为什么肯写",
        "value": "因为在她那里，写得出只是件顺手的事；也因为这件事里，只有这一处她还做得了主。"
      },
      {
        "key": "评的人知不知道",
        "value": "多数时候不知道。他评的是那几行字，不是那个人；他要的是一个体面的结果，好往上头说。"
      },
      {
        "key": "这是哪",
        "value": "任何有“当场交、具名、往上评”的地方——考试、献诗、征稿、比稿、献策、公司汇报、论文署名。"
      },
      {
        "key": "注意",
        "value": "卡停在“赏下来了，名字不是写的人”这一刻。不要写他后来有没有说出来，也不要写那少年知不知道、什么时候知道。若这一份日后出事——被人追问、被人认出笔迹、被人拿去说事——根就在这一刻。"
      }
    ]
  },
  {
    "id": "C18-06-下次还不知道什么时候",
    "number": "C18-06",
    "name": "下次还不知道什么时候",
    "type": "送别 / 归位",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十八回",
    "rel": "红楼梦/现实类/第十八回/C18-06-下次还不知道什么时候.md",
    "face": "散了。人要回去了。\n\n一家人都跟到门口。她走到门口，站住，回过身来。\n\n她拉住几个人的手，一个一个地看。说过的话，无非是：好好保重身子，别惦记我；往后不必这样破费，这样也够了。\n\n然后她把一句最要紧的话说出来了：那里头，是不大能常来常往的。下次还不知道是什么时候。\n\n说完她就走了。没有再回头。\n\n灯还亮着。回来的人往原来那条路走，一路上的灯一直摆到街外头去。门里的人站着，看那队人走远。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是送人的家里人，也可以是那位回来的长辈，还可以是站在门里没跟出去的那个人。\n\n**玩家在哪**：玩家可以站在门口送她；可以是被她拉住手的那个；可以就是她，站住的那一下要不要回头，由你定。也可以不在场，事后听说“那天夜里，她一走就再没回来过”。\n\n**为什么是重的**：这一晚之前，这一家人心里还有一个“还会再有”；这一晚之后，没有了。热热闹闹一晚上，最后落下来的，是这一句。\n\n**她留下的是什么**：一句“下次”，一处刻好了名字的地方，一堆花出去的钱，一张记着这一晚的册子，还有一屋子的空。\n\n**她为什么不回头**：回头就走不了了。也可能她只是不肯让门里看见自己的脸。\n\n**这句“下次”为什么难**：不是路远，是规矩；不是“我不想来”，是“我来不了”。卡不点明是哪一种规矩，只留这一句。\n\n**这一家往后靠什么过**：靠这一个位置，靠着那句“下次”。日子越往后，这句话越重——因为谁也不知道下一次是哪年。\n\n**这是哪**：任何“分别以后不能再见”的地方——远嫁、戍边、出家、坐牢、移民、入宫、调任。\n\n**注意**：卡停在“人在门里，车马已经走远”这一刻。不要写她回去以后怎样，也不要写这一家后来怎样。要留一个人问她：下次是什么时候？",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是送人的家里人，也可以是那位回来的长辈，还可以是站在门里没跟出去的那个人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以站在门口送她；可以是被她拉住手的那个；可以就是她，站住的那一下要不要回头，由你定。也可以不在场，事后听说“那天夜里，她一走就再没回来过”。"
      },
      {
        "key": "为什么是重的",
        "value": "这一晚之前，这一家人心里还有一个“还会再有”；这一晚之后，没有了。热热闹闹一晚上，最后落下来的，是这一句。"
      },
      {
        "key": "她留下的是什么",
        "value": "一句“下次”，一处刻好了名字的地方，一堆花出去的钱，一张记着这一晚的册子，还有一屋子的空。"
      },
      {
        "key": "她为什么不回头",
        "value": "回头就走不了了。也可能她只是不肯让门里看见自己的脸。"
      },
      {
        "key": "这句“下次”为什么难",
        "value": "不是路远，是规矩；不是“我不想来”，是“我来不了”。卡不点明是哪一种规矩，只留这一句。"
      },
      {
        "key": "这一家往后靠什么过",
        "value": "靠这一个位置，靠着那句“下次”。日子越往后，这句话越重——因为谁也不知道下一次是哪年。"
      },
      {
        "key": "这是哪",
        "value": "任何“分别以后不能再见”的地方——远嫁、戍边、出家、坐牢、移民、入宫、调任。"
      },
      {
        "key": "注意",
        "value": "卡停在“人在门里，车马已经走远”这一刻。不要写她回去以后怎样，也不要写这一家后来怎样。要留一个人问她：下次是什么时候？"
      }
    ]
  },
  {
    "id": "C19-01-撞见",
    "number": "C19-01",
    "name": "撞见",
    "type": "撞破 / 封口",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-01-撞见.md",
    "face": "一扇关着的门后面，有人在办一件不该在这儿办的事。动静传了出来。\n\n甲推门进去，喊了一声。两个人一起僵住，衣裳都来不及理，抖成一团。其中一个跪下去，一连声地哀求。另一个转身就跑。\n\n甲站在门口，看着跑掉的那个，喊了一句：你别怕，我不告诉人。\n\n跪着的人在后头接了一句：祖宗，这不就是分明告诉人了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是那个推门的人，也可以是门后面的两个人之一——被撞见的那一个，或是把这事说出去的那一个。甲可以是玩家。\n\n**玩家在哪**：玩家可以在场（多半就是推门的人），当场决定声张还是压下去；也可以不在场，事后从别人口中听说这一桩。若玩家是被撞见的人，卡的重点就变成“你信不信那句‘我不告诉人’”。\n\n**这两个人是谁**：一个是有差事在身的人，一个是跟他相好的人。两个人都不是自由身，也都不觉得自己做错了什么；他们只是挑错了地方、挑错了时候。\n\n**这两个人的名分**：一个手里有管人的权，一个没有；年岁未必差多少，甚至未必是年长的那个在管人。恶不在这一处，麻烦在这一处。\n\n**“不告诉人”有多重**：说这句话的人，等于当场把这件事攥在了手里；听这句话的人，等于把往后都押在了这句话上。这句话可以一直不兑现，也可以随时兑现。\n\n**谁在门外**：若与《趁空》连着演，门后头这一桩和跟着溜出去那一桩，可以是同一个下午。\n\n**这是哪**：任何有“管着人的人”和“被人管着的人”的地方：大宅、学校、军营、船、厂、宿舍区。\n\n**注意**：这是一张成人向的卡，卡面不写任何身体细节，只到“分明告诉人了”为止。使用时请先确认故事里这两个人的年纪都合适；若不合适，就把他们改成两个成年人，或者把这件事改成“两个人私下来往被撞见”。卡停在门外那一声脚步走远这一刻，不写这句“不告诉人”有没有兑现。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是那个推门的人，也可以是门后面的两个人之一——被撞见的那一个，或是把这事说出去的那一个。甲可以是玩家。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以在场（多半就是推门的人），当场决定声张还是压下去；也可以不在场，事后从别人口中听说这一桩。若玩家是被撞见的人，卡的重点就变成“你信不信那句‘我不告诉人’”。"
      },
      {
        "key": "这两个人是谁",
        "value": "一个是有差事在身的人，一个是跟他相好的人。两个人都不是自由身，也都不觉得自己做错了什么；他们只是挑错了地方、挑错了时候。"
      },
      {
        "key": "这两个人的名分",
        "value": "一个手里有管人的权，一个没有；年岁未必差多少，甚至未必是年长的那个在管人。恶不在这一处，麻烦在这一处。"
      },
      {
        "key": "“不告诉人”有多重",
        "value": "说这句话的人，等于当场把这件事攥在了手里；听这句话的人，等于把往后都押在了这句话上。这句话可以一直不兑现，也可以随时兑现。"
      },
      {
        "key": "谁在门外",
        "value": "若与《趁空》连着演，门后头这一桩和跟着溜出去那一桩，可以是同一个下午。"
      },
      {
        "key": "这是哪",
        "value": "任何有“管着人的人”和“被人管着的人”的地方：大宅、学校、军营、船、厂、宿舍区。"
      },
      {
        "key": "注意",
        "value": "这是一张成人向的卡，卡面不写任何身体细节，只到“分明告诉人了”为止。使用时请先确认故事里这两个人的年纪都合适；若不合适，就把他们改成两个成年人，或者把这件事改成“两个人私下来往被撞见”。卡停在门外那一声脚步走远这一刻，不写这句“不告诉人”有没有兑现。"
      }
    ]
  },
  {
    "id": "C19-02-趁空",
    "number": "C19-02",
    "name": "趁空",
    "type": "私自外出 / 拿主意",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-02-趁空.md",
    "face": "家里有事，主事的人都在外头忙，看管的人各有各的去处。有一个人闲得发闷，起了个念头：出去走一趟，看一个人。\n\n他把跟从的人叫来，叫他想个近处的去处。跟从的人心里不愿意——带出去的是他，出了事挨罚的也是他——可话已经说到这个份上，还是去后头牵了马。\n\n两个人从后门出去，天还亮着。路不远，转眼就到。他把缰绳交给跟从的人，自己往里走。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲是想出去的那个人，也是说了算了的那个人。甲可以年纪不大，也可以不小；要紧的是甲发话，别人照办。\n\n**玩家在哪**：玩家可以是甲，当场决定去还是不去；可以是那个跟从的人，从被叫来的那一刻起就担了干系；也可以不在场，事后听说这半天有个人不见了，家里没人知道。\n\n**去看的是谁**：一个跟了甲很多年、眼下不在跟前的人——回了自己家、调去了别处、请了假、离了职。这条线要成立，甲得真心惦记这个人，而不是随便找个人解闷。\n\n**跟从的人怕什么**：怕罚，怕担责任，也怕家里以为是他撺掇的。他不是坏人，他是这张卡里唯一一个在替后果算账的人。\n\n**怎么回来的**：趁天没黑、绕开人多的路、先回自己屋里晃一圈，装作哪儿都没去。这一趟要善后，善后就有人要替他遮。\n\n**这是哪**：任何有“看管”和“被看管”的地方：大宅、寄宿学校、府衙、公司、部队、剧组。\n\n**注意**：卡停在“自己往里走”这一刻。不要写门里那一场，也不要写这半天有没有被发现。有一个人已经出了他该待的地方。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲是想出去的那个人，也是说了算了的那个人。甲可以年纪不大，也可以不小；要紧的是甲发话，别人照办。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当场决定去还是不去；可以是那个跟从的人，从被叫来的那一刻起就担了干系；也可以不在场，事后听说这半天有个人不见了，家里没人知道。"
      },
      {
        "key": "去看的是谁",
        "value": "一个跟了甲很多年、眼下不在跟前的人——回了自己家、调去了别处、请了假、离了职。这条线要成立，甲得真心惦记这个人，而不是随便找个人解闷。"
      },
      {
        "key": "跟从的人怕什么",
        "value": "怕罚，怕担责任，也怕家里以为是他撺掇的。他不是坏人，他是这张卡里唯一一个在替后果算账的人。"
      },
      {
        "key": "怎么回来的",
        "value": "趁天没黑、绕开人多的路、先回自己屋里晃一圈，装作哪儿都没去。这一趟要善后，善后就有人要替他遮。"
      },
      {
        "key": "这是哪",
        "value": "任何有“看管”和“被看管”的地方：大宅、寄宿学校、府衙、公司、部队、剧组。"
      },
      {
        "key": "注意",
        "value": "卡停在“自己往里走”这一刻。不要写门里那一场，也不要写这半天有没有被发现。有一个人已经出了他该待的地方。"
      }
    ]
  },
  {
    "id": "C19-03-那份东西被吃了",
    "number": "C19-03",
    "name": "那份东西被吃了",
    "type": "体面 / 现成的人情",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-03-那份东西被吃了.md",
    "face": "主事的人不在，屋里的人就放肆起来：玩的玩，闹的闹，果皮纸屑弄了一地。\n\n门帘一掀，进来一位年长的。她在这一家的时候比谁都长，如今不管事了，可还是常来。她张嘴就问：这是怎么个样子，没人管了？\n\n屋里的人照旧玩自己的，没人理她。她越问越起劲，问来问去，没人肯正经答。\n\n然后她看见了桌上那份东西，问了一句：这个怎么不给我。\n\n旁边的人说：那是留给人的，动了要惹气，您自己认下，别带累我们。\n\n她听完更气，说了一句：难道我还比不上他。赌气，把它全吃了，走了。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**玩家在哪**：玩家可以是在场的人——分东西的那个、被留下东西的那个，也可能是主事的人，回来才知道自己那份没了；也可以不在场，事后听说家里为一口吃食闹了一场。\n\n**那份东西是谁留的**：某个人特意留给另一个人的。留东西本身是一份人情；这份人情是当着人留的，所以全屋都知道它该给谁。\n\n**老的是谁**：从前管过这家、如今已经退了的人。她不是来闹事的，她是来让人记得她的；一句话没人接，她就要自己给自己找回一点分量。\n\n**她为什么非要吃**：那份东西是明摆着的——“有人比我更被看重”。她吃的不是东西，是那个位置。所以劝的人越多，她越要吃。\n\n**这是哪**：任何有“老人、旧人、退下来的人”的地方：老宅、老厂、老单位、家族、球队。只要一个人还在指望别人记得他，这张卡就成立。\n\n**注意**：卡停在“全吃了，走了”这一刻。不要写这句话后来有没有人提，也不要写被留下东西的那个人回来怎么说。吃的东西是明说的事件，不能只写成一句脸色。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是在场的人——分东西的那个、被留下东西的那个，也可能是主事的人，回来才知道自己那份没了；也可以不在场，事后听说家里为一口吃食闹了一场。"
      },
      {
        "key": "那份东西是谁留的",
        "value": "某个人特意留给另一个人的。留东西本身是一份人情；这份人情是当着人留的，所以全屋都知道它该给谁。"
      },
      {
        "key": "老的是谁",
        "value": "从前管过这家、如今已经退了的人。她不是来闹事的，她是来让人记得她的；一句话没人接，她就要自己给自己找回一点分量。"
      },
      {
        "key": "她为什么非要吃",
        "value": "那份东西是明摆着的——“有人比我更被看重”。她吃的不是东西，是那个位置。所以劝的人越多，她越要吃。"
      },
      {
        "key": "这是哪",
        "value": "任何有“老人、旧人、退下来的人”的地方：老宅、老厂、老单位、家族、球队。只要一个人还在指望别人记得他，这张卡就成立。"
      },
      {
        "key": "注意",
        "value": "卡停在“全吃了，走了”这一刻。不要写这句话后来有没有人提，也不要写被留下东西的那个人回来怎么说。吃的东西是明说的事件，不能只写成一句脸色。"
      }
    ]
  },
  {
    "id": "C19-04-两个口风",
    "number": "C19-04",
    "name": "两个口风",
    "type": "依附 / 要走",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-04-两个口风.md",
    "face": "甲家里有一个跟了很多年的人。这人在甲家里做事，自己的家却在别处。\n\n这一天，甲听见一句：家里打算把他接回去了，明年就办。\n\n甲手里正剥着东西，一下扔下，问：接你回去做什么。那人说：我一家子都在那边，只我一个在这里，总得有个了结。甲一条一条往回想，想能拿什么把人留下——多给钱、去求长辈出面、把话说死。那人一条一条都接了过去，反过来替甲算：这样做，谁也不好看。\n\n甲说不过，最后问了一句：那就是走定了。\n\n那人说：走定了。\n\n那天夜里，甲一个人睡的。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**甲是谁**：甲可以是玩家，也可以是玩家的家人。甲是舍不得这个人、又拿不住这个人的人。\n\n**玩家在哪**：玩家可以是甲，当场听见那句“要接他回去”；可以是那个要被接走的人，看着甲急；也可以不在场，事后听说这个人要走，家里谁都没能留住。\n\n**要走的是谁**：在甲家里做事、从小跟过来、或者在甲身边伺候过不止一代人的人。这个人跟甲的关系比差事更深，所以这句话才重。\n\n**甲和这个人的名分**：一个手里有管人的权，一个没有；年岁未必差多少，甚至未必是年长的那个在管人。恶不在这一处，麻烦在这一处。\n\n**是“家里来接”，还是“他自己要走”**：名义上是家里来接；真正要接的到底是家里缺人，还是他自己有了打算，在这一回里分不出来。这两件事在卡上是同一个口风，算哪一头，看桌上怎么演。\n\n**那句“走定了”之前，那个人在想什么**：可以是真的要走了；也可以是先探一探甲留不留他，把话压住，再往下谈条件。卡面不替这个人说破。\n\n**这是哪**：任何有“雇来的人、跟了很多年的人、寄住的人”的地方：家庭、作坊、公司、师门、船队。\n\n**注意**：卡停在“甲一个人睡的”这一刻。不要写这个人最后走没走，也不要写第二天谈了什么。这一句“走定了”说出来，甲从此就知道这个人随时可以不在。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "甲是谁",
        "value": "甲可以是玩家，也可以是玩家的家人。甲是舍不得这个人、又拿不住这个人的人。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是甲，当场听见那句“要接他回去”；可以是那个要被接走的人，看着甲急；也可以不在场，事后听说这个人要走，家里谁都没能留住。"
      },
      {
        "key": "要走的是谁",
        "value": "在甲家里做事、从小跟过来、或者在甲身边伺候过不止一代人的人。这个人跟甲的关系比差事更深，所以这句话才重。"
      },
      {
        "key": "甲和这个人的名分",
        "value": "一个手里有管人的权，一个没有；年岁未必差多少，甚至未必是年长的那个在管人。恶不在这一处，麻烦在这一处。"
      },
      {
        "key": "是“家里来接”，还是“他自己要走”",
        "value": "名义上是家里来接；真正要接的到底是家里缺人，还是他自己有了打算，在这一回里分不出来。这两件事在卡上是同一个口风，算哪一头，看桌上怎么演。"
      },
      {
        "key": "那句“走定了”之前，那个人在想什么",
        "value": "可以是真的要走了；也可以是先探一探甲留不留他，把话压住，再往下谈条件。卡面不替这个人说破。"
      },
      {
        "key": "这是哪",
        "value": "任何有“雇来的人、跟了很多年的人、寄住的人”的地方：家庭、作坊、公司、师门、船队。"
      },
      {
        "key": "注意",
        "value": "卡停在“甲一个人睡的”这一刻。不要写这个人最后走没走，也不要写第二天谈了什么。这一句“走定了”说出来，甲从此就知道这个人随时可以不在。"
      }
    ]
  },
  {
    "id": "C19-05-三件事",
    "number": "C19-05",
    "name": "三件事",
    "type": "条件 / 约束",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-05-三件事.md",
    "face": "那个要走的人不走了。他说：你要留我，不在这上头。我另说三件事，你依了，我从此哪儿也不去。\n\n甲全应下来，一样样地问：还有第二件？还有第三件？\n\n一件一件，那人说完了：第一条，不许再说自己将来怎么不了的话；第二条，不管真爱念书假爱念书，在长辈跟前要做出个念书的样儿，别背后说别人的不是；第三条，那些见不得光的癖好，一件也不许再有。\n\n甲每听一件都应一声：都改。\n\n最后一句落下来：真都改了，拿大轿来抬，我也不出去。\n\n甲说：你这里待久了，不怕没有大轿坐。\n\n那人说：那个我不稀罕。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**玩家在哪**：玩家可以是给条件的那个人，也可以是全应下来的人——应下来的人心里知道，自己是为了留人而应；给条件的人心里也知道，这一场价钱谈成了。\n\n**这三条为什么是交换**：条件是甲自己愿意给的，也是那个人趁机要的。甲拿这些条件买一个“他不走”；那个人拿这些条件换一个“能管住甲的凭据”。两边都清楚。\n\n**那个人凭什么敢要**：因为刚有个“走”字压着。没有那一场，这三条提不出来。所以这张卡最好接在《两个口风》后面。\n\n**第三条是什么**：不必写细。那是一个“见不得光”的旧毛病——偷着做的小事、爱好的那点东西、戒不掉的瘾、背着人的来往。写成一件可换的实体，不必写成一句评语。\n\n**万一一样也改不成**：那更好。答应下来的事，第二天就会被试出来；这不是这张卡的结尾，是下一张卡的开始。\n\n**这是哪**：任何有“一个想管住另一个”的关系的地方：夫妻、主仆、师徒、搭档、父子。\n\n**注意**：卡停在“那个我不稀罕”这一刻。不要写甲后来改没改、也不写这三条哪天被翻出来对账。这一晚谈成的是一笔交易，不是一次和好。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是给条件的那个人，也可以是全应下来的人——应下来的人心里知道，自己是为了留人而应；给条件的人心里也知道，这一场价钱谈成了。"
      },
      {
        "key": "这三条为什么是交换",
        "value": "条件是甲自己愿意给的，也是那个人趁机要的。甲拿这些条件买一个“他不走”；那个人拿这些条件换一个“能管住甲的凭据”。两边都清楚。"
      },
      {
        "key": "那个人凭什么敢要",
        "value": "因为刚有个“走”字压着。没有那一场，这三条提不出来。所以这张卡最好接在《两个口风》后面。"
      },
      {
        "key": "第三条是什么",
        "value": "不必写细。那是一个“见不得光”的旧毛病——偷着做的小事、爱好的那点东西、戒不掉的瘾、背着人的来往。写成一件可换的实体，不必写成一句评语。"
      },
      {
        "key": "万一一样也改不成",
        "value": "那更好。答应下来的事，第二天就会被试出来；这不是这张卡的结尾，是下一张卡的开始。"
      },
      {
        "key": "这是哪",
        "value": "任何有“一个想管住另一个”的关系的地方：夫妻、主仆、师徒、搭档、父子。"
      },
      {
        "key": "注意",
        "value": "卡停在“那个我不稀罕”这一刻。不要写甲后来改没改、也不写这三条哪天被翻出来对账。这一晚谈成的是一笔交易，不是一次和好。"
      }
    ]
  },
  {
    "id": "C19-06-两个人躺着",
    "number": "C19-06",
    "name": "两个人躺着",
    "type": "相处 / 试探",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-06-两个人躺着.md",
    "face": "午后，屋里只剩两个人。一个要歇着，一个不让他歇，说：白天睡出病来，我陪你说话。\n\n两个人就躺下了，接着递过来一个枕头，对着脸。\n\n甲看见对面那人脸上有一小块红印子，伸手替他擦，顺口说：你又弄这个。这话说完，对面没接。\n\n屋里静了一会儿。甲闻到一股味儿，说不清是什么，不是香饼、香丸、香袋的味儿。他要看，那人就把袖子递过来，说：你闻。\n\n后来那人把话锋一转，说了一句：别人身上有件东西，你就该有另一件去配他。说完自己先笑了。\n\n甲被这句话唬住，伸手去闹他；闹到那人求饶，还改了口，叫了一声好哥哥。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**玩家在哪**：玩家可以是这两个人里的任何一个，当场被问、被逗、被提到那个“配得上”的位置；也可以不在场，事后听人学舌，说那日午后屋里笑了半天。\n\n**这两个人是什么关系**：从小一处长大的、眼下最亲近的两个人。亲近归亲近，名分上是明白的：一个是这家的人，一个是寄在这里的人。那句“配不配”，正踩在这个位置上。\n\n**那句话为什么狠**：不是随口。前头已经有人拿“配不配”说过她；这话她自己拿来当笑话讲，讲一次比一次狠，因为她其实放不下。\n\n**那个味儿是什么**：一个人身上某种说不清的味儿。不是香饼、香丸、香袋那一类的东西。不必解释成什么，留着就够——它是这张卡唯一一件“看得出来、说不出来”的东西。\n\n**闹到哪一步**：只到求饶、改口。别往下写。这一场的好，全在“什么都发生了，什么都没说破”。\n\n**这是哪**：任何有“寄住的人”和“这家的人”的地方：大宅、亲戚家、合住的院子、寄宿的集体。\n\n**注意**：卡停在“叫了一声好哥哥”这一刻。不写谁放了心、谁死了心。这天午后没有一件大事发生，可两个人之间的那个位置，从此有了一点不一样。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是这两个人里的任何一个，当场被问、被逗、被提到那个“配得上”的位置；也可以不在场，事后听人学舌，说那日午后屋里笑了半天。"
      },
      {
        "key": "这两个人是什么关系",
        "value": "从小一处长大的、眼下最亲近的两个人。亲近归亲近，名分上是明白的：一个是这家的人，一个是寄在这里的人。那句“配不配”，正踩在这个位置上。"
      },
      {
        "key": "那句话为什么狠",
        "value": "不是随口。前头已经有人拿“配不配”说过她；这话她自己拿来当笑话讲，讲一次比一次狠，因为她其实放不下。"
      },
      {
        "key": "那个味儿是什么",
        "value": "一个人身上某种说不清的味儿。不是香饼、香丸、香袋那一类的东西。不必解释成什么，留着就够——它是这张卡唯一一件“看得出来、说不出来”的东西。"
      },
      {
        "key": "闹到哪一步",
        "value": "只到求饶、改口。别往下写。这一场的好，全在“什么都发生了，什么都没说破”。"
      },
      {
        "key": "这是哪",
        "value": "任何有“寄住的人”和“这家的人”的地方：大宅、亲戚家、合住的院子、寄宿的集体。"
      },
      {
        "key": "注意",
        "value": "卡停在“叫了一声好哥哥”这一刻。不写谁放了心、谁死了心。这天午后没有一件大事发生，可两个人之间的那个位置，从此有了一点不一样。"
      }
    ]
  },
  {
    "id": "C19-07-编出来的故典",
    "number": "C19-07",
    "name": "编出来的故典",
    "type": "取笑 / 心动",
    "deck": "红楼梦",
    "category": "现实类",
    "chapter": "第十九回",
    "rel": "红楼梦/现实类/第十九回/C19-07-编出来的故典.md",
    "face": "两个人躺着说话。一个问起对方小时候的事、路上的事、老家的事，一件一件问，对方一件也不答。\n\n问的人怕对方睡出病来，说：我讲个故事给你解闷。于是编起来了：某处有座山，山里有个洞，洞里住着一窝耗子；快过节了，洞里短了东西，老耗子派小耗子下山去偷，派到最小最弱的那一个，它说自己有法术，能变作一枚果子，混在果子堆里，一点一点搬空。\n\n讲到这儿，那个躺着的人也听住了，问：后来呢。\n\n讲的人说：小耗子摇身一变，变出来一位小姐。\n\n屋里静了一下。听的人翻身坐起来，按着他拧：我就知道你是编派我。\n\n这时门外进来一个人，笑着说：谁说故典，我也听听。",
    "notes": "**合理化**：先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。\n\n**玩家在哪**：玩家可以是讲故事的那个人（话一出口就收不回）、听故事的那个人（被当场编派）、或者门外进来的那个人（一句话把这个场面钉住）。三种位置都有得应对。\n\n**编派的是什么**：拿听的人的名字、出身或毛病编的一个笑话。听得出的人才听得出；听不出的，只当它是个故事。所以这张卡要成立，桌上得先说定“两个人的名字里有一个能被人拿来做文章的由头”。\n\n**为什么这时候编**：为了让睡着的那个人醒一醒、笑一笑，也为了把刚才那句话岔过去。他不是要伤人，他是没办法正面接那句话。\n\n**门外进来的那个人**：不必是情敌，也不必是坏人。她只是一句话，就把刚才那点私下的东西变成了三个人都能笑的事；同时她顺手递出一个把柄——那个爱讲故事的人，前些日子该记得的事倒忘了。\n\n**这是哪**：任何有“三个人”的地方：家里、宿舍、办公室、同住的院子。第三个人不必是坏人，她只要在场，就够把气氛换掉。\n\n**注意**：卡停在“我也听听”这一刻。不写谁生气、谁放心、谁把这件事记下来。这一场全是玩笑；玩笑里被说破的那一点真心，是这张卡留下的东西。",
    "noteItems": [
      {
        "key": "合理化",
        "value": "先确认这件事在玩家这个世界里说得通——人物、地点、时机都要合理。如果玩家在场不合理，就让他完全不出场，事后从别人口中听说。不要为了把玩家塞进场景而硬编。"
      },
      {
        "key": "玩家在哪",
        "value": "玩家可以是讲故事的那个人（话一出口就收不回）、听故事的那个人（被当场编派）、或者门外进来的那个人（一句话把这个场面钉住）。三种位置都有得应对。"
      },
      {
        "key": "编派的是什么",
        "value": "拿听的人的名字、出身或毛病编的一个笑话。听得出的人才听得出；听不出的，只当它是个故事。所以这张卡要成立，桌上得先说定“两个人的名字里有一个能被人拿来做文章的由头”。"
      },
      {
        "key": "为什么这时候编",
        "value": "为了让睡着的那个人醒一醒、笑一笑，也为了把刚才那句话岔过去。他不是要伤人，他是没办法正面接那句话。"
      },
      {
        "key": "门外进来的那个人",
        "value": "不必是情敌，也不必是坏人。她只是一句话，就把刚才那点私下的东西变成了三个人都能笑的事；同时她顺手递出一个把柄——那个爱讲故事的人，前些日子该记得的事倒忘了。"
      },
      {
        "key": "这是哪",
        "value": "任何有“三个人”的地方：家里、宿舍、办公室、同住的院子。第三个人不必是坏人，她只要在场，就够把气氛换掉。"
      },
      {
        "key": "注意",
        "value": "卡停在“我也听听”这一刻。不写谁生气、谁放心、谁把这件事记下来。这一场全是玩笑；玩笑里被说破的那一点真心，是这张卡留下的东西。"
      }
    ]
  }
];
  for (const card of cards) Object.freeze(card);
  globalThis.STORY_CARDS_LIBRARY = Object.freeze(cards);
})();


// ===== js/cards.js =====
// ===== 剧情抽卡（Story Cards）卡库层：范围树 / 筛选 / 抽卡 / 抽过不重复 =====
// 卡库数据由构建期生成（js/cards-data.js → globalThis.STORY_CARDS_LIBRARY），
// 运行时只读不改。本层不碰 DOM，纯数据逻辑，便于单测。

// 取卡库；构建产物缺失时返回空数组并告警一次。
let scLibraryWarned = false;
function scGetBuiltinLibrary() {
  const library = globalThis.STORY_CARDS_LIBRARY;
  if (Array.isArray(library)) return library;
  if (!scLibraryWarned) {
    scLibraryWarned = true;
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 卡库数据缺失（js/cards-data.js 未生成？），请运行 node build.js`);
  }
  return [];
}

// 玩家在面板里加载的卡牌（存在设置里，随酒馆设置持久化）。
function scGetCustomCards() {
  const settings = scGetSettings();
  return Array.isArray(settings.customCards) ? settings.customCards : [];
}

// 合并卡库：内置 + 玩家加载，同 id 时玩家加载的覆盖内置（方便自己改卡面后即时生效）。
// 每次调用都重新合并；调用方（范围树 / 抽卡 / 注入）都走这里，保证三处永远同一份视图。
function scGetLibrary() {
  const custom = scGetCustomCards();
  if (custom.length === 0) return scGetBuiltinLibrary();
  const merged = new Map();
  for (const card of scGetBuiltinLibrary()) merged.set(card.id, card);
  for (const card of custom) merged.set(card.id, card);
  return Array.from(merged.values());
}

// 归一化一张待写入的卡：字段缺一不可，deck/category/chapter 为空的直接丢弃。
function scNormalizeCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id == null ? '' : raw.id).trim();
  const deck = String(raw.deck == null ? '' : raw.deck).trim();
  const category = String(raw.category == null ? '' : raw.category).trim();
  const chapter = String(raw.chapter == null ? '' : raw.chapter).trim();
  if (!id || !deck || !category || !chapter) return null;
  return {
    id,
    number: String(raw.number == null ? '' : raw.number).trim(),
    name: String(raw.name == null ? '' : raw.name).trim() || id,
    type: String(raw.type == null ? '' : raw.type).trim(),
    deck,
    category,
    chapter,
    rel: String(raw.rel == null ? '' : raw.rel),
    face: String(raw.face == null ? '' : raw.face),
    notes: String(raw.notes == null ? '' : raw.notes),
    noteItems: Array.isArray(raw.noteItems)
      ? raw.noteItems.map((item) => ({ key: String(item?.key || ''), value: String(item?.value || '') }))
      : [],
    custom: true,
  };
}

// 把一批解析好的卡写入设置（按 id 去重，后写覆盖先写）。
// 返回 { added, replaced, total, truncated }，供 UI 如实汇报。
function scAddCustomCards(cards) {
  const incoming = [];
  for (const raw of Array.isArray(cards) ? cards : []) {
    const card = scNormalizeCard(raw);
    if (card) incoming.push(card);
  }
  const settings = scGetSettings();
  const existing = new Map();
  for (const card of scGetCustomCards()) {
    const normalized = scNormalizeCard(card);
    if (normalized) existing.set(normalized.id, normalized);
  }
  let added = 0;
  let replaced = 0;
  for (const card of incoming) {
    if (existing.has(card.id)) replaced += 1;
    else added += 1;
    existing.set(card.id, card);
  }
  let list = Array.from(existing.values());
  let truncated = 0;
  if (list.length > SC_CUSTOM_CARDS_LIMIT) {
    truncated = list.length - SC_CUSTOM_CARDS_LIMIT;
    list = list.slice(list.length - SC_CUSTOM_CARDS_LIMIT);
  }
  settings.customCards = list;
  scSaveSettings();
  return { added, replaced, total: list.length, truncated };
}

// 清空玩家加载的卡牌，回到「只有构建期卡库」的状态。返回清掉的张数。
function scClearCustomCards() {
  const settings = scGetSettings();
  const count = scGetCustomCards().length;
  settings.customCards = [];
  scSaveSettings();
  return count;
}

// ---------- 范围树 ----------
// 三层：卡组 → 分类 → 回目。每个节点带 own 张数与含子树的 total 张数，
// 供 UI 显示「红楼梦（138）」这类计数，也让玩家知道勾完能抽到多少张。
function scBuildScopeTree() {
  const decks = new Map();
  for (const card of scGetLibrary()) {
    const deckName = String(card.deck || '未分组');
    const categoryName = String(card.category || '未分类');
    const chapterName = String(card.chapter || '未分回');
    if (!decks.has(deckName)) decks.set(deckName, { name: deckName, total: 0, categories: new Map() });
    const deck = decks.get(deckName);
    if (!deck.categories.has(categoryName)) deck.categories.set(categoryName, { name: categoryName, total: 0, chapters: new Map() });
    const category = deck.categories.get(categoryName);
    if (!category.chapters.has(chapterName)) category.chapters.set(chapterName, { name: chapterName, total: 0, cards: [] });
    const chapter = category.chapters.get(chapterName);
    chapter.cards.push(card);
    chapter.total += 1;
    category.total += 1;
    deck.total += 1;
  }
  return Array.from(decks.values()).map((deck) => ({
    name: deck.name,
    total: deck.total,
    categories: Array.from(deck.categories.values()).map((category) => ({
      name: category.name,
      total: category.total,
      chapters: Array.from(category.chapters.values()),
    })),
  }));
}

// 叶子键：卡组 / 分类 / 回目 三段拼成稳定字符串，作为 selectedLeaves 的键。
function scLeafKey(deck, category, chapter) {
  return [deck, category, chapter].map((part) => String(part == null ? '' : part)).join('\u0001');
}

// 一个叶子（回目）是否被勾选。
function scIsLeafSelected(settings, deck, category, chapter) {
  const deckSel = settings.selectedLeaves?.[deck];
  const categorySel = deckSel?.[category];
  return Boolean(categorySel && categorySel[chapter]);
}

// 勾选 / 取消一个叶子。
function scSetLeafSelected(settings, deck, category, chapter, selected) {
  if (!settings.selectedLeaves || typeof settings.selectedLeaves !== 'object') settings.selectedLeaves = {};
  const leaves = settings.selectedLeaves;
  if (selected) {
    if (!leaves[deck]) leaves[deck] = {};
    if (!leaves[deck][category]) leaves[deck][category] = {};
    leaves[deck][category][chapter] = true;
    return;
  }
  if (leaves[deck]?.[category]) {
    delete leaves[deck][category][chapter];
    if (Object.keys(leaves[deck][category]).length === 0) delete leaves[deck][category];
    if (Object.keys(leaves[deck]).length === 0) delete leaves[deck];
  }
}

// 节点级批量勾选 / 取消：把子树里所有叶子一起改。
function scSetSubtreeSelected(settings, deck, category, chapters, selected) {
  for (const chapter of chapters) {
    scSetLeafSelected(settings, deck, category, chapter, selected);
  }
}

// 勾选态三态：'all' 全选 / 'none' 全不选 / 'partial' 部分选中。
function scSelectionState(selectedCount, totalCount) {
  if (totalCount <= 0 || selectedCount <= 0) return 'none';
  if (selectedCount >= totalCount) return 'all';
  return 'partial';
}

// 范围统计：勾了几个叶子、覆盖多少张卡。
function scSummarizeSelection(settings) {
  const tree = scBuildScopeTree();
  let selectedCards = 0;
  let totalCards = 0;
  let selectedLeaves = 0;
  let totalLeaves = 0;
  for (const deck of tree) {
    for (const category of deck.categories) {
      for (const chapter of category.chapters) {
        totalLeaves += 1;
        totalCards += chapter.total;
        if (scIsLeafSelected(settings, deck.name, category.name, chapter.name)) {
          selectedLeaves += 1;
          selectedCards += chapter.total;
        }
      }
    }
  }
  return { selectedLeaves, totalLeaves, selectedCards, totalCards, tree };
}

// ---------- 抽卡范围 ----------
// 勾了回目 → 只在这些回目里抽；一个都没勾 → 全库随机（并提示玩家）。
function scFilterBySelection(settings) {
  const library = scGetLibrary();
  const anyLeaf = Object.values(settings.selectedLeaves || {}).some(
    (categories) => Object.values(categories || {}).some((chapters) => Object.keys(chapters || {}).length > 0),
  );
  if (!anyLeaf) return { cards: library.slice(), unrestricted: true };
  const cards = library.filter((card) => scIsLeafSelected(settings, card.deck, card.category, card.chapter));
  return { cards, unrestricted: false };
}

// ---------- 抽过不重复 ----------
// 记录按聊天分区存在 chatMetadata 里：{ [chatId]: { [cardId]: ISO 时间 } }。
// chatId 取不到时用固定分区名兜底（单聊天场景照常工作）。
function scGetDrawnMap() {
  const metadata = scGetChatMetadata();
  if (!metadata) return null;
  if (!metadata[SC_CHAT_DRAWN_META_KEY] || typeof metadata[SC_CHAT_DRAWN_META_KEY] !== 'object') {
    metadata[SC_CHAT_DRAWN_META_KEY] = {};
  }
  return metadata[SC_CHAT_DRAWN_META_KEY];
}

function scGetDrawnForChat(chatId) {
  const map = scGetDrawnMap();
  if (!map) return {};
  const key = String(chatId || '__default__');
  if (!map[key] || typeof map[key] !== 'object') map[key] = {};
  return map[key];
}

function scCountDrawnInScope(cards, drawn) {
  let count = 0;
  for (const card of cards) {
    if (drawn[card.id]) count += 1;
  }
  return count;
}

// 把一张卡记入「已抽」。
function scRecordDrawn(card, chatId) {
  const drawn = scGetDrawnForChat(chatId);
  drawn[card.id] = new Date().toISOString();
  scSaveChatMetadata();
}

// 清空当前聊天的抽卡记录。
function scResetDrawn(chatId) {
  const map = scGetDrawnMap();
  if (!map) return 0;
  const key = String(chatId || '__default__');
  const previous = map[key] && typeof map[key] === 'object' ? Object.keys(map[key]).length : 0;
  map[key] = {};
  scSaveChatMetadata();
  return previous;
}

// ---------- 抽卡 ----------
// 返回 { card, pool, candidates, drawnInPool, exhausted, unrestricted }：
// - pool：当前勾选范围内的全部卡；
// - candidates：本轮真正参与随机的卡（开了「抽过不重复」时已剔除抽过的）；
// - exhausted：范围内都抽过了（此时回退到全范围重抽，并在 UI 上说明）。
function scDrawCard(settings, chatId) {
  const { cards: pool, unrestricted } = scFilterBySelection(settings);
  const drawn = scGetDrawnForChat(chatId);
  const avoidRepeat = settings.avoidRepeat !== false;
  const drawnInPool = scCountDrawnInScope(pool, drawn);
  let candidates = pool;
  let exhausted = false;
  if (avoidRepeat && pool.length > 0) {
    const fresh = pool.filter((card) => !drawn[card.id]);
    if (fresh.length > 0) {
      candidates = fresh;
    } else {
      // 范围内抽完了：不再空手而归，退回全范围重抽（允许重复），由 UI 明确告知。
      candidates = pool;
      exhausted = true;
    }
  }
  if (candidates.length === 0) {
    return { card: null, pool, candidates, drawnInPool, exhausted, unrestricted };
  }
  const index = Math.floor(Math.random() * candidates.length);
  return {
    card: candidates[index],
    pool,
    candidates,
    drawnInPool,
    exhausted,
    unrestricted,
  };
}

// 抽卡后落账：记入已抽 + 存本轮记录（供重新生成时重放注入）。
function scCommitDraw(card, chatId) {
  if (!card) return;
  scRecordDrawn(card, chatId);
  globalThis[SC_LAST_DRAW_KEY] = {
    cardId: card.id,
    cardName: card.name,
    chatId: String(chatId || ''),
    at: new Date().toISOString(),
  };
}


// ===== js/card-load.js =====
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


// ===== js/inject.js =====
// ===== 剧情抽卡（Story Cards）注入层：把抽到的卡拼成系统导演注，塞进提示词 =====
// 注入形态与 Kaleidoscope 的 <Story_Event> 同构：明确告知主模型「这不是剧情正文，
// 也不是任何角色的台词」，并给出不可弃用的强制执行规则，消除「与设定冲突可弃用」
// 「仅供参考」这类让主模型跳过本块的漏洞。
//
// 时机：点「剧情抽卡」时先把注入写进宿主槽位，再填输入框并发出去。宿主的发送流程是
// 「messageSent → 组装主请求 prompt」，所以注入必然赶在主请求之前生效。
// 清理：generationEnded / generationStopped 后清空；重新生成时重放（见 main.js）。

// 卡面正文：原文照用（保留分行），只做首尾空白与多余空行归一。
function scBuildCardFaceText(card) {
  return scNormalizeText(card?.face);
}

// 注意事项：逐条「**键**：值」列成清单，明确标注这是「落地调整规则」而非正文。
// 这一段的用途是让卡面里的「甲」「那两个人」在具体世界观里落地，必须一起带上。
function scBuildCardNotesText(card) {
  const items = Array.isArray(card?.noteItems) ? card.noteItems : [];
  if (items.length === 0) return scNormalizeText(card?.notes);
  const lines = [];
  for (const item of items) {
    const key = scNormalizeText(item?.key);
    const value = scNormalizeText(item?.value);
    if (!key) continue;
    lines.push(value ? `- 【${key}】${value}` : `- 【${key}】`);
  }
  return lines.join('\n');
}

// 拼注入块。结构与措辞参考 Kaleidoscope 的 buildStoryGateInjectionText，
// 但这里是「玩家手动抽卡」，所以强调「玩家主动抽到的事件」这一来源。
function scBuildInjectionText(card) {
  const lines = [
    '<Story_Card_Draw>',
    '【系统导演注 · 强制指令】本块不是剧情正文，也不是任何角色的台词、旁白或可引用文本；它是玩家刚刚主动「剧情抽卡」抽到的一张剧情卡。以下规则必须逐条执行，不得忽略、不得淡化，不得以任何理由整体弃用。',
    '',
    '执行规则：',
    '1. 直接驱动：本卡的卡面内容必须真实落地到接下来的剧情中（对象、方式、时机都要兑现）；禁止敷衍带过、写与本卡无关的日常。',
    '2. 自然衔接：卡面内容要与当前对话无缝衔接，作为剧情的一部分自然发生，不得生硬插入，也不得让角色复述本块原文。',
    '3. 落地调整：下面的「注意事项」是这张卡在本世界观里的落地说明（人物替换、合理化、边界与禁忌），按它把卡面落到当前设定上。',
    '4. 冲突裁决：若卡面内容与已发生剧情冲突，保留卡的意图，改用符合当前剧情的方式表达；不得整段弃用，也不得以「与设定不符」为由跳过本指令。',
    '5. 优先级：在接下来的剧情中，若与你对剧情走向的一般印象或惯性理解冲突，以本段为准。',
    '',
    `<card id="${String(card?.id || '')}" name="${String(card?.name || '')}"${card?.type ? ` type="${String(card.type)}"` : ''}${card?.category ? ` category="${String(card.category)}"` : ''}>`,
  ];
  const face = scBuildCardFaceText(card);
  if (face) {
    lines.push('卡面：');
    lines.push(face);
  }
  const notes = scBuildCardNotesText(card);
  if (notes) {
    lines.push('');
    lines.push('注意事项（落地调整规则）：');
    lines.push(notes);
  }
  lines.push('</card>');
  lines.push('</Story_Card_Draw>');
  return lines.join('\n');
}

// 写入宿主注入槽位。宿主不支持 setExtensionPrompt 时返回 false（调用方负责提示）。
function scApplyInjection(card, ctx) {
  const api = scGetExtensionPromptApi(ctx);
  if (!api) return false;
  try {
    const text = scBuildInjectionText(card);
    // 先清空再写入：宿主按 key 覆盖，但先清一次能保证旧轮的长文本不会残留尾巴。
    api.setExtensionPrompt(SC_INJECT_KEY, '', api.inChat, SC_INJECT_DEPTH);
    api.setExtensionPrompt(SC_INJECT_KEY, text, api.inChat, SC_INJECT_DEPTH, false, api.systemRole);
    return true;
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 写入提示词注入失败`, error);
    return false;
  }
}

// 清空注入槽位。
function scClearInjection(ctx) {
  const api = scGetExtensionPromptApi(ctx);
  if (!api) return;
  try {
    api.setExtensionPrompt(SC_INJECT_KEY, '', api.inChat, SC_INJECT_DEPTH);
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 清理提示词注入失败`, error);
  }
}

// 重新生成（retry）重放：宿主 retry 不发 messageSent，但上一轮抽到的卡不变，
// 因此不重新抽卡，只按本轮记录重建同一张卡的注入。
// 校验：开关无、记录在、卡还在卡库里、且仍是同一聊天。
function scReplayInjectionForRetry(ctx) {
  const record = globalThis[SC_LAST_DRAW_KEY];
  if (!record || !record.cardId) return false;
  if (record.chatId && scGetChatId() && String(record.chatId) !== String(scGetChatId())) return false;
  const card = scGetLibrary().find((item) => item.id === record.cardId);
  if (!card) return false;
  if (!scApplyInjection(card, ctx)) return false;
  scLogInfo('重新生成：已重放上一轮抽到的卡', card.name);
  return true;
}


// ===== js/send.js =====
// ===== 剧情抽卡（Story Cards）发送层：填输入框 + 立刻发送 =====
// 目标：点一下「剧情抽卡」，把触发短语填进玩家输入框并立即发出去，让宿主的正常
// 发送流程接管（messageSent → 组装主请求 prompt → 生成）。刻意不走 Generate()
// 直连生成：那条路不发 messageSent、不落玩家楼层，等于绕过了玩家自己的发送链路。
//
// 兼容性：宿主没有公开「发送」函数（getContext 不导出 sendTextareaMessage），
// 因此按可靠性从高到低依次尝试，并用「chat 是否变长」确认到底有没有发出去。

// 第 1 招：宿主若把发送函数挂在 context 上，直接用（最干净）。
function scSendViaContext(ctx) {
  if (typeof ctx?.sendTextareaMessage === 'function') {
    ctx.sendTextareaMessage();
    return 'context.sendTextareaMessage';
  }
  return '';
}

// 第 2 招：点发送按钮（玩家路径，最贴近真人操作）。
function scSendViaButton() {
  const button = scEl('send_but');
  if (!button) return '';
  if (button.offsetParent === null && button.getClientRects().length === 0) return '';
  button.click();
  return 'send_but.click';
}

// 第 3 招：在输入框里敲回车（SillyTavern 绑定的发送手势）。
function scSendViaEnter() {
  const textarea = scGetTextarea();
  if (!textarea) return '';
  const options = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  try {
    textarea.dispatchEvent(new KeyboardEvent('keydown', options));
  } catch (error) {
    const event = document.createEvent('KeyboardEvent');
    event.initKeyboardEvent('keydown', true, true, globalThis, 'Enter', 13);
    textarea.dispatchEvent(event);
  }
  return 'send_textarea.Enter';
}

// 等宿主把消息提交进 chat（条数变多即成功）。宿主 context 读不到 chat 时
// 回退用「输入框是否被清空」判断。
async function scConfirmSend(beforeLength, timeoutMs) {
  const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || SC_SEND_CONFIRM_TIMEOUT_MS);
  while (Date.now() < deadline) {
    await scSleep(SC_SEND_CONFIRM_INTERVAL_MS);
    const length = scGetChatLength();
    if (beforeLength >= 0 && length > beforeLength) return true;
    if (beforeLength < 0) {
      const textarea = scGetTextarea();
      if (textarea && !String(textarea.value || '').trim()) return true;
    }
  }
  return false;
}

// 填输入框：设置 value 后补发 input 事件，让宿主的输入监听（自动补全 / 字数统计）跟上。
function scFillTextarea(text) {
  const textarea = scGetTextarea();
  if (!textarea) return false;
  textarea.value = String(text == null ? '' : text);
  try {
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (error) {
    /* 事件发不出去不影响 value 本身 */
  }
  try {
    textarea.focus();
  } catch (error) {
    /* 忽略 */
  }
  return true;
}

// 主入口：填触发短语 → 发送 → 确认。
// 返回 { ok, strategy, reason }；reason 供 UI 显示失败原因。
async function scFillAndSend(triggerText) {
  const ctx = scGetContextSafe();
  if (!ctx) return { ok: false, strategy: '', reason: '读不到宿主上下文' };
  if (scIsGenerating()) return { ok: false, strategy: '', reason: '正在生成中，等这轮结束再抽' };
  const textarea = scGetTextarea();
  if (!textarea) return { ok: false, strategy: '', reason: '找不到输入框 #send_textarea' };
  if (!scFillTextarea(triggerText)) return { ok: false, strategy: '', reason: '写入输入框失败' };
  await scSleep(SC_SEND_SETTLE_MS);

  const beforeLength = scGetChatLength();
  const strategies = [scSendViaContext, scSendViaButton, scSendViaEnter];
  for (const strategy of strategies) {
    let name = '';
    try {
      name = strategy(ctx) || '';
    } catch (error) {
      console.warn(`[${SC_MODULE_DISPLAY_NAME}] 发送策略失败`, error);
      name = '';
    }
    if (!name) continue;
    if (await scConfirmSend(beforeLength, SC_SEND_CONFIRM_TIMEOUT_MS)) {
      return { ok: true, strategy: name, reason: '' };
    }
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 发送策略 ${name} 未生效，尝试下一招`);
  }

  // 全部失败：把输入框清干净，别把触发短语留在那里干扰玩家。
  if (scGetTextarea() && String(scGetTextarea().value || '').trim() === String(triggerText || '').trim()) {
    scFillTextarea('');
  }
  return { ok: false, strategy: '', reason: '没能让宿主发出去（可手动按发送键）' };
}


// ===== js/ui-shell.js =====
// ===== 剧情抽卡（Story Cards）UI 层：悬浮按钮 + 面板（范围树 / 抽卡按钮 / 结果） =====
// 面板刻意做小：选范围 → 点抽卡 → 看结果。抽到就立刻填输入框并发出去。

// 展开态是纯 UI 状态，不进设置：重渲染（勾选变化触发）时保持玩家的展开/收起。
const scExpandedDecks = new Set();

function scToggleDeckExpanded(deckName) {
  if (scExpandedDecks.has(deckName)) scExpandedDecks.delete(deckName);
  else scExpandedDecks.add(deckName);
  scRenderScopeTree();
}

// 点行空白处才展开/收起；点在勾选框、展开箭头这类控件上时不重复触发。
// 勾选框自己会 stopPropagation，这里是双保险（宿主 / 浏览器差异）。
function scIsInteractiveTarget(event) {
  const target = event && event.target;
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('input, button, select, textarea, a, label'));
}

function scIsPanelOpen() {
  const panel = scEl(SC_PANEL_ID);
  return Boolean(panel && panel.classList.contains('sc-panel--open'));
}

function scOpenPanel() {
  const panel = scEl(SC_PANEL_ID);
  if (!panel) return;
  panel.classList.add('sc-panel--open');
  panel.setAttribute('aria-hidden', 'false');
  scRenderScopeTree();
}

function scClosePanel() {
  const panel = scEl(SC_PANEL_ID);
  if (!panel) return;
  panel.classList.remove('sc-panel--open');
  panel.setAttribute('aria-hidden', 'true');
}

function scTogglePanel() {
  if (scIsPanelOpen()) scClosePanel();
  else scOpenPanel();
}

// ---------- 面板骨架 ----------
function scCreatePanel() {
  if (scEl(SC_PANEL_ID)) return;
  const panel = scCreate('div', 'sc-panel');
  panel.id = SC_PANEL_ID;
  panel.setAttribute('aria-hidden', 'true');

  const header = scCreate('div', 'sc-panel__header');
  const title = scCreate('div', 'sc-panel__title', SC_MODULE_DISPLAY_NAME);
  const titleIcon = scCreate('i', SC_DRAW_ICON_CLASS);
  title.prepend(titleIcon);
  const headerActions = scCreate('div', 'sc-panel__header-actions');
  const resetButton = scCreate('button', 'sc-icon-button', '重置记录');
  resetButton.type = 'button';
  resetButton.title = '清空当前聊天的「抽过不重复」记录';
  resetButton.addEventListener('click', () => scHandleResetDrawn());
  const closeButton = scCreate('button', 'sc-icon-button sc-icon-button--close', '×');
  closeButton.type = 'button';
  closeButton.title = '关闭';
  closeButton.addEventListener('click', () => scClosePanel());
  headerActions.appendChild(resetButton);
  headerActions.appendChild(closeButton);
  header.appendChild(title);
  header.appendChild(headerActions);
  panel.appendChild(header);

  const body = scCreate('div', 'sc-panel__body');

  // 加载卡牌：把磁盘上的卡牌文件夹 / .md 文件临时并进卡库（存在设置里，随酒馆设置持久化）。
  const cardSection = scCreate('div', 'sc-cards');
  const cardRow = scCreate('div', 'sc-cards__row');
  const loadButton = scCreate('button', 'sc-button sc-button--primary');
  loadButton.id = SC_LOAD_CARDS_BUTTON_ID;
  loadButton.type = 'button';
  loadButton.innerHTML = '<i class="fa-solid fa-folder-open"></i><span>加载卡牌</span>';
  loadButton.title = '选择一个卡牌文件夹（<卡组>/<分类>/<回目>/*.md）或一批 .md 文件，解析后并入卡库';
  loadButton.addEventListener('click', () => { void scHandleLoadCards(); });
  const clearButton = scCreate('button', 'sc-button', '移除加载');
  clearButton.id = SC_CLEAR_CARDS_BUTTON_ID;
  clearButton.type = 'button';
  clearButton.title = '移除通过「加载卡牌」并入的卡牌，回到构建期卡库';
  clearButton.addEventListener('click', () => scHandleClearCustomCards());
  cardRow.appendChild(loadButton);
  cardRow.appendChild(clearButton);
  const cardStatus = scCreate('div', 'sc-cards__status');
  cardStatus.id = SC_CARD_STATUS_ID;
  cardSection.appendChild(cardRow);
  cardSection.appendChild(cardStatus);
  body.appendChild(cardSection);

  const scopeTitle = scCreate('div', 'sc-panel__section-title', '抽卡范围');
  const scopeHint = scCreate('div', 'sc-panel__hint', '勾选要抽的回目（可多选，父级勾选即整片勾上）。一个都不勾 = 全库随机。');
  const tree = scCreate('div', 'sc-tree');
  tree.id = SC_SCOPE_TREE_ID;
  body.appendChild(scopeTitle);
  body.appendChild(scopeHint);
  body.appendChild(tree);

  const summary = scCreate('div', 'sc-summary');
  summary.id = SC_SUMMARY_ID;
  body.appendChild(summary);

  // 「抽过不重复」开关：范围内抽完会提示并允许重复，不会空手而归。
  const options = scCreate('label', 'sc-option');
  const avoidRepeatBox = scCreate('input', 'sc-option__checkbox');
  avoidRepeatBox.type = 'checkbox';
  avoidRepeatBox.id = SC_AVOID_REPEAT_ID;
  avoidRepeatBox.addEventListener('change', () => {
    const settings = scGetSettings();
    settings.avoidRepeat = Boolean(avoidRepeatBox.checked);
    scSaveSettings();
    scRefreshSummary();
  });
  options.appendChild(avoidRepeatBox);
  options.appendChild(scCreate('span', 'sc-option__label', '抽过不重复'));
  options.title = '同一个聊天里不重复抽同一张卡；范围内抽完会提示并允许重复';
  body.appendChild(options);

  const drawButton = scCreate('button', 'sc-draw-button');
  drawButton.id = SC_DRAW_BUTTON_ID;
  drawButton.type = 'button';
  const drawIcon = scCreate('i', SC_DRAW_ICON_CLASS);
  const drawLabel = scCreate('span', '', '剧情抽卡');
  drawButton.appendChild(drawIcon);
  drawButton.appendChild(drawLabel);
  drawButton.addEventListener('click', () => scHandleDraw());
  body.appendChild(drawButton);

  const result = scCreate('div', 'sc-result');
  result.id = SC_RESULT_ID;
  body.appendChild(result);

  panel.appendChild(body);
  document.body.appendChild(panel);
}

// ---------- 悬浮按钮（可自由拖动） ----------
// 位置存在设置里（floatX / floatY，视口坐标），拖动后自动落盘，重启还在原处。
// 拖动与点击的区分：位移超过阈值才算拖动，否则当点击处理（打开面板）。
// 用 Pointer Events 统一鼠标 / 触摸 / 触控笔，配合 style.css 里的 touch-action: none。

let scFloatDrag = null;
let scFloatDidDrag = false;

function scViewportSize() {
  const width = Number(globalThis.innerWidth) || 0;
  const height = Number(globalThis.innerHeight) || 0;
  return { width: width || 1280, height: height || 720 };
}

// 把坐标夹在视口内，保证按钮永远完整可见、可拖。
function scClampFloatPosition(x, y) {
  const viewport = scViewportSize();
  const maxX = Math.max(SC_FLOAT_MARGIN, viewport.width - SC_FLOAT_SIZE - SC_FLOAT_MARGIN);
  const maxY = Math.max(SC_FLOAT_MARGIN, viewport.height - SC_FLOAT_SIZE - SC_FLOAT_MARGIN);
  const minX = SC_FLOAT_MARGIN;
  const minY = SC_FLOAT_MARGIN;
  return {
    x: Math.min(Math.max(Number(x) || 0, minX), maxX),
    y: Math.min(Math.max(Number(y) || 0, minY), maxY),
  };
}

function scApplyFloatPosition(x, y) {
  const button = scEl(SC_FLOATING_BUTTON_ID);
  if (!button) return null;
  const clamped = scClampFloatPosition(x, y);
  button.style.left = clamped.x + 'px';
  button.style.top = clamped.y + 'px';
  // 定位改用 left/top 后必须清掉 right/bottom，否则两者会互相打架。
  button.style.right = 'auto';
  button.style.bottom = 'auto';
  return clamped;
}

// 默认位置：右下角（与 style.css 的默认值一致，但这里算成具体坐标，方便拖动接管）。
function scDefaultFloatPosition() {
  const viewport = scViewportSize();
  return scClampFloatPosition(
    viewport.width - SC_FLOAT_SIZE - 16,
    viewport.height - SC_FLOAT_SIZE - 92,
  );
}

function scRestoreFloatPosition() {
  const settings = scGetSettings();
  const fallback = scDefaultFloatPosition();
  const x = Number.isFinite(settings.floatX) ? settings.floatX : fallback.x;
  const y = Number.isFinite(settings.floatY) ? settings.floatY : fallback.y;
  scApplyFloatPosition(x, y);
}

function scEndFloatDrag(pointerId) {
  const button = scEl(SC_FLOATING_BUTTON_ID);
  if (button && pointerId !== undefined && button.releasePointerCapture) {
    try {
      button.releasePointerCapture(pointerId);
    } catch (error) { /* 没捕获过就忽略 */ }
  }
  // 落盘：拖动结束后才写设置，拖动过程中不刷盘。
  if (scFloatDrag && scFloatDrag.moved) {
    const settings = scGetSettings();
    settings.floatX = scFloatDrag.x;
    settings.floatY = scFloatDrag.y;
    scSaveSettings();
  }
  scFloatDrag = null;
}

function scInstallFloatDrag(button) {
  button.addEventListener('pointerdown', (event) => {
    // 只处理主键（鼠标左键 / 触摸 / 笔）。
    if (event.button !== undefined && event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    scFloatDrag = {
      pointerId: event.pointerId,
      // 指针相对按钮左上角的偏移：拖动时保持这个偏移，按钮不会跳到指针下面。
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      x: rect.left,
      y: rect.top,
      moved: false,
    };
    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch (error) { /* 忽略 */ }
    }
  });

  button.addEventListener('pointermove', (event) => {
    if (!scFloatDrag || event.pointerId !== scFloatDrag.pointerId) return;
    const dx = event.clientX - scFloatDrag.startX;
    const dy = event.clientY - scFloatDrag.startY;
    if (!scFloatDrag.moved && Math.hypot(dx, dy) < SC_FLOAT_DRAG_THRESHOLD) return;
    scFloatDrag.moved = true;
    const next = scApplyFloatPosition(event.clientX - scFloatDrag.offsetX, event.clientY - scFloatDrag.offsetY);
    if (next) {
      scFloatDrag.x = next.x;
      scFloatDrag.y = next.y;
    }
  });

  button.addEventListener('pointerup', (event) => {
    if (!scFloatDrag || event.pointerId !== scFloatDrag.pointerId) return;
    const moved = scFloatDrag.moved;
    scEndFloatDrag(event.pointerId);
    // 拖动过就不要把 pointerup 当成点击（否则拖完会顺手把面板打开）。
    scFloatDidDrag = moved;
  });

  button.addEventListener('pointercancel', (event) => {
    if (!scFloatDrag || event.pointerId !== scFloatDrag.pointerId) return;
    scEndFloatDrag(event.pointerId);
    scFloatDidDrag = false;
  });

  // 键盘可达：Enter / 空格打开面板。
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    scTogglePanel();
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    // 刚拖完的那一次 click 不算点击。
    if (scFloatDidDrag) {
      scFloatDidDrag = false;
      return;
    }
    scTogglePanel();
  });
}

// 悬浮按钮：手机端 / 不想开扩展菜单时的入口。可自由拖动。
function scCreateFloatingButton() {
  if (scEl(SC_FLOATING_BUTTON_ID)) return;
  const button = scCreate('div', 'sc-floating-button');
  button.id = SC_FLOATING_BUTTON_ID;
  button.tabIndex = 0;
  button.title = SC_MODULE_DISPLAY_NAME + '（可拖动）';
  button.innerHTML = `<i class="${SC_DRAW_ICON_CLASS}"></i>`;
  document.body.appendChild(button);
  scInstallFloatDrag(button);
  scRestoreFloatPosition();
  // 窗口尺寸变化后把按钮夹回视口内（横竖屏切换、拉窗口都可能让它跑出去）。
  if (!globalThis[SC_FLOAT_RESIZE_HOOK_KEY] && typeof globalThis.addEventListener === 'function') {
    globalThis[SC_FLOAT_RESIZE_HOOK_KEY] = () => {
      const settings = scGetSettings();
      const current = scEl(SC_FLOATING_BUTTON_ID);
      if (!current) return;
      const fallback = scDefaultFloatPosition();
      const x = Number.isFinite(settings.floatX) ? settings.floatX : fallback.x;
      const y = Number.isFinite(settings.floatY) ? settings.floatY : fallback.y;
      const clamped = scApplyFloatPosition(x, y);
      // 夹过的坐标写回设置，避免下次开窗又跑出去。
      if (clamped && (clamped.x !== settings.floatX || clamped.y !== settings.floatY)) {
        settings.floatX = clamped.x;
        settings.floatY = clamped.y;
        scSaveSettings();
      }
    };
    globalThis.addEventListener('resize', globalThis[SC_FLOAT_RESIZE_HOOK_KEY]);
  }
}

function scApplyFloatingButtonVisibility() {
  const settings = scGetSettings();
  const button = scEl(SC_FLOATING_BUTTON_ID);
  if (!button) return;
  button.style.display = settings.showFloatingButton === false ? 'none' : 'flex';
  // 显示时顺手夹一次位置：按钮隐藏期间视口可能变过。
  if (settings.showFloatingButton !== false) scRestoreFloatPosition();
}

// ---------- 范围树 ----------
// 勾选框刻意**不用 <input type="checkbox">**，改用自绘的 <button role="checkbox">。
//
// 为什么：原生勾选框的「点一下」牵涉浏览器自己的激活行为——先翻转 checked、再派发
// click、再派发 change，而 click 上调用 preventDefault 又会把后面的 change 一起抑制掉。
// 这套时序在不同 webview（Tauri / Chromium / 手机壳）里并不完全一致，之前两版就分别
// 踩在「change 被抑制」和「翻转时序假设」上，表现为点了没反应。
//
// 自绘按钮没有任何原生状态：状态只有一个来源——「重渲染后的设置」。点击 → 直接算出
// 目标状态 → 改设置 → 重渲染。没有时序假设，也没有可以被抑制的默认行为。
// 可访问性用 role="checkbox" + aria-checked="true|false|mixed" 补齐。
function scToggleSymbol(state) {
  if (state === 'all') return '✓';
  if (state === 'partial') return '–';
  return '';
}

// 三态：'all' | 'partial' | 'none'（也可直接传 boolean）。
function scNormalizeToggleState(state) {
  if (state === true) return 'all';
  if (state === false || state === undefined || state === null) return 'none';
  return state;
}

function scBuildCheckbox(state, onToggle, ariaLabel) {
  const current = scNormalizeToggleState(state);
  const wrap = scCreate('label', 'sc-check');
  const box = scCreate('button', 'sc-tree__checkbox');
  box.type = 'button';
  box.dataset.state = current;
  box.setAttribute('role', 'checkbox');
  box.setAttribute('aria-checked', current === 'all' ? 'true' : (current === 'partial' ? 'mixed' : 'false'));
  if (ariaLabel) box.setAttribute('aria-label', ariaLabel);
  box.textContent = scToggleSymbol(current);
  // 测试桥：把状态与切换动作挂到元素上。真实浏览器走下面的 click，不受影响。
  box.__scState = current;
  box.__scToggle = () => onToggle(current !== 'all');
  box.addEventListener('click', (event) => {
    // 阻止冒泡到卡组整块（否则点勾选框会连带展开/收起）。
    event.stopPropagation();
    // label 的默认行为可能转发一次 click，标记一下避免同一次点击被处理两遍。
    if (box.__scJustToggled) {
      box.__scJustToggled = false;
      return;
    }
    box.__scJustToggled = true;
    onToggle(current !== 'all');
  });
  wrap.appendChild(box);
  return wrap;
}

// 统计子树里被勾选的叶子数与总叶子数（回目数）。
function scCountSubtree(settings, deckName, categories) {
  let selected = 0;
  let total = 0;
  for (const category of categories) {
    for (const chapter of category.chapters) {
      total += 1;
      if (scIsLeafSelected(settings, deckName, category.name, chapter.name)) selected += 1;
    }
  }
  return { selected, total };
}

function scRenderScopeTree() {
  const tree = scEl(SC_SCOPE_TREE_ID);
  if (!tree) return;
  const settings = scGetSettings();
  const { tree: scopeTree } = scSummarizeSelection(settings);
  tree.textContent = '';

  if (scopeTree.length === 0) {
    const empty = scCreate('div', 'sc-tree__empty', '卡库是空的。点上面「加载卡牌」选一个卡牌文件夹，或把卡牌放进 cards/<卡组>/<分类>/<回目>/ 后运行 node build.js。');
    tree.appendChild(empty);
    scRefreshSummary();
    return;
  }

  // 默认全部收起，由玩家自己点开（展开态只活在本次会话里）。
  for (const deck of scopeTree) {
    const deckNode = scCreate('div', 'sc-tree__deck');
    const deckRow = scCreate('div', 'sc-tree__row sc-tree__row--deck');
    const expanded = scExpandedDecks.has(deck.name);
    const caret = scCreate('button', 'sc-tree__caret', expanded ? '▾' : '▸');
    caret.type = 'button';
    caret.setAttribute('aria-label', expanded ? '收起' : '展开');
    caret.addEventListener('click', (event) => {
      event.stopPropagation();
      scToggleDeckExpanded(deck.name);
    });
    const deckStats = scCountSubtree(settings, deck.name, deck.categories);
    const deckBox = scBuildCheckbox(
      scSelectionState(deckStats.selected, deckStats.total),
      (checked) => {
        for (const category of deck.categories) {
          scSetSubtreeSelected(settings, deck.name, category.name, category.chapters.map((chapter) => chapter.name), checked);
        }
        scSaveSettings();
        scRenderScopeTree();
      },
      `卡组 ${deck.name}`,
    );
    const deckLabel = scCreate('span', 'sc-tree__label', `${deck.name}`);
    const deckCount = scCreate('span', 'sc-tree__count', `${deckStats.selected}/${deck.total} 回 · ${deck.total} 张`);
    deckRow.appendChild(caret);
    deckRow.appendChild(deckBox);
    deckRow.appendChild(deckLabel);
    deckRow.appendChild(deckCount);
    // 监听挂在「整块」上而不是行上：行只占内容宽度，挂在行上会让右侧空白点不动。
    // 点在勾选框 / 展开箭头这类控件上时不重复触发（勾选框自己也会 stopPropagation）。
    deckNode.addEventListener('click', (event) => {
      if (scIsInteractiveTarget(event)) return;
      scToggleDeckExpanded(deck.name);
    });
    deckNode.appendChild(deckRow);

    if (expanded) {
      for (const category of deck.categories) {
        const categoryNode = scCreate('div', 'sc-tree__category');
        const categoryRow = scCreate('div', 'sc-tree__row sc-tree__row--category');
        const categoryStats = scCountSubtree(settings, deck.name, [category]);
        const categoryBox = scBuildCheckbox(
          scSelectionState(categoryStats.selected, categoryStats.total),
          (checked) => {
            scSetSubtreeSelected(settings, deck.name, category.name, category.chapters.map((chapter) => chapter.name), checked);
            scSaveSettings();
            scRenderScopeTree();
          },
          `分类 ${category.name}`,
        );
        const categoryLabel = scCreate('span', 'sc-tree__label', category.name);
        const categoryCount = scCreate('span', 'sc-tree__count', `${categoryStats.selected}/${category.total} 回 · ${category.total} 张`);
        categoryRow.appendChild(categoryBox);
        categoryRow.appendChild(categoryLabel);
        categoryRow.appendChild(categoryCount);
        categoryNode.appendChild(categoryRow);

        for (const chapter of category.chapters) {
          const chapterRow = scCreate('div', 'sc-tree__row sc-tree__row--chapter');
          const chapterBox = scBuildCheckbox(
            scIsLeafSelected(settings, deck.name, category.name, chapter.name),
            (checked) => {
              scSetLeafSelected(settings, deck.name, category.name, chapter.name, checked);
              scSaveSettings();
              scRenderScopeTree();
            },
            `回目 ${chapter.name}`,
          );
          const chapterLabel = scCreate('span', 'sc-tree__label', chapter.name);
          const chapterCount = scCreate('span', 'sc-tree__count', `${chapter.total} 张`);
          chapterRow.appendChild(chapterBox);
          chapterRow.appendChild(chapterLabel);
          chapterRow.appendChild(chapterCount);
          chapterRow.title = chapter.cards.map((card) => `${card.number || card.id} ${card.name}`).join('\n');
          categoryNode.appendChild(chapterRow);
        }
        deckNode.appendChild(categoryNode);
      }
    }
    tree.appendChild(deckNode);
  }
  scRefreshSummary();
}

function scRefreshSummary() {
  const summary = scEl(SC_SUMMARY_ID);
  if (!summary) return;
  const settings = scGetSettings();
  // 勾选框状态跟设置对齐（设置可能被别处改动）。
  const avoidRepeatBox = scEl(SC_AVOID_REPEAT_ID);
  if (avoidRepeatBox) avoidRepeatBox.checked = settings.avoidRepeat !== false;
  const stats = scSummarizeSelection(settings);
  const chatId = scGetChatId();
  const { cards: pool, unrestricted } = scFilterBySelection(settings);
  const drawn = scGetDrawnForChat(chatId);
  const drawnInPool = scCountDrawnInScope(pool, drawn);
  const remaining = settings.avoidRepeat === false ? pool.length : Math.max(0, pool.length - drawnInPool);
  const scopeText = unrestricted
    ? `全库随机（${pool.length} 张）`
    : `${stats.selectedLeaves}/${stats.totalLeaves} 回 · ${pool.length} 张`;
  summary.textContent = '';
  summary.appendChild(scCreate('span', 'sc-summary__scope', scopeText));
  const remain = scCreate('span', 'sc-summary__remain', `可抽 ${remaining} 张`);
  if (remaining === 0 && pool.length > 0) remain.classList.add('sc-summary__remain--empty');
  summary.appendChild(remain);
}

// ---------- 抽卡 ----------
function scSetResult(kind, text, detail) {
  const result = scEl(SC_RESULT_ID);
  if (!result) return;
  result.textContent = '';
  result.className = 'sc-result' + (kind ? ' sc-result--' + kind : '');
  result.appendChild(scCreate('div', 'sc-result__main', text));
  if (detail) result.appendChild(scCreate('div', 'sc-result__detail', detail));
}

// ---------- 加载卡牌的状态行 ----------
// 状态行有两种内容：操作结果（「加载 138 张…」，要留住）与卡库概况（「卡库 138 张」，
// 随时可重画）。scRenderScopeTree 会反复触发概况重画，所以必须记住当前是不是操作结果，
// 否则操作结果会被概况覆盖掉、玩家根本看不到。
let scCardStatusIsAuto = true;

// kind: 'muted' | 'ok' | 'error'，只影响颜色。
function scSetCardStatus(text, kind) {
  const status = scEl(SC_CARD_STATUS_ID);
  if (!status) return;
  status.textContent = String(text || '');
  status.className = 'sc-cards__status' + (kind ? ' sc-cards__status--' + kind : '');
  scCardStatusIsAuto = false;
}

// 画「卡库 N 张（内置 X + 加载 Y）」概况；正在显示操作结果时不覆盖。
function scRefreshCardStatus(force) {
  const status = scEl(SC_CARD_STATUS_ID);
  if (!status) return;
  if (!force && !scCardStatusIsAuto) return;
  const builtin = scGetBuiltinLibrary().length;
  const custom = scGetCustomCards().length;
  const total = scGetLibrary().length;
  status.textContent = custom > 0
    ? `卡库 ${total} 张（内置 ${builtin} + 加载 ${custom}）`
    : `卡库 ${total} 张`;
  status.className = 'sc-cards__status';
  scCardStatusIsAuto = true;
}

function scSetDrawButtonBusy(busy) {
  const button = scEl(SC_DRAW_BUTTON_ID);
  if (!button) return;
  button.disabled = Boolean(busy);
  button.classList.toggle('sc-draw-button--busy', Boolean(busy));
}

// 抽卡主流程：抽 → 注入 → 填输入框并发出去 → 落账。
async function scHandleDraw() {
  const settings = scGetSettings();
  if (scGetLibrary().length === 0) {
    scSetResult('error', '卡库是空的', '请把卡牌放进 cards/ 后运行 node build.js。');
    scToast('warning', '卡库是空的');
    return;
  }
  if (scIsGenerating()) {
    scSetResult('error', '正在生成中', '等这一轮生成结束再抽卡。');
    scToast('warning', '正在生成中，稍后再抽');
    return;
  }

  const chatId = scGetChatId();
  const outcome = scDrawCard(settings, chatId);
  if (!outcome.card) {
    scSetResult('error', '这个范围里没有卡', '换一个抽卡范围再试。');
    scToast('warning', '这个范围里没有卡');
    return;
  }

  scSetDrawButtonBusy(true);
  try {
    // 1) 先注入，再发送：宿主「messageSent → 组装 prompt」，注入必然赶在主请求前生效。
    const injected = scApplyInjection(outcome.card, scGetContextSafe());
    if (!injected) {
      scSetResult('error', '宿主不支持提示词注入', '抽到的卡无法注入，本轮不发（避免发出一条没有内容的空触发）。');
      scToast('error', '宿主不支持提示词注入（setExtensionPrompt 不可用）');
      return;
    }

    // 2) 填输入框并立刻发送。
    const sendResult = await scFillAndSend(SC_TRIGGER_TEXT);
    if (!sendResult.ok) {
      scClearInjection(scGetContextSafe());
      scSetResult('error', '发送失败', sendResult.reason || '');
      scToast('error', '抽卡发送失败：' + (sendResult.reason || '未知原因'));
      return;
    }

    // 3) 落账：记入「已抽」，并留一份本轮记录供重新生成时重放注入。
    scCommitDraw(outcome.card, chatId);

    const title = `${outcome.card.number || ''} ${outcome.card.name}`.trim();
    const bits = [outcome.card.category, outcome.card.chapter].filter(Boolean).join(' · ');
    const notes = [];
    if (outcome.unrestricted) notes.push('未选范围，全库随机');
    if (outcome.exhausted) notes.push('范围内已抽完，本轮允许重复');
    else if (settings.avoidRepeat !== false) notes.push(`本轮候选 ${outcome.candidates.length} 张`);
    scSetResult('ok', title, [bits, notes.join(' · ')].filter(Boolean).join('　|　'));
    scRefreshSummary();
    // 抽卡后把卡牌状态行切回「卡库概况」：上一句「加载 N 张…」的任务已经完成，
    // 没必要一直占着状态行。
    scRefreshCardStatus(true);
    scLogInfo('已抽卡并发送', { card: title, strategy: sendResult.strategy });
  } finally {
    scSetDrawButtonBusy(false);
  }
}

async function scHandleResetDrawn() {
  const chatId = scGetChatId();
  const count = scResetDrawn(chatId);
  globalThis[SC_LAST_DRAW_KEY] = null;
  scRefreshSummary();
  scSetResult('ok', '抽卡记录已重置', count > 0 ? `清掉 ${count} 张的「已抽」记录` : '本来就没有记录');
  scToast('info', '抽卡记录已重置');
}

// 重新渲染整个面板（设置变化 / 切聊天后调用）。
function scRefreshPanel() {
  scApplyFloatingButtonVisibility();
  if (scIsPanelOpen()) {
    scRenderScopeTree();
  } else {
    scRefreshSummary();
  }
  scRefreshCardStatus(true);
}


// ===== js/main.js =====
// ===== 剧情抽卡（Story Cards）入口：启动 / 菜单注册 / 事件订阅 =====

function scHasMenuEntry() {
  const menu = scEl('extensionsMenu');
  if (!menu) return false;
  return Array.from(menu.children).some((node) => (
    node.id === SC_MENU_ITEM_ID || node.id === SC_MENU_API_ID
      || String(node.textContent || '').trim() === SC_MODULE_DISPLAY_NAME
  ));
}

function scCreateManualMenuItem() {
  if (scHasMenuEntry()) return true;
  const menu = scEl('extensionsMenu');
  if (!menu) return false;
  const item = scCreate('div', 'list-group-item flex-container flexGap5 interactable');
  item.id = SC_MENU_ITEM_ID;
  item.tabIndex = 0;
  item.title = SC_MODULE_DISPLAY_NAME;
  item.innerHTML = `<div class="${SC_MENU_ICON_CLASS} extensionsMenuExtensionButton"></div><span>${SC_MODULE_DISPLAY_NAME}</span>`;
  const activate = (event) => {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    scTogglePanel();
  };
  item.addEventListener('click', activate);
  item.addEventListener('keydown', activate);
  menu.appendChild(item);
  return true;
}

function scEnsureManualMenuItem(retries = SC_MENU_RETRY_COUNT) {
  if (scCreateManualMenuItem()) return;
  if (retries <= 0) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 未找到 #extensionsMenu，无法插入菜单项。`);
    return;
  }
  setTimeout(() => scEnsureManualMenuItem(retries - 1), 500);
}

// 菜单自愈：宿主重建 #extensionsMenu 后重新注入菜单项。
function scEnsureMenuRecovery() {
  const insertRecoveryEntry = () => {
    if (!scCreateManualMenuItem()) return false;
    scEl('extensionsMenuButton')?.style.setProperty('display', 'flex');
    return true;
  };
  insertRecoveryEntry();
  if (globalThis[SC_MENU_RECOVERY_OBSERVER_KEY] || typeof MutationObserver !== 'function' || !document.body) return;
  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    const menuChanged = mutations.some((mutation) => {
      if (mutation.target instanceof Element && mutation.target.id === 'extensionsMenu') return true;
      return Array.from(mutation.addedNodes).some((node) => (
        node instanceof Element && (node.id === 'extensionsMenu' || Boolean(node.querySelector?.('#extensionsMenu')))
      ));
    });
    if (!menuChanged || scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      insertRecoveryEntry();
    }, 0);
  });
  globalThis[SC_MENU_RECOVERY_OBSERVER_KEY] = observer;
  observer.observe(document.body, { childList: true, subtree: true });
}

// 宿主 API 注册菜单项（TauriTavern 支持）；失败则退回手动注入。
async function scRegisterHostMenuItem() {
  const uiApi = globalThis.ST_API?.ui;
  if (typeof uiApi?.registerExtensionsMenuItem !== 'function') return false;
  const result = await uiApi.registerExtensionsMenuItem({
    id: SC_MENU_API_ID,
    label: SC_MODULE_DISPLAY_NAME,
    icon: SC_MENU_ICON_CLASS,
    onClick: () => scTogglePanel(),
  });
  return result !== false;
}

async function scRegisterMenuItem() {
  scEnsureMenuRecovery();
  scEnsureManualMenuItem(SC_MENU_RETRY_COUNT);
  const tauriReady = globalThis.__TAURITAVERN__?.ready || globalThis.__TAURITAVERN_MAIN_READY__;
  if (tauriReady && typeof tauriReady.then === 'function') {
    try {
      await tauriReady;
    } catch (error) {
      console.warn(`[${SC_MODULE_DISPLAY_NAME}] 等待 TauriTavern 宿主就绪失败。`, error);
    }
  }
  let registered = false;
  try {
    registered = await scRegisterHostMenuItem();
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 宿主菜单注册失败，改用手动注入。`, error);
  }
  if (registered) {
    scEl(SC_MENU_ITEM_ID)?.remove();
    scLogInfo('扩展菜单已通过宿主 API 注册');
    return;
  }
  scEnsureManualMenuItem();
  scLogInfo('扩展菜单已注入 #extensionsMenu');
}

// ---------- 宿主事件 ----------
// 生成结束 / 停止 → 清空本轮注入（卡面已经随本轮主请求发出去了，留着只会污染下一轮）。
function scOnGenerationEnded() {
  scClearInjection(scGetContextSafe());
}

// 重新生成（retry）不发 messageSent，注入不会自动重来；同一张卡重放一次。
// 注意：宿主 emit 会 await 监听器，但 onHostEvent 包装器不 await promise，
// 因此重放必须在处理器内同步完成，才能赶在宿主组装主请求 prompt 之前生效。
function scOnGenerationStarted(type) {
  if (type !== 'regenerate' && type !== 'swipe') return;
  scReplayInjectionForRetry(scGetContextSafe());
}

// 切聊天 → 抽卡记录按聊天分区，刷新面板摘要即可（注入槽位由宿主自己清）。
function scOnChatChanged() {
  globalThis[SC_LAST_DRAW_KEY] = null;
  scRefreshPanel();
}

function scInstallHostEventSubscriptions(ctx) {
  scOnHostEvent(ctx, 'generationStarted', scOnGenerationStarted, SC_GEN_STARTED_HANDLER_KEY);
  scOnHostEvent(ctx, 'generationEnded', scOnGenerationEnded, SC_GEN_ENDED_HANDLER_KEY);
  scOnHostEvent(ctx, 'generationStopped', scOnGenerationEnded, SC_GEN_STOPPED_HANDLER_KEY);
  scOnHostEvent(ctx, 'chatChanged', scOnChatChanged, SC_CHAT_CHANGED_HANDLER_KEY);
}

// 事件源自愈看门狗：TauriTavern 在主生成后可能重建 ctx.eventSource，导致 bootstrap 时
// 绑定到旧事件源的订阅成为孤儿。周期对比当前绑定事件源与宿主现时事件源的身份，一旦被换就重挂。
function scStartHostEventWatchdog() {
  if (globalThis[SC_HOST_EVENT_WATCHDOG_KEY]) {
    globalThis.clearInterval?.(globalThis[SC_HOST_EVENT_WATCHDOG_KEY]);
  }
  let boundEventSource = scGetContextSafe()?.eventSource || null;
  globalThis[SC_HOST_EVENT_WATCHDOG_KEY] = globalThis.setInterval(() => {
    try {
      const freshCtx = scGetContextSafe();
      const freshEventSource = freshCtx?.eventSource || null;
      if (boundEventSource && freshEventSource && boundEventSource !== freshEventSource) {
        scLogInfo('宿主事件源已更换，重新绑定事件订阅');
        scInstallHostEventSubscriptions(freshCtx);
        boundEventSource = freshEventSource;
      }
    } catch (error) {
      console.warn(`[${SC_MODULE_DISPLAY_NAME}] 事件源看门狗巡检失败`, error);
    }
  }, SC_HOST_EVENT_WATCHDOG_INTERVAL_MS);
}

async function scBootstrap() {
  if (globalThis[SC_BOOTSTRAP_RUNTIME_KEY]) return;
  const ctx = scGetContextSafe();
  if (!ctx || !document.body) return;
  globalThis[SC_BOOTSTRAP_RUNTIME_KEY] = true;
  try {
    scInstallHostEventSubscriptions(ctx);
    scStartHostEventWatchdog();
    scCreatePanel();
    scCreateFloatingButton();
    scApplyFloatingButtonVisibility();
    scRefreshSummary();
    await scRegisterMenuItem();
    scLogInfo(`扩展就绪 v${SC_MODULE_VERSION}（卡库 ${scGetLibrary().length} 张）`);
  } catch (error) {
    globalThis[SC_BOOTSTRAP_RUNTIME_KEY] = false;
    throw error;
  }
}

scOnHostEvent(scGetContextSafe(), 'appReady', scBootstrap, SC_APP_READY_HANDLER_KEY);

// appReady 可能早于扩展脚本执行完（Kaleidoscope 踩过的坑），加定时兜底重试；
// bootstrap 幂等（全局标记）防止重复执行。
function scScheduleBootstrapFallback(retries = SC_BOOTSTRAP_RETRY_COUNT) {
  const attempt = () => {
    scBootstrap()
      .catch((error) => console.error(`[${SC_MODULE_DISPLAY_NAME}] bootstrap 失败`, error))
      .finally(() => {
        if (!globalThis[SC_BOOTSTRAP_RUNTIME_KEY] && retries > 0) {
          retries -= 1;
          setTimeout(attempt, SC_BOOTSTRAP_RETRY_INTERVAL_MS);
        }
      });
  };
  attempt();
}
scScheduleBootstrapFallback();

