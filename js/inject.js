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
    scScheduleInjectionExpiry();
    return true;
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 写入提示词注入失败`, error);
    return false;
  }
}

// 兜底过期：正常情况下 generationEnded / generationStopped 会清空槽位。
// 但若宿主压根没开始生成（发送被拦、触发短语没引起生成），就等不到这两个事件，
// 卡面会一直挂在槽位里、被之后某条无关消息带出去。这里到点强制清一次。
function scExpireInjection() {
  globalThis[SC_INJECT_EXPIRY_TIMER_KEY] = null;
  scClearInjection(scGetContextSafe());
  scLogInfo('注入已超时清理（未观察到生成结束事件）');
}

function scScheduleInjectionExpiry() {
  scCancelInjectionExpiry();
  if (typeof setTimeout !== 'function') return;
  globalThis[SC_INJECT_EXPIRY_TIMER_KEY] = setTimeout(scExpireInjection, SC_INJECT_TTL_MS);
}

function scCancelInjectionExpiry() {
  const timer = globalThis[SC_INJECT_EXPIRY_TIMER_KEY];
  if (timer && typeof clearTimeout === 'function') clearTimeout(timer);
  globalThis[SC_INJECT_EXPIRY_TIMER_KEY] = null;
}

// 清空注入槽位。
function scClearInjection(ctx) {
  scCancelInjectionExpiry();
  const api = scGetExtensionPromptApi(ctx);
  if (!api) return;
  try {
    api.setExtensionPrompt(SC_INJECT_KEY, '', api.inChat, SC_INJECT_DEPTH);
  } catch (error) {
    console.warn(`[${SC_MODULE_DISPLAY_NAME}] 清理提示词注入失败`, error);
  }
}

// 重新生成（retry）/ swipe 重放：宿主这两条路不发 messageSent，注入不会自动重来。
// 但重放必须**只针对这次抽卡产生的那一轮**，否则很久以后随手点一次「重新生成」，
// 早就该结束的卡又会被塞回提示词——那就是「没点抽卡卡还赖着」。
//
// 锚点：抽卡发送成功后记下触发短语所在的 chat 下标。重放前校验：
//   1. 那个下标上仍是抽卡触发短语（聊天没被别的消息顶走）；
//   2. 聊天长度没超过「触发短语 + 它下面那一条 AI」——重新生成会删掉尾部 AI 楼，
//      swipe 会原地替换，两者都满足；玩家又聊了几句就不满足了；
//   3. 记录没过期（SC_RETRY_REPLAY_TTL_MS）。
function scReplayInjectionForRetry(ctx) {
  const record = globalThis[SC_LAST_DRAW_KEY];
  if (!record || !record.cardId) return false;
  if (record.chatId && scGetChatId() && String(record.chatId) !== String(scGetChatId())) return false;
  if (scIsRetryRecordStale(record)) return false;
  if (!scIsRecordAtTail(record)) return false;
  const card = scGetLibrary().find((item) => item.id === record.cardId);
  if (!card) return false;
  if (!scApplyInjection(card, ctx)) return false;
  scLogInfo('重新生成：已重放上一轮抽到的卡', card.name);
  return true;
}

function scIsRetryRecordStale(record) {
  const at = Date.parse(String(record.at || ''));
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > SC_RETRY_REPLAY_TTL_MS;
}

// 这条记录是否仍然指向「刚抽完卡、还没走远」的那一处聊天位置。
function scIsRecordAtTail(record) {
  const ctx = scGetContextSafe();
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;
  if (!chat) return false;
  const index = Number(record.triggerIndex);
  if (!Number.isInteger(index) || index < 0) return false;
  // 触发短语还在原处（按内容校验，避免宿主裁剪消息后下标漂移却没被发现）。
  const anchor = chat[index];
  if (!anchor || String(anchor.mes || '').trim() !== SC_TRIGGER_TEXT) return false;
  // 只允许「触发短语」或「触发短语 + 紧跟的一条 AI 楼」这两种尾部形态。
  return chat.length <= index + 2;
}
