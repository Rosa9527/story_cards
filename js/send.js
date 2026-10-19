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
