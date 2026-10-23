// ===== 剧情抽卡（Story Cards）UI 层：悬浮按钮 + 悬浮窗面板（范围树 / 抽卡按钮 / 结果） =====
// 面板刻意做小：选范围 → 点抽卡 → 看结果。抽到就立刻填输入框并发出去。
// 面板本身是一个可拖动的悬浮窗（与万华镜一致）：拖标题栏移动、位置夹在视口内并记忆、
// 面板打开期间悬浮球暂时收起，关闭面板后再请回来。

// 展开态是纯 UI 状态，不进设置：重渲染（勾选变化触发）时保持玩家的展开/收起。
// 两层都能展开：顶层是分类（与 cards/<分类>/... 对应），第二层是卡组。
const scExpandedCategories = new Set();
const scExpandedDecks = new Set();

function scToggleCategoryExpanded(categoryName) {
  if (scExpandedCategories.has(categoryName)) scExpandedCategories.delete(categoryName);
  else scExpandedCategories.add(categoryName);
  scRenderScopeTree();
}

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

// 点击是否来自某个嵌套块内部（沿 target 往上走，遇到 stopNode 之前先碰到 cls 块）。
// 用来阻止「点卡组行连带把外层分类也收起」：分类块的监听器会收到冒泡上来的点击，
// 但只要这次点击本来就在某个卡组块里，就该交给卡组块处理。
function scClickInsideBlock(target, stopNode, cls) {
  let node = target;
  while (node && node !== stopNode) {
    if (node.classList && node.classList.contains(cls)) return true;
    node = node.parentNode;
  }
  return false;
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
  // 悬浮窗落位：优先用上次保存的位置，并夹在视口内（要在显示之后再算，offsetWidth 才有效）。
  scApplyPanelPosition();
  // 每次打开都回到主界面，避免上次停在查看界面时看着像「卡住了」。
  scShowMainView();
  scRenderScopeTree();
  // 概况行只在没有操作结果时补画，别把「已导出 …」这类提示顶掉。
  scRefreshCardStatus();
  // 面板打开期间悬浮球暂时收起（与万华镜一致），关闭面板时由 scClosePanel 请回来。
  scApplyFloatingButtonVisibility();
}

function scClosePanel() {
  const panel = scEl(SC_PANEL_ID);
  if (!panel) return;
  panel.classList.remove('sc-panel--open');
  panel.setAttribute('aria-hidden', 'true');
  // 关闭面板后把悬浮球请回来（打开面板时会先暂时收起它）。
  scApplyFloatingButtonVisibility();
}

function scTogglePanel() {
  if (scIsPanelOpen()) scClosePanel();
  else scOpenPanel();
}

// ---------- 悬浮窗定位与拖动 ----------
// 与万华镜（Kaleidoscope）一致：面板是可拖动的悬浮窗，位置由内联 left/top 控制
// （永远夹在视口内），拖标题栏移动，拖完落盘设置，重启后还在原处。

function scGetPanelDialog() {
  return scEl(SC_PANEL_DIALOG_ID);
}

// 把坐标夹在视口内，保证悬浮窗永远完整可见、可拖。
function scClampPanelPosition(left, top) {
  const viewport = scViewportSize();
  const dialog = scGetPanelDialog();
  const width = dialog?.offsetWidth || SC_PANEL_FALLBACK_WIDTH;
  const height = dialog?.offsetHeight || SC_PANEL_FALLBACK_HEIGHT;
  const maxLeft = Math.max(0, viewport.width - width);
  const maxTop = Math.max(0, viewport.height - height);
  return {
    left: Math.min(Math.max(Number(left) || 0, 0), maxLeft),
    top: Math.min(Math.max(Number(top) || 0, 0), maxTop),
  };
}

function scSetPanelPosition(left, top) {
  const dialog = scGetPanelDialog();
  if (!dialog) return null;
  const clamped = scClampPanelPosition(left, top);
  dialog.style.left = clamped.left + 'px';
  dialog.style.top = clamped.top + 'px';
  // 定位改用 left/top 后必须清掉 right/bottom，否则两者会互相打架。
  dialog.style.right = 'auto';
  dialog.style.bottom = 'auto';
  return clamped;
}

