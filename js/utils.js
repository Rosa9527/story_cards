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
