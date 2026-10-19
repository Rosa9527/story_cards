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