// 默认位置：视口右上（沿用旧版面板的落点：top 64 / 距右 18）。
function scDefaultPanelPosition() {
  const viewport = scViewportSize();
  const dialog = scGetPanelDialog();
  const width = dialog?.offsetWidth || SC_PANEL_FALLBACK_WIDTH;
  return scClampPanelPosition(viewport.width - width - 18, 64);
}

// 落位：优先用设置里保存的位置，没有就用默认位置。只在打开面板 / 视口变化时调用。
function scApplyPanelPosition() {
  const settings = scGetSettings();
  const fallback = scDefaultPanelPosition();
  const left = Number.isFinite(settings.panelX) ? settings.panelX : fallback.left;
  const top = Number.isFinite(settings.panelY) ? settings.panelY : fallback.top;
  return scSetPanelPosition(left, top);
}

// 拖标题栏移动悬浮窗。监听挂在标题栏上（配合 setPointerCapture，与悬浮球同一套路）。
// 按在标题栏内的按钮（查看 / 重置 / 关闭）上时不启动拖拽：否则指针捕获会把后续
// click 重定向到标题栏，按钮点击失效。
function scInstallPanelDrag(dialog, header) {
  let dragState = null;

  const endDrag = () => {
    if (!dragState) return;
    const state = dragState;
    dragState = null;
    dialog.classList.remove('is-dragging');
    // 落盘：拖动结束后才写设置，拖动过程中不刷盘。
    if (state.moved) {
      const settings = scGetSettings();
      settings.panelX = state.left;
      settings.panelY = state.top;
      scSaveSettings();
    }
  };

  header.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('button')) return;
    // 用视觉位置（getBoundingClientRect）算偏移：指针按在哪，拖动时就保持在哪。
    const rect = dialog.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    dialog.classList.add('is-dragging');
    try {
      header.setPointerCapture?.(event.pointerId);
    } catch (error) { /* 没捕获到就算了 */ }
    if (typeof event.preventDefault === 'function') event.preventDefault();
  });

  header.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    if (event.pointerId !== undefined && dragState.pointerId !== undefined
      && event.pointerId !== dragState.pointerId) return;
    const next = scSetPanelPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
    if (next) {
      dragState.moved = true;
      dragState.left = next.left;
      dragState.top = next.top;
    }
  });

  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
}

