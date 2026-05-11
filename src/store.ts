import { create } from 'zustand';
import type { Paragraph, Document } from './types';
import { normalizeParagraph, insertTextAt, mergeParagraphs } from './engine';

// ---- helpers ----

function flatLength(p: Paragraph): number {
  let len = 0;
  for (const c of p.children) {
    if (c.type === 'text') len += c.insert.length;
  }
  return len;
}

/** 将段落中 [from, to) 范围内的字符标记为 deleted */
function softDeleteRange(para: Paragraph, from: number, to: number): Paragraph {
  if (from >= to) return para;

  const result: Paragraph['children'] = [];
  let pos = 0;

  for (const child of para.children) {
    if (child.type === 'soft-break') {
      result.push(child);
      continue;
    }

    const spanLen = child.insert.length;
    const spanEnd = pos + spanLen;

    // 该 span 在删除范围之前 → 不动
    if (spanEnd <= from) {
      result.push(child);
      pos = spanEnd;
      continue;
    }

    // 该 span 在删除范围之后 → 不动
    if (pos >= to) {
      result.push(child);
      pos = spanEnd;
      continue;
    }

    // span 与删除范围有交集 → 需要分片
    const delStart = Math.max(from, pos);
    const delEnd = Math.min(to, spanEnd);

    const before = child.insert.slice(0, delStart - pos);
    const inside = child.insert.slice(delStart - pos, delEnd - pos);
    const after = child.insert.slice(delEnd - pos);

    const attrs = child.attributes;

    if (before) {
      result.push({ ...child, insert: before });
    }
    if (inside) {
      result.push({ type: 'text', insert: inside, status: 'deleted', attributes: attrs });
    }
    if (after) {
      result.push({ ...child, insert: after });
    }

    pos = spanEnd;
  }

  return normalizeParagraph({ ...para, children: result });
}

/** 真删除 offset 位置的 1 个字符（仅在 collapsed cursor 时调用） */
function hardDeleteChar(para: Paragraph, offset: number): Paragraph {
  const result: Paragraph['children'] = [];
  let pos = 0;
  let removed = false;

  for (const child of para.children) {
    if (child.type === 'soft-break') {
      result.push(child);
      continue;
    }

    if (removed) {
      result.push(child);
      continue;
    }

    const spanLen = child.insert.length;
    const spanEnd = pos + spanLen;

    if (offset < pos || offset >= spanEnd) {
      result.push(child);
      pos = spanEnd;
      continue;
    }

    // offset 在这个 span 里
    const idx = offset - pos;
    const left = child.insert.slice(0, idx);
    const right = child.insert.slice(idx + 1);

    if (left || right) {
      if (left) result.push({ ...child, insert: left });
      if (right) result.push({ ...child, insert: right });
    }
    // 如果 left 和 right 都为空，这个 span 被删光了，就不 push

    removed = true;
    pos = spanEnd;
  }

  return normalizeParagraph({ ...para, children: result });
}

// ---- selection helpers ----

interface EditorSelection {
  paragraphId: string;
  anchor: number;
  focus: number;
}

function isCollapsed(sel: EditorSelection): boolean {
  return sel.anchor === sel.focus;
}

function ordered(sel: EditorSelection): { from: number; to: number } {
  return {
    from: Math.min(sel.anchor, sel.focus),
    to: Math.max(sel.anchor, sel.focus),
  };
}

// ---- store ----

interface EditorState {
  document: Document;
  selection: EditorSelection | null;
  isComposing: boolean;

  setSelection: (sel: EditorSelection | null) => void;
  setIsComposing: (v: boolean) => void;

  insertText: (text: string) => void;
  softDelete: (direction: 'backward' | 'forward') => void;
  hardDelete: () => void;
  splitParagraph: () => void;
  loadDocument: (doc: Document) => void;
}

