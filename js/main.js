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

// 切聊天 → 抽卡记录按聊天分区，刷新面板摘要即可。
// 注入槽位必须**主动清**：宿主在切聊天时并不保证会清（实测 TauriTavern 里
// CHAT_CHANGED 之后槽位内容原样还在），不清理就会把上一个聊天的卡带进新聊天。
function scOnChatChanged() {
  globalThis[SC_LAST_DRAW_KEY] = null;
  scClearInjection(scGetContextSafe());
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
    scRefreshCardStatus();
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