// ---------- 面板骨架 ----------
// 结构与万华镜一致：外层 .sc-panel 是覆盖层（铺满视口、不吃指针事件），
// 内层 .sc-panel__dialog 是悬浮窗本体（可拖动，left/top 由 JS 写）。
function scCreatePanel() {
  if (scEl(SC_PANEL_ID)) return;
  const panel = scCreate('div', 'sc-panel');
  panel.id = SC_PANEL_ID;
  panel.setAttribute('aria-hidden', 'true');

  const dialog = scCreate('div', 'sc-panel__dialog');
  dialog.id = SC_PANEL_DIALOG_ID;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', SC_MODULE_DISPLAY_NAME);

  const header = scCreate('div', 'sc-panel__header sc-panel__drag-handle');
  const title = scCreate('div', 'sc-panel__title');
  const titleIcon = scCreate('i', SC_DRAW_ICON_CLASS);
  titleIcon.id = SC_PANEL_TITLE_ICON_ID;
  const titleText = scCreate('span', '', SC_MODULE_DISPLAY_NAME);
  titleText.id = SC_PANEL_TITLE_ID;
  title.appendChild(titleIcon);
  title.appendChild(titleText);
  const headerActions = scCreate('div', 'sc-panel__header-actions');
  // 「查看注入的提示词」：标题栏按钮，点一下把面板整体切到查看界面（见 scShowInjectView）。
  const viewButton = scCreate('button', 'sc-icon-button sc-icon-button--icon');
  viewButton.id = SC_VIEW_INJECT_BUTTON_ID;
  viewButton.type = 'button';
  viewButton.innerHTML = '<i class="fa-solid fa-eye"></i>';
  viewButton.title = '查看注入的提示词';
  viewButton.setAttribute('aria-label', '查看注入的提示词');
  viewButton.addEventListener('click', () => scShowInjectView());
  // 「重置记录」：与眼睛按钮同款的纯图标按钮（旋转箭头），说明放悬停提示里。
  const resetButton = scCreate('button', 'sc-icon-button sc-icon-button--icon');
  resetButton.id = SC_RESET_BUTTON_ID;
  resetButton.type = 'button';
  resetButton.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
  resetButton.title = '重置记录：清空当前聊天的「抽过不重复」记录';
  resetButton.setAttribute('aria-label', '重置记录');
  resetButton.addEventListener('click', () => scHandleResetDrawn());
  const closeButton = scCreate('button', 'sc-icon-button sc-icon-button--close', '×');
  closeButton.type = 'button';
  closeButton.title = '关闭';
  closeButton.addEventListener('click', () => scClosePanel());
  headerActions.appendChild(viewButton);
  headerActions.appendChild(resetButton);
  headerActions.appendChild(closeButton);
  header.appendChild(title);
  header.appendChild(headerActions);
  dialog.appendChild(header);

  const body = scCreate('div', 'sc-panel__body');

  // 主界面：抽卡相关的一切。与「查看界面」互斥显示，由标题栏的眼睛按钮来回切。
  const mainView = scCreate('div', 'sc-view sc-view--main');
  mainView.id = SC_MAIN_VIEW_ID;
  mainView.hidden = false;

  // 导入 / 导出卡片：整库存成一份 JSON，换设备或备份时带走。
  const cardSection = scCreate('div', 'sc-cards');
  const cardRow = scCreate('div', 'sc-cards__row');
  const importButton = scCreate('button', 'sc-button sc-button--primary');
  importButton.id = SC_IMPORT_CARDS_BUTTON_ID;
  importButton.type = 'button';
  importButton.innerHTML = '<i class="fa-solid fa-file-import"></i><span>导入卡片</span>';
  importButton.title = '选择一个卡牌 .json 文件，解析后并入卡库（同卡号覆盖）';
  importButton.addEventListener('click', () => { void scHandleImportCards(); });
  const exportButton = scCreate('button', 'sc-button');
  exportButton.id = SC_EXPORT_CARDS_BUTTON_ID;
  exportButton.type = 'button';
  exportButton.innerHTML = '<i class="fa-solid fa-file-export"></i><span>导出卡片</span>';
  exportButton.title = '把当前卡库（内置 + 已导入）导出成一个 .json 文件';
  exportButton.addEventListener('click', () => { void scHandleExportCards(); });
  cardRow.appendChild(importButton);
  cardRow.appendChild(exportButton);
  const cardStatus = scCreate('div', 'sc-cards__status');
  cardStatus.id = SC_CARD_STATUS_ID;
  cardSection.appendChild(cardRow);
  cardSection.appendChild(cardStatus);
  mainView.appendChild(cardSection);

  const scopeTitle = scCreate('div', 'sc-panel__section-title', '抽卡范围');
  const scopeHint = scCreate('div', 'sc-panel__hint', '勾选要抽的主题（可多选，父级勾选即整片勾上）。一个都不勾 = 全库随机。');
  const tree = scCreate('div', 'sc-tree');
  tree.id = SC_SCOPE_TREE_ID;
  mainView.appendChild(scopeTitle);
  mainView.appendChild(scopeHint);
  mainView.appendChild(tree);

  const summary = scCreate('div', 'sc-summary');
  summary.id = SC_SUMMARY_ID;
  mainView.appendChild(summary);

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
  mainView.appendChild(options);

  // 「显示悬浮球」开关：长按悬浮球会把它收起来，这里是找回它的入口
  // （扩展菜单打开面板后勾上即可），避免长按变成一个找不回来的单向操作。
  const floatOption = scCreate('label', 'sc-option');
  const floatBox = scCreate('input', 'sc-option__checkbox');
  floatBox.type = 'checkbox';
  floatBox.id = SC_SHOW_FLOAT_ID;
  floatBox.addEventListener('change', () => {
    if (floatBox.checked) scShowFloatingButton();
    else scHideFloatingButton();
  });
  floatOption.appendChild(floatBox);
  floatOption.appendChild(scCreate('span', 'sc-option__label', '显示悬浮球'));
  floatOption.title = '长按悬浮球可隐藏；在这里或扩展菜单里重新打开';
  mainView.appendChild(floatOption);

  const drawButton = scCreate('button', 'sc-draw-button');
  drawButton.id = SC_DRAW_BUTTON_ID;
  drawButton.type = 'button';
  const drawIcon = scCreate('i', SC_DRAW_ICON_CLASS);
  const drawLabel = scCreate('span', '', '剧情抽卡');
  drawButton.appendChild(drawIcon);
  drawButton.appendChild(drawLabel);
  drawButton.addEventListener('click', () => scHandleDraw());
  mainView.appendChild(drawButton);

  const result = scCreate('div', 'sc-result');
  result.id = SC_RESULT_ID;
  mainView.appendChild(result);

  body.appendChild(mainView);

  // 查看界面：单独一屏，只放最近一次注入的原文。从主界面标题栏的眼睛按钮进来，
  // 左上角「返回」回到主界面。内容在切入时按最新记录重画（见 scRenderInjectPreview）。
  const injectView = scCreate('div', 'sc-view sc-view--inject');
  injectView.id = SC_INJECT_VIEW_ID;
  injectView.hidden = true;

  const injectBar = scCreate('div', 'sc-view__bar');
  const backButton = scCreate('button', 'sc-view__back');
  backButton.id = SC_INJECT_BACK_BUTTON_ID;
  backButton.type = 'button';
  backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i><span>返回抽卡</span>';
  backButton.title = '返回抽卡界面';
  backButton.addEventListener('click', () => scShowMainView());
  injectBar.appendChild(backButton);
  injectView.appendChild(injectBar);

  const injectPreview = scCreate('div', 'sc-inject__preview');
  injectPreview.id = SC_INJECT_PREVIEW_ID;
  injectView.appendChild(injectPreview);

  body.appendChild(injectView);

  dialog.appendChild(body);
  panel.appendChild(dialog);
  document.body.appendChild(panel);
  scInstallPanelDrag(dialog, header);
  // 视口变化后把悬浮窗夹回视口内（横竖屏切换、拉窗口都可能让它跑出去）。
  if (!globalThis[SC_PANEL_RESIZE_HOOK_KEY] && typeof globalThis.addEventListener === 'function') {
    globalThis[SC_PANEL_RESIZE_HOOK_KEY] = () => {
      if (scIsPanelOpen()) scApplyPanelPosition();
    };
    globalThis.addEventListener('resize', globalThis[SC_PANEL_RESIZE_HOOK_KEY]);
  }
}