export const useStore = create<EditorState>((set, get) => ({
  document: { chapterId: 'ch1', paragraphs: [{ id: 'p1', children: [] }] },
  selection: null,
  isComposing: false,

  setSelection: (sel) => set({ selection: sel }),
  setIsComposing: (v) => set({ isComposing: v }),

  insertText: (text) => {
    const { document, selection } = get();
    if (!selection) return;

    let paraId = selection.paragraphId;
    let anchor = selection.anchor;

    // 有选区 → 先软删选区，在删除位置插入新文本 (PRD 2.3)
    if (!isCollapsed(selection)) {
      const idx = document.paragraphs.findIndex((p) => p.id === paraId);
      if (idx === -1) return;
      const para = document.paragraphs[idx];
      const { from } = ordered(selection);
      const afterSoftDel = softDeleteRange(para, from, Math.max(selection.anchor, selection.focus));
      const afterInsert = insertTextAt(afterSoftDel, from, text);
      set((s) => ({
        document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === paraId ? afterInsert : p)) },
        selection: { paragraphId: paraId, anchor: from + text.length, focus: from + text.length },
      }));
      return;
    }

    set((s) => ({
      document: {
        ...s.document,
        paragraphs: s.document.paragraphs.map((p) =>
          p.id === paraId ? insertTextAt(p, anchor, text) : p,
        ),
      },
      selection: { paragraphId: paraId, anchor: anchor + text.length, focus: anchor + text.length },
    }));
  },

  softDelete: (direction) => {
    const { document, selection, isComposing } = get();
    if (!selection || isComposing) return;

    const paras = document.paragraphs;
    const idx = paras.findIndex((p) => p.id === selection.paragraphId);
    if (idx === -1) return;
    const para = paras[idx];

    if (!isCollapsed(selection)) {
      // 有选区 → 软删选区
      const { from, to } = ordered(selection);
      const updated = softDeleteRange(para, from, to);
      set((s) => ({
        document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
        selection: { paragraphId: para.id, anchor: from, focus: from },
      }));
      return;
    }

    // 折叠光标
    const pos = selection.anchor;

    if (direction === 'backward') {
      if (pos > 0) {
        const updated = softDeleteRange(para, pos - 1, pos);
        set((s) => ({
          document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
          selection: { paragraphId: para.id, anchor: pos - 1, focus: pos - 1 },
        }));
      } else if (idx > 0) {
        // 段落开头 → 合并到上一段
        const prev = paras[idx - 1];
        const prevLen = flatLength(prev);
        const merged = mergeParagraphs(prev, para);
        const newParas = [...paras];
        newParas.splice(idx - 1, 2, merged);
        set((s) => ({
          document: { ...s.document, paragraphs: newParas },
          selection: { paragraphId: merged.id, anchor: prevLen, focus: prevLen },
        }));
      }
    } else {
      // forward (Delete)
      const len = flatLength(para);
      if (pos < len) {
        const updated = softDeleteRange(para, pos, pos + 1);
        set((s) => ({
          document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
          selection: { paragraphId: para.id, anchor: pos, focus: pos },
        }));
      } else if (idx < paras.length - 1) {
        // 段尾 → 合并下一段
        const next = paras[idx + 1];
        const merged = mergeParagraphs(para, next);
        const newParas = [...paras];
        newParas.splice(idx, 2, merged);
        set((s) => ({
          document: { ...s.document, paragraphs: newParas },
          selection: { paragraphId: merged.id, anchor: pos, focus: pos },
        }));
      }
    }
  },

  hardDelete: () => {
    const { document, selection, isComposing } = get();
    if (!selection || isComposing) return;

    // 安全锁：有选区时降级为软删除
    if (!isCollapsed(selection)) {
      get().softDelete('backward');
      return;
    }

    const paras = document.paragraphs;
    const idx = paras.findIndex((p) => p.id === selection.paragraphId);
    if (idx === -1) return;
    const para = paras[idx];
    const pos = selection.anchor;

    if (pos > 0) {
      const updated = hardDeleteChar(para, pos - 1);
      set((s) => ({
        document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
        selection: { paragraphId: para.id, anchor: pos - 1, focus: pos - 1 },
      }));
    } else if (idx > 0) {
      // 段落开头 → 硬合并（不带 soft-break）
      const prev = paras[idx - 1];
      const prevLen = flatLength(prev);
      const hardMerged: Paragraph = {
        id: prev.id,
        children: [...prev.children, ...para.children],
      };
      const normalized = normalizeParagraph(hardMerged);
      const newParas = [...paras];
      newParas.splice(idx - 1, 2, normalized);
      set((s) => ({
        document: { ...s.document, paragraphs: newParas },
        selection: { paragraphId: normalized.id, anchor: prevLen, focus: prevLen },
      }));
    }
  },

  splitParagraph: () => {
    const { document, selection } = get();
    if (!selection || !isCollapsed(selection)) return;

    const paras = document.paragraphs;
    const idx = paras.findIndex((p) => p.id === selection.paragraphId);
    if (idx === -1) return;
    const para = paras[idx];
    const pos = selection.anchor;

    // 从 offset 处切开段落
    const leftChildren: Paragraph['children'] = [];
    const rightChildren: Paragraph['children'] = [];
    let accumulated = 0;
    let split = false;

    for (const child of para.children) {
      if (child.type === 'soft-break') {
        (split ? rightChildren : leftChildren).push(child);
        continue;
      }

      const spanLen = child.insert.length;
      const spanEnd = accumulated + spanLen;

      if (!split && pos <= accumulated) {
        split = true;
      }

      if (!split && pos >= spanEnd) {
        leftChildren.push(child);
      } else if (split && pos <= accumulated) {
        rightChildren.push(child);
      } else {
        // pos 在这个 span 内部 → 切开
        const cutAt = pos - accumulated;
        const leftText = child.insert.slice(0, cutAt);
        const rightText = child.insert.slice(cutAt);

        if (leftText) leftChildren.push({ ...child, insert: leftText });
        if (rightText) rightChildren.push({ ...child, insert: rightText });
        split = true;
      }

      accumulated = spanEnd;
    }

    const newId = 'p' + Date.now();
    const newParas = [...paras];
    newParas.splice(idx, 1,
      normalizeParagraph({ ...para, id: para.id, children: leftChildren }),
      normalizeParagraph({ id: newId, children: rightChildren }),
    );

    set((s) => ({
      document: { ...s.document, paragraphs: newParas },
      selection: { paragraphId: newId, anchor: 0, focus: 0 },
    }));
  },

  loadDocument: (doc) => set({ document: doc }),
}));
