// ===== 剧情抽卡（Story Cards）卡牌解析器（构建期与运行期共用）=====
// 卡牌 Markdown 的结构（cards/<卡组>/<分类>/<回目>/<卡号>-<卡名>.md）：
//
//   # C1-03 半盏灯
//
//   **类型**：失去 / 疏忽
//   **分类**：现实类
//
//   ## 卡面
//
//   <卡面正文……>
//
//   ## 注意事项
//
//   **合理化**：……
//   **甲是谁**：……
//
//   ## 设计底稿        ← 可选，不参与抽卡内容
//
// 解析约定：
// - 卡面 = 「## 卡面」段正文，是注入给主模型的场景内容；
// - 注意事项 = 「## 注意事项」段整体，是给主模型的合理化/替换说明，必须一起带上，
//   否则卡面里那些「甲」「那两个人」会在具体世界观里落不了地；
// - 设计底稿等其它段落一律丢弃（那是给作者看的，不是给主模型的）；
// - 段落缺失时降级为空串，绝不因为一张卡格式不标准就让整次构建失败。
//
// 本文件是普通脚本（非 ES module）：浏览器里由 index.js 直接拼接使用，Node 里由
// build.js 通过 require 使用。两种环境共用同一份解析逻辑，保证「构建期写进数据的
// 字段」与「运行期读数据的字段」永远同构。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.SC_CARD_PARSE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CARD_FACE_HEADING = '卡面';
  const CARD_NOTES_HEADING = '注意事项';
  const CARD_DRAFT_HEADING = '设计底稿';

  // 卡片 ID：取文件名主干（如 C1-03-半盏灯）。卡面标题里的卡号写法不统一
  // （C1-03 / F16-01 混用），文件名主干才是唯一稳定的标识。
  function parseCardId(stem) {
    return String(stem || '').trim();
  }

  // 卡面标题行（# C1-03 半盏灯）→ { number, name }。缺标题时回退文件名。
  function parseCardTitle(text, stem) {
    const match = String(text || '').match(/^#\s+(.+?)\s*$/m);
    const raw = match ? match[1].trim() : String(stem || '').trim();
    // 「C1-03 半盏灯」→ number=C1-03, name=半盏灯；没有空格时整串当名字。
    const split = raw.match(/^([A-Za-z]+\d+(?:-\d+)?)\s+(.+)$/);
    if (split) return { number: split[1], name: split[2].trim() };
    return { number: '', name: raw };
  }

  // 取「## <标题>」段落的正文，直到下一个同级或更高级标题为止。
  function extractSection(text, heading) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const target = String(heading || '').trim();
    let start = -1;
    let level = 0;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!match) continue;
      if (match[2].trim() === target) {
        start = i + 1;
        level = match[1].length;
        break;
      }
    }
    if (start === -1) return '';
    const out = [];
    for (let i = start; i < lines.length; i++) {
      const match = lines[i].match(/^(#{1,6})\s+/);
      if (match && match[1].length <= level) break;
      out.push(lines[i]);
    }
    return out.join('\n').trim();
  }

  // 「**键**：值」行 → { key, value }，非此格式返回 null。
  function parseMetaLine(line) {
    const match = String(line || '').match(/^\*\*(.+?)\*\*\s*[：:]\s*(.*)$/);
    if (!match) return null;
    return { key: match[1].trim(), value: match[2].trim() };
  }

  // 从「注意事项」段里抽「**键**：值」条目；返回 [{ key, value }]。
  // 连续多行（值里带换行）会并入上一条，保证长说明不被截断。
  function parseNoteItems(notesText) {
    const items = [];
    const lines = String(notesText || '').replace(/\r\n?/g, '\n').split('\n');
    for (const line of lines) {
      const meta = parseMetaLine(line);
      if (meta) {
        items.push(meta);
        continue;
      }
      if (!items.length) continue;
      const trimmed = line.trim();
      if (!trimmed) continue;
      // 段落里的普通行（不是「**键**：」开头）续到上一条的值里。
      items[items.length - 1].value += '\n' + trimmed;
    }
    return items;
  }

  // 解析一张卡：输入 Markdown 原文与文件名主干，输出卡库条目。
  function parseCard(text, stem) {
    const source = String(text || '');
    const title = parseCardTitle(source, stem);
    let type = '';
    let category = '';
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    for (const line of lines) {
      const meta = parseMetaLine(line);
      if (!meta) continue;
      if (meta.key === '类型' && !type) type = meta.value;
      if (meta.key === '分类' && !category) category = meta.value;
    }
    const face = extractSection(source, CARD_FACE_HEADING);
    const notes = extractSection(source, CARD_NOTES_HEADING);
    return {
      id: parseCardId(stem),
      number: title.number,
      name: title.name,
      type,
      category,
      face,
      notes,
      noteItems: parseNoteItems(notes),
      // 设计底稿刻意不保留：它只服务作者，进提示词会干扰主模型。
      hasDraft: extractSection(source, CARD_DRAFT_HEADING) !== '',
    };
  }

  return {
    parseCard,
    parseCardId,
    parseCardTitle,
    extractSection,
    parseNoteItems,
    CARD_FACE_HEADING,
    CARD_NOTES_HEADING,
    CARD_DRAFT_HEADING,
  };
});