// ---------- 悬浮按钮（可自由拖动） ----------
// 位置存在设置里（floatX / floatY，视口坐标），拖动后自动落盘，重启还在原处。
// 拖动与点击的区分：位移超过阈值才算拖动，否则当点击处理（打开面板）。
// 用 Pointer Events 统一鼠标 / 触摸 / 触控笔，配合 style.css 里的 touch-action: none。

let scFloatDrag = null;
let scFloatDidDrag = false;
let scFloatLongPressTimer = null;

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

// 长按隐藏悬浮球：把开关写进设置并立即生效。面板里「显示悬浮球」可以反向打开，
// 所以不是单向操作——收起之后还能找回来。
function scHideFloatingButton() {
  const settings = scGetSettings();
  settings.showFloatingButton = false;
  scSaveSettings();
  const button = scEl(SC_FLOATING_BUTTON_ID);
  if (button) {
    button.classList.remove('sc-floating-button--holding');
    button.classList.add('sc-floating-button--hiding');
  }
  // 让 CSS 的缩小动画先播完，再把 display 切成 none。
  setTimeout(() => {
    if (button) button.classList.remove('sc-floating-button--hiding');
    scApplyFloatingButtonVisibility();
    scRefreshSummary();
  }, 160);
  scToast('info', '悬浮球已隐藏，可从「扩展菜单 → 剧情抽卡」重新打开');
}

