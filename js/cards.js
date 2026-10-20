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

// 玩家在面板里导入的卡牌（存在设置里，随酒馆设置持久化）。
// 注意这是导入出来的一份副本——没有导出的卡牌就只剩构建期卡库里的那些。
function scGetCustomCards() {
  const settings = scGetSettings();
  return Array.isArray(settings.customCards) ? settings.customCards : [];
}

// 合并卡库：内置 + 玩家导入，同 id 时玩家导入的覆盖内置（方便自己改卡面后即时生效）。
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

// ---------- 范围树 ----------
// 三层：分类 → 卡组 → 主题，与 cards/<分类>/<卡组>/<主题>/ 目录一一对应。
// 每个节点带含子树的 total 张数，供 UI 显示「奇幻类 7张/7张」这类计数，
// 也让玩家知道勾完能抽到多少张。
function scBuildScopeTree() {
  const categories = new Map();
  for (const card of scGetLibrary()) {
    const categoryName = String(card.category || '未分类');
    const deckName = String(card.deck || '未分组');
    const chapterName = String(card.chapter || '未分主题');
    if (!categories.has(categoryName)) categories.set(categoryName, { name: categoryName, total: 0, decks: new Map() });
    const category = categories.get(categoryName);
    if (!category.decks.has(deckName)) category.decks.set(deckName, { name: deckName, total: 0, chapters: new Map() });
    const deck = category.decks.get(deckName);
    if (!deck.chapters.has(chapterName)) deck.chapters.set(chapterName, { name: chapterName, total: 0, cards: [] });
    const chapter = deck.chapters.get(chapterName);
    chapter.cards.push(card);
    chapter.total += 1;
    deck.total += 1;
    category.total += 1;
  }
  return Array.from(categories.values()).map((category) => ({
    name: category.name,
    total: category.total,
    decks: Array.from(category.decks.values()).map((deck) => ({
      name: deck.name,
      total: deck.total,
      chapters: Array.from(deck.chapters.values()),
    })),
  }));
}

// 叶子键：分类 / 卡组 / 主题 三段拼成稳定字符串，作为 selectedLeaves 的键。
// 嵌套顺序与目录一致：{ 分类: { 卡组: { 主题: true } } }。
function scLeafKey(category, deck, chapter) {
  return [category, deck, chapter].map((part) => String(part == null ? '' : part)).join('\u0001');
}

// 一个叶子（主题）是否被勾选。
function scIsLeafSelected(settings, category, deck, chapter) {
  const categorySel = settings.selectedLeaves?.[category];
  const deckSel = categorySel?.[deck];
  return Boolean(deckSel && deckSel[chapter]);
}

// 勾选 / 取消一个叶子。
function scSetLeafSelected(settings, category, deck, chapter, selected) {
  if (!settings.selectedLeaves || typeof settings.selectedLeaves !== 'object') settings.selectedLeaves = {};
  const leaves = settings.selectedLeaves;
  if (selected) {
    if (!leaves[category]) leaves[category] = {};
    if (!leaves[category][deck]) leaves[category][deck] = {};
    leaves[category][deck][chapter] = true;
    return;
  }
  if (leaves[category]?.[deck]) {
    delete leaves[category][deck][chapter];
    if (Object.keys(leaves[category][deck]).length === 0) delete leaves[category][deck];
    if (Object.keys(leaves[category]).length === 0) delete leaves[category];
  }
}

// 节点级批量勾选 / 取消：把子树里所有叶子一起改。
function scSetSubtreeSelected(settings, category, deck, chapters, selected) {
  for (const chapter of chapters) {
    scSetLeafSelected(settings, category, deck, chapter, selected);
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
  for (const category of tree) {
    for (const deck of category.decks) {
      for (const chapter of deck.chapters) {
        totalLeaves += 1;
        totalCards += chapter.total;
        if (scIsLeafSelected(settings, category.name, deck.name, chapter.name)) {
          selectedLeaves += 1;
          selectedCards += chapter.total;
        }
      }
    }
  }
  return { selectedLeaves, totalLeaves, selectedCards, totalCards, tree };
}

// ---------- 抽卡范围 ----------
// 勾了主题 → 只在这些主题里抽；一个都没勾 → 全库随机（并提示玩家）。
function scFilterBySelection(settings) {
  const library = scGetLibrary();
  const anyLeaf = Object.values(settings.selectedLeaves || {}).some(
    (decks) => Object.values(decks || {}).some((chapters) => Object.keys(chapters || {}).length > 0),
  );
  if (!anyLeaf) return { cards: library.slice(), unrestricted: true };
  const cards = library.filter((card) => scIsLeafSelected(settings, card.category, card.deck, card.chapter));
  return { cards, unrestricted: false };
}

// 清掉已经不存在于当前卡库的勾选（换卡库 / 目录结构改版后留下的旧键）。
// 不清的话，旧键会让「有没有勾选」判定为真，但筛出来 0 张卡，抽卡直接失效；
// 而且在同一个键重新出现之前，玩家看到的都是一片勾不中任何东西的空范围。
// 返回清掉的叶子数。只在真的有变化时写盘。
function scPruneStaleSelection(settings) {
  const leaves = settings.selectedLeaves;
  if (!leaves || typeof leaves !== 'object') return 0;
  const tree = scBuildScopeTree();
  let removed = 0;
  for (const category of tree) {
    const categorySel = leaves[category.name];
    if (!categorySel || typeof categorySel !== 'object') continue;
    for (const deck of category.decks) {
      const deckSel = categorySel[deck.name];
      if (!deckSel || typeof deckSel !== 'object') continue;
      const valid = new Set(deck.chapters.map((chapter) => chapter.name));
      for (const chapterName of Object.keys(deckSel)) {
        if (!valid.has(chapterName)) {
          delete deckSel[chapterName];
          removed += 1;
        }
      }
      if (Object.keys(deckSel).length === 0) delete categorySel[deck.name];
    }
    if (Object.keys(categorySel).length === 0) delete leaves[category.name];
  }
  // 分类 / 卡组整块都已不存在的旧键也一并清掉。
  const categoryNames = new Set(tree.map((category) => category.name));
  for (const categoryName of Object.keys(leaves)) {
    if (!categoryNames.has(categoryName)) {
      removed += Object.values(leaves[categoryName] || {}).reduce(
        (sum, decks) => sum + Object.keys(decks || {}).length, 0,
      );
      delete leaves[categoryName];
    }
  }
  if (removed > 0) scSaveSettings();
  return removed;
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
