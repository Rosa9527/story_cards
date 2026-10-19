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