function scShowFloatingButton() {
  const settings = scGetSettings();
  settings.showFloatingButton = true;
  scSaveSettings();
  scApplyFloatingButtonVisibility();
}

function scCancelFloatLongPress() {
  if (scFloatLongPressTimer && typeof clearTimeout === 'function') clearTimeout(scFloatLongPressTimer);
  scFloatLongPressTimer = null;
  const button = scEl(SC_FLOATING_BUTTON_ID);
  if (button) button.classList.remove('sc-floating-button--holding');
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
      // 长按已触发：这一轮的 pointerup / click 都不要再当点击处理。
      longPressed: false,
    };
    if (button.setPointerCapture) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch (error) { /* 忽略 */ }
    }
    // 长按计时从按下开始；一旦移动超过阈值就被取消（那是拖动，不是长按）。
    scCancelFloatLongPress();
    button.classList.add('sc-floating-button--holding');
    if (typeof setTimeout === 'function') {
      const pointerId = event.pointerId;
      scFloatLongPressTimer = setTimeout(() => {
        scFloatLongPressTimer = null;
        const drag = scFloatDrag;
        if (!drag || drag.pointerId !== pointerId || drag.moved) return;
        drag.longPressed = true;
        scFloatDidDrag = true;
        scEndFloatDrag(pointerId);
        scHideFloatingButton();
      }, SC_FLOAT_LONG_PRESS_MS);
    }
  });

  button.addEventListener('pointermove', (event) => {
    if (!scFloatDrag || event.pointerId !== scFloatDrag.pointerId) return;
    const dx = event.clientX - scFloatDrag.startX;
    const dy = event.clientY - scFloatDrag.startY;
    const distance = Math.hypot(dx, dy);
    // 超过「长按容差」就确定是拖动，取消长按计时。
    if (distance >= SC_FLOAT_LONG_PRESS_SLOP) scCancelFloatLongPress();
    if (!scFloatDrag.moved && distance < SC_FLOAT_DRAG_THRESHOLD) return;
    scFloatDrag.moved = true;
    const next = scApplyFloatPosition(event.clientX - scFloatDrag.offsetX, event.clientY - scFloatDrag.offsetY);
    if (next) {
      scFloatDrag.x = next.x;
      scFloatDrag.y = next.y;
    }
  });

  button.addEventListener('pointerup', (event) => {
    if (!scFloatDrag || event.pointerId !== scFloatDrag.pointerId) return;
    scCancelFloatLongPress();
    const moved = scFloatDrag.moved;
    const longPressed = scFloatDrag.longPressed;
    scEndFloatDrag(event.pointerId);
    // 拖动或长按过就不要把 pointerup 当成点击（否则拖完/收完会顺手把面板打开）。
    scFloatDidDrag = moved || longPressed;
  });

  button.addEventListener('pointercancel', (event) => {
    if (!scFloatDrag || event.pointerId !== scFloatDrag.pointerId) return;
    scCancelFloatLongPress();
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
  button.title = SC_MODULE_DISPLAY_NAME + '：轻点打开 / 拖动移动 / 长按隐藏';
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
  // 悬浮球在两种情况下隐藏：设置里关掉了；面板开着（暂时收起，关面板时请回来）。
  const visible = settings.showFloatingButton !== false && !scIsPanelOpen();
  button.style.display = visible ? 'flex' : 'none';
  // 显示时顺手夹一次位置：按钮隐藏期间视口可能变过。
  if (visible) scRestoreFloatPosition();
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

// 展开箭头：可点（stopPropagation，避免连带触发整块的展开/收起）。
function scBuildCaret(expanded, onToggle) {
  const caret = scCreate('button', 'sc-tree__caret', expanded ? '▾' : '▸');
  caret.type = 'button';
  caret.setAttribute('aria-label', expanded ? '收起' : '展开');
  caret.addEventListener('click', (event) => {
    event.stopPropagation();
    onToggle();
  });
  return caret;
}

// 主题行没有子级，占一个和箭头等宽的空位，让勾选框与上层对齐。
function scBuildCaretSpacer() {
  const spacer = scCreate('span', 'sc-tree__caret-spacer');
  spacer.setAttribute('aria-hidden', 'true');
  return spacer;
}

// 统计子树里被勾选的张数与总张数。
function scCountSubtree(settings, categoryName, decks) {
  let selected = 0;
  let total = 0;
  for (const deck of decks) {
    for (const chapter of deck.chapters) {
      total += chapter.total;
      if (scIsLeafSelected(settings, categoryName, deck.name, chapter.name)) selected += chapter.total;
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
    const empty = scCreate('div', 'sc-tree__empty', '卡库是空的。点上面「导入卡片」选一个卡牌 .json 文件，或把卡牌放进 cards/<分类>/<卡组>/<主题>/ 后运行 node build.js。');
    tree.appendChild(empty);
    scRefreshSummary();
    return;
  }

  // 默认全部收起，由玩家自己点开（展开态只活在本次会话里）。
  // 三层与目录一致：分类 → 卡组 → 主题。
  for (const category of scopeTree) {
    const categoryNode = scCreate('div', 'sc-tree__category');
    const categoryRow = scCreate('div', 'sc-tree__row sc-tree__row--category');
    const categoryExpanded = scExpandedCategories.has(category.name);
    const categoryCaret = scBuildCaret(categoryExpanded, () => scToggleCategoryExpanded(category.name));
    const categoryStats = scCountSubtree(settings, category.name, category.decks);
    const categoryBox = scBuildCheckbox(
      scSelectionState(categoryStats.selected, categoryStats.total),
      (checked) => {
        for (const deck of category.decks) {
          scSetSubtreeSelected(settings, category.name, deck.name, deck.chapters.map((chapter) => chapter.name), checked);
        }
        scSaveSettings();
        scRenderScopeTree();
      },
      `分类 ${category.name}`,
    );
    const categoryLabel = scCreate('span', 'sc-tree__label', `${category.name}`);
    const categoryCount = scCreate('span', 'sc-tree__count', `${categoryStats.selected}张/${categoryStats.total}张`);
    categoryRow.appendChild(categoryCaret);
    categoryRow.appendChild(categoryBox);
    categoryRow.appendChild(categoryLabel);
    categoryRow.appendChild(categoryCount);
    // 监听挂在「整块」上而不是行上：行只占内容宽度，挂在行上会让右侧空白点不动。
    // 点在勾选框 / 展开箭头这类控件上时不重复触发（勾选框自己也会 stopPropagation）。
    categoryNode.addEventListener('click', (event) => {
      if (scIsInteractiveTarget(event)) return;
      // 点在展开出来的卡组块里时，交给卡组自己的监听器处理，别连带收起整个分类。
      if (scClickInsideBlock(event.target, categoryNode, 'sc-tree__deck')) return;
      scToggleCategoryExpanded(category.name);
    });
    categoryNode.appendChild(categoryRow);

    if (categoryExpanded) {
      for (const deck of category.decks) {
        const deckNode = scCreate('div', 'sc-tree__deck');
        const deckRow = scCreate('div', 'sc-tree__row sc-tree__row--deck');
        const deckExpanded = scExpandedDecks.has(deck.name);
        const deckCaret = scBuildCaret(deckExpanded, () => scToggleDeckExpanded(deck.name));
        const deckStats = scCountSubtree(settings, category.name, [deck]);
        const deckBox = scBuildCheckbox(
          scSelectionState(deckStats.selected, deckStats.total),
          (checked) => {
            scSetSubtreeSelected(settings, category.name, deck.name, deck.chapters.map((chapter) => chapter.name), checked);
            scSaveSettings();
            scRenderScopeTree();
          },
          `卡组 ${deck.name}`,
        );
        const deckLabel = scCreate('span', 'sc-tree__label', deck.name);
        const deckCount = scCreate('span', 'sc-tree__count', `${deckStats.selected}张/${deckStats.total}张`);
        deckRow.appendChild(deckCaret);
        deckRow.appendChild(deckBox);
        deckRow.appendChild(deckLabel);
        deckRow.appendChild(deckCount);
        deckNode.addEventListener('click', (event) => {
          if (scIsInteractiveTarget(event)) return;
          // 点在主题行上（它是卡组块里的子行）时，别把整个卡组收起。
          if (scClickInsideBlock(event.target, deckNode, 'sc-tree__row--chapter')) return;
          scToggleDeckExpanded(deck.name);
        });
        deckNode.appendChild(deckRow);

        if (deckExpanded) {
          for (const chapter of deck.chapters) {
            const chapterRow = scCreate('div', 'sc-tree__row sc-tree__row--chapter');
            const chapterBox = scBuildCheckbox(
              scIsLeafSelected(settings, category.name, deck.name, chapter.name),
              (checked) => {
                scSetLeafSelected(settings, category.name, deck.name, chapter.name, checked);
                scSaveSettings();
                scRenderScopeTree();
              },
              `主题 ${chapter.name}`,
            );
            const chapterLabel = scCreate('span', 'sc-tree__label', chapter.name);
            const chapterSelected = scIsLeafSelected(settings, category.name, deck.name, chapter.name);
            const chapterCount = scCreate('span', 'sc-tree__count',
              `${chapterSelected ? chapter.total : 0}张/${chapter.total}张`);
            chapterRow.appendChild(scBuildCaretSpacer());
            chapterRow.appendChild(chapterBox);
            chapterRow.appendChild(chapterLabel);
            chapterRow.appendChild(chapterCount);
            chapterRow.title = chapter.cards.map((card) => `${card.number || card.id} ${card.name}`).join('\n');
            deckNode.appendChild(chapterRow);
          }
        }
        categoryNode.appendChild(deckNode);
      }
    }
    tree.appendChild(categoryNode);
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
  const floatBox = scEl(SC_SHOW_FLOAT_ID);
  if (floatBox) floatBox.checked = settings.showFloatingButton !== false;
  const stats = scSummarizeSelection(settings);
  const chatId = scGetChatId();
  const { cards: pool, unrestricted } = scFilterBySelection(settings);
  const drawn = scGetDrawnForChat(chatId);
  const drawnInPool = scCountDrawnInScope(pool, drawn);
  const remaining = settings.avoidRepeat === false ? pool.length : Math.max(0, pool.length - drawnInPool);
  const scopeText = unrestricted
    ? `全库随机（${pool.length} 张）`
    : `${stats.selectedCards}张/${stats.totalCards}张`;
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

// ---------- 查看注入的提示词（独立查看界面） ----------
// 面板两态：主界面（抽卡）与查看界面（注入原文）。同一时刻只显示一个，互斥切换。
// 切到查看界面时按最近一次注入记录重画内容。
function scIsInjectViewOpen() {
  const view = scEl(SC_INJECT_VIEW_ID);
  return Boolean(view && !view.hidden);
}

function scShowInjectView() {
  const mainView = scEl(SC_MAIN_VIEW_ID);
  const injectView = scEl(SC_INJECT_VIEW_ID);
  if (!injectView) return;
  scRenderInjectPreview();
  if (mainView) mainView.hidden = true;
  injectView.hidden = false;
  // 标题栏跟着换成「查看注入的提示词」，让玩家清楚当前在哪个屏。
  const titleText = scEl(SC_PANEL_TITLE_ID);
  if (titleText) titleText.textContent = '查看注入的提示词';
  const titleIcon = scEl(SC_PANEL_TITLE_ICON_ID);
  if (titleIcon) titleIcon.className = 'fa-solid fa-eye';
}

function scShowMainView() {
  const mainView = scEl(SC_MAIN_VIEW_ID);
  const injectView = scEl(SC_INJECT_VIEW_ID);
  if (injectView) injectView.hidden = true;
  if (mainView) mainView.hidden = false;
  const titleText = scEl(SC_PANEL_TITLE_ID);
  if (titleText) titleText.textContent = SC_MODULE_DISPLAY_NAME;
  const titleIcon = scEl(SC_PANEL_TITLE_ICON_ID);
  if (titleIcon) titleIcon.className = SC_DRAW_ICON_CLASS;
}

// 画注入预览：落点参数 + 原文（等宽、可滚动、可复制）。
function scRenderInjectPreview() {
  const preview = scEl(SC_INJECT_PREVIEW_ID);
  if (!preview) return;
  preview.textContent = '';
  const record = scGetLastInjection();
  if (!record) {
    preview.appendChild(scCreate('div', 'sc-inject__empty',
      '还没有抽过卡。点一次「剧情抽卡」，这里就会显示实际注入给模型的提示词原文。'));
    return;
  }

  const slotName = record.inChat === SC_INJECT_TYPE_IN_CHAT ? 'IN_CHAT' : String(record.inChat);
  const roleName = record.systemRole === SC_INJECT_ROLE_SYSTEM ? 'SYSTEM' : String(record.systemRole);
  const meta = scCreate('div', 'sc-inject__meta');
  const title = record.cardName ? `${record.cardId || ''} ${record.cardName}`.trim() : '（未知卡）';
  meta.appendChild(scCreate('span', 'sc-inject__meta-item', `卡：${title}`));
  meta.appendChild(scCreate('span', 'sc-inject__meta-item', `槽位：${slotName}`));
  meta.appendChild(scCreate('span', 'sc-inject__meta-item', `角色：${roleName}`));
  meta.appendChild(scCreate('span', 'sc-inject__meta-item', `深度：${record.depth}`));
  meta.appendChild(scCreate('span', 'sc-inject__meta-item', `字符数：${record.text.length}`));
  preview.appendChild(meta);

  const toolbar = scCreate('div', 'sc-inject__toolbar');
  const copyButton = scCreate('button', 'sc-icon-button');
  copyButton.id = SC_INJECT_COPY_BUTTON_ID;
  copyButton.type = 'button';
  copyButton.textContent = '复制原文';
  copyButton.addEventListener('click', () => scCopyInjectText(record.text));
  toolbar.appendChild(copyButton);
  preview.appendChild(toolbar);

  const pre = scCreate('pre', 'sc-inject__text', record.text);
  preview.appendChild(pre);
}

// 复制注入原文到剪贴板；宿主没有剪贴板 API 时退回选中文本，让玩家自己 Ctrl+C。
function scCopyInjectText(text) {
  const value = String(text || '');
  const done = () => scToast('success', '注入原文已复制');
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      globalThis.navigator.clipboard.writeText(value).then(done, () => scFallbackCopy());
      return;
    }
  } catch (error) {
    /* 落到兜底 */
  }
  scFallbackCopy();
}

function scFallbackCopy() {
  const preview = scEl(SC_INJECT_PREVIEW_ID);
  let pre = null;
  if (preview) {
    if (typeof preview.querySelector === 'function') pre = preview.querySelector('.sc-inject__text');
    // 测试用的最小 DOM 没有 querySelector，退回它的 walk/find 助手。
    if (!pre && typeof preview.find === 'function') {
      pre = preview.find((node) => node.classList && node.classList.contains('sc-inject__text'));
    }
  }
  if (pre && typeof pre.select === 'function') pre.select();
  scToast('info', '请按 Ctrl+C 复制（宿主不支持剪贴板 API）');
}

// ---------- 卡牌状态行 ----------
// 状态行有两种内容：操作结果（「导入 138 张…」，要留住）与卡库概况（「卡库 138 张」，
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

// 画「卡库 N 张（内置 X + 导入 Y）」概况；正在显示操作结果时不覆盖。
function scRefreshCardStatus(force) {
  const status = scEl(SC_CARD_STATUS_ID);
  if (!status) return;
  if (!force && !scCardStatusIsAuto) return;
  const builtin = scGetBuiltinLibrary().length;
  const custom = scGetCustomCards().length;
  const total = scGetLibrary().length;
  status.textContent = custom > 0
    ? `卡库 ${total} 张（内置 ${builtin} + 导入 ${custom}）`
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
    // 抽完若正停在查看界面，跟着换成这一轮的注入原文。
    if (scIsInjectViewOpen()) scRenderInjectPreview();
    // 抽卡后把卡牌状态行切回「卡库概况」：上一句「导入 N 张…」的任务已经完成，
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
