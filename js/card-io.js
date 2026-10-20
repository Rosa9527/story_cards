// ===== 剧情抽卡（Story Cards）卡牌导入 / 导出：整库存成一份 JSON =====
// 导出：把当前卡库（构建期卡库 + 已导入的卡）序列化成 .json 下载。
// 导入：选一个 .json，归一化后并入卡库（同 id 覆盖，方便改了卡面再导回来）。
//
// 文件格式：
// {
//   "format": "story-cards",
//   "version": 1,
//   "exportedAt": "2026-10-20T12:00:00.000Z",
//   "count": 138,
//   "cards": [ { id, number, name, type, deck, category, chapter, rel, face, notes, noteItems } ]
// }
// 导入时也接受裸数组 [ ... ]、{ "cards": [ ... ] } 和老版本的 { "customCards": [ ... ] }。

// 从 File 读出文本（宿主 / 浏览器差异都兜住）。
function scReadFileText(file) {
  if (file && typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

// 把导入的条目补成完整卡：缺卡组 / 分类 / 主题的归到「未分组」这类兜底，
// 缺 id 的用卡号或卡名顶上。真正写库前的字段校验仍在 scNormalizeCard 里。
function scPrepareImportedCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pick = (value, fallback) => String(value == null ? '' : value).trim() || fallback;
  const number = pick(raw.number, '');
  const name = pick(raw.name, '');
  const id = pick(raw.id, '') || number || name;
  if (!id) return null;
  return {
    id,
    number,
    name: name || id,
    type: raw.type,
    deck: pick(raw.deck, '未分组'),
    category: pick(raw.category, '未分类'),
    chapter: pick(raw.chapter, '未分主题'),
    rel: raw.rel,
    face: raw.face,
    notes: raw.notes,
    noteItems: raw.noteItems,
  };
}

// 解析 JSON 文本，返回 { rawCards, error }。只负责找出数组，不动内容。
function scParseCardJson(text) {
  let data;
  try {
    data = JSON.parse(String(text == null ? '' : text));
  } catch (error) {
    return { rawCards: null, error: '不是合法的 JSON 文件' };
  }
  if (Array.isArray(data)) return { rawCards: data, error: '' };
  if (data && Array.isArray(data.cards)) return { rawCards: data.cards, error: '' };
  if (data && Array.isArray(data.customCards)) return { rawCards: data.customCards, error: '' };
  return { rawCards: null, error: 'JSON 里没有 cards 数组' };
}

// 卡牌指纹：用来判断导入的这张跟内置的完全一样，一样就不必再存一份副本。
function scCardSignature(card) {
  return JSON.stringify([
    card.id,
    card.number || '',
    card.name || '',
    card.type || '',
    card.deck || '',
    card.category || '',
    card.chapter || '',
    card.face || '',
    card.notes || '',
    Array.isArray(card.noteItems)
      ? card.noteItems.map((item) => [String(item?.key || ''), String(item?.value || '')])
      : [],
  ]);
}

function scReportImportError(error) {
  scSetCardStatus(`导入失败：${error}`, 'error');
  scToast('warning', `导入失败：${error}`);
  return { ok: false, error, added: 0, replaced: 0, unchanged: 0, total: scGetLibrary().length };
}

// 导入文本 → 归一化 → 入库 → 刷新界面。返回可直接断言的统计。
function scImportCardsFromText(text) {
  const parsed = scParseCardJson(text);
  if (parsed.error) return scReportImportError(parsed.error);
  const cards = [];
  for (const raw of parsed.rawCards) {
    const card = scPrepareImportedCard(raw);
    if (card) cards.push(card);
  }
  if (cards.length === 0) return scReportImportError('文件里没有可用的卡牌条目');

  // 跟内置卡完全相同的条目直接跳过：导出再导入同一份卡库时，不会把整个
  // 内置卡库复制进设置里（settings 体积会翻倍且毫无意义）。
  const builtinSignatures = new Map();
  for (const card of scGetBuiltinLibrary()) builtinSignatures.set(card.id, scCardSignature(card));
  const incoming = [];
  let unchanged = 0;
  for (const card of cards) {
    const signature = builtinSignatures.get(card.id);
    if (signature !== undefined && signature === scCardSignature(card)) unchanged += 1;
    else incoming.push(card);
  }

  const result = incoming.length > 0
    ? scAddCustomCards(incoming)
    : { added: 0, replaced: 0, total: scGetCustomCards().length, truncated: 0 };
  const parts = [];
  if (incoming.length > 0) parts.push(`导入 ${cards.length} 张（新增 ${result.added}，覆盖 ${result.replaced}）`);
  if (unchanged > 0) parts.push(`${unchanged} 张与内置一致，未写入`);
  if (parsed.rawCards.length > cards.length) parts.push(`跳过无效条目 ${parsed.rawCards.length - cards.length} 条`);
  if (result.truncated) parts.push(`卡库超上限，丢弃最早 ${result.truncated} 张`);
  const summary = parts.join('；');
  // 先重画范围树（新卡组要出现在树里），再写状态行——反过来会被概况覆盖掉。
  scRenderScopeTree();
  scSetCardStatus(summary, 'ok');
  scToast('success', summary);
  return {
    ok: true,
    error: '',
    added: result.added,
    replaced: result.replaced,
    unchanged,
    total: scGetLibrary().length,
    truncated: result.truncated,
    skipped: parsed.rawCards.length - cards.length,
  };
}

// 导出用的卡牌快照：只留可导入的字段，去掉运行期标记。
function scBuildExportCards() {
  return scGetLibrary().map((card) => ({
    id: card.id,
    number: card.number || '',
    name: card.name || card.id,
    type: card.type || '',
    deck: card.deck,
    category: card.category,
    chapter: card.chapter,
    rel: card.rel || '',
    face: card.face || '',
    notes: card.notes || '',
    noteItems: Array.isArray(card.noteItems)
      ? card.noteItems.map((item) => ({ key: String(item?.key || ''), value: String(item?.value || '') }))
      : [],
  }));
}

function scBuildExportJson() {
  const cards = scBuildExportCards();
  return JSON.stringify({
    format: SC_CARD_JSON_FORMAT,
    version: SC_CARD_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    count: cards.length,
    cards,
  }, null, 2);
}

// 本地时间戳：story-cards-20261020-153045.json（排序友好，同一天多次导出不重名）。
function scExportFileName(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const d = date instanceof Date && Number.isFinite(date.getTime()) ? date : new Date();
  return `story-cards-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    + `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

// 触发浏览器下载。宿主不支持 Blob / URL 时返回 false，由调用方提示。
function scDownloadTextFile(text, fileName) {
  const BlobCtor = globalThis.Blob;
  const urlApi = globalThis.URL;
  const doc = globalThis.document;
  if (typeof BlobCtor !== 'function' || !urlApi || typeof urlApi.createObjectURL !== 'function' || !doc) {
    return false;
  }
  let url = '';
  let anchor = null;
  try {
    url = urlApi.createObjectURL(new BlobCtor([text], { type: 'application/json;charset=utf-8' }));
    anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    doc.body.appendChild(anchor);
    if (typeof anchor.click !== 'function') return false;
    anchor.click();
    return true;
  } catch (error) {
    console.error(`[${SC_MODULE_DISPLAY_NAME}] 导出失败`, error);
    return false;
  } finally {
    if (anchor && anchor.parentNode) anchor.remove();
    if (url && typeof urlApi.revokeObjectURL === 'function') {
      // 立刻 revoke 会让部分内核来不及取数据，等一拍再释放。
      setTimeout(() => {
        try {
          urlApi.revokeObjectURL(url);
        } catch (error) { /* 已释放就忽略 */ }
      }, 1000);
    }
  }
}

// 点「导出卡片」走这里。
function scHandleExportCards() {
  const cards = scBuildExportCards();
  if (cards.length === 0) {
    scSetCardStatus('卡库是空的，没有可导出的卡牌', 'muted');
    scToast('warning', '卡库是空的，没有可导出的卡牌');
    return;
  }
  const customCount = scGetCustomCards().length;
  const builtinCount = cards.length - customCount;
  const summary = `已导出 ${cards.length} 张（内置 ${builtinCount}，导入 ${customCount}）`;
  const fileName = scExportFileName(new Date());
  if (!scDownloadTextFile(scBuildExportJson(), fileName)) {
    const error = '当前宿主不支持文件下载';
    scSetCardStatus(`导出失败：${error}`, 'error');
    scToast('warning', `导出失败：${error}`);
    return;
  }
  scSetCardStatus(`已导出 ${cards.length} 张 → ${fileName}`, 'ok');
  scToast('success', summary);
}

// 隐藏的 <input type="file">，只收 .json。
function scEnsureImportInput() {
  let input = scEl(SC_IMPORT_FILE_INPUT_ID);
  if (!input) {
    input = scCreate('input', 'sc-file-input');
    input.type = 'file';
    input.id = SC_IMPORT_FILE_INPUT_ID;
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (file) scHandlePickedJsonFile(file);
    });
    document.body.appendChild(input);
  }
  return input;
}

// 收到 JSON 文件后：校验大小 → 读文本 → 导入。
async function scHandlePickedJsonFile(file) {
  const size = Number(file.size);
  if (Number.isFinite(size) && size > SC_CARD_JSON_MAX_BYTES) {
    const limitMb = Math.round(SC_CARD_JSON_MAX_BYTES / (1024 * 1024));
    const error = `文件太大（上限 ${limitMb} MB）`;
    scSetCardStatus(`导入失败：${error}`, 'error');
    scToast('warning', `导入失败：${error}`);
    return;
  }
  scSetCardStatus(`正在读取 ${file.name || 'JSON 文件'}…`, 'muted');
  let text;
  try {
    text = await scReadFileText(file);
  } catch (error) {
    const message = String(error?.message || error);
    scSetCardStatus(`读取失败：${message}`, 'error');
    scToast('warning', `读取失败：${message}`);
    return;
  }
  scImportCardsFromText(text);
}

// 点「导入卡片」走这里。
function scHandleImportCards() {
  const input = scEnsureImportInput();
  scSetCardStatus('请选择卡牌 .json 文件…', 'muted');
  input.click();
}
