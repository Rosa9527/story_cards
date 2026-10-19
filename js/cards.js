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
// triggerIndex 是触发短语在 chat 里的下标：重放前用它确认「还是刚抽完卡的那一处」，
// 防止很久以后点重新生成把旧卡又捞回来。
function scCommitDraw(card, chatId) {
  if (!card) return;
  scRecordDrawn(card, chatId);
  const ctx = scGetContextSafe();
  const chat = Array.isArray(ctx?.chat) ? ctx.chat : null;
  globalThis[SC_LAST_DRAW_KEY] = {
    cardId: card.id,
    cardName: card.name,
    chatId: String(chatId || ''),
    triggerIndex: chat && chat.length > 0 ? chat.length - 1 : -1,
    at: new Date().toISOString(),
  };
}
