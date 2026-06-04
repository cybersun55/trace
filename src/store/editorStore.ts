import { create } from 'zustand';
import type { Paragraph, Document, AllowedStyles } from '../types';
import { normalizeParagraph, insertTextAt, formatRange, getFormatAt, mergeParagraphs } from '../engine';


let _pidCounter = 0;
function nextPid(): string {
  return 'p' + Date.now() + '_' + (_pidCounter++);
}

// ---- helpers ----

function flatLength(p: Paragraph): number {
  let len = 0;
  for (const c of p.children) {
    if (c.type === 'text') len += c.insert.length;
  }
  return len;
}

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

    if (spanEnd <= from) {
      result.push(child);
      pos = spanEnd;
      continue;
    }
    if (pos >= to) {
      result.push(child);
      pos = spanEnd;
      continue;
    }

    const delStart = Math.max(from, pos);
    const delEnd = Math.min(to, spanEnd);

    const before = child.insert.slice(0, delStart - pos);
    const inside = child.insert.slice(delStart - pos, delEnd - pos);
    const after = child.insert.slice(delEnd - pos);

    const attrs = child.attributes;

    if (before) result.push({ ...child, insert: before });
    if (inside) result.push({ type: 'text', insert: inside, status: 'deleted', attributes: attrs });
    if (after) result.push({ ...child, insert: after });

    pos = spanEnd;
  }

  return normalizeParagraph({ ...para, children: result });
}

/** 真删除 [from, to) 范围的字符 */
function hardDeleteRange(para: Paragraph, from: number, to: number): Paragraph {
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

    if (spanEnd <= from || pos >= to) {
      result.push(child);
    } else {
      const keepStart = Math.max(from, pos);
      const keepEnd = Math.min(to, spanEnd);
      const before = child.insert.slice(0, keepStart - pos);
      const after = child.insert.slice(keepEnd - pos);
      if (before) result.push({ ...child, insert: before });
      if (after) result.push({ ...child, insert: after });
    }
    pos = spanEnd;
  }

  return normalizeParagraph({ ...para, children: result });
}

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
    const idx = offset - pos;
    const left = child.insert.slice(0, idx);
    const right = child.insert.slice(idx + 1);
    if (left) result.push({ ...child, insert: left });
    if (right) result.push({ ...child, insert: right });
    removed = true;
    pos = spanEnd;
  }

  return normalizeParagraph({ ...para, children: result });
}

// ---- selection ----

interface EditorSelection {
  paragraphId: string;
  anchor: number;
  focus: number;
  focusParagraphId?: string; // set when focus is in a different paragraph
}

function isCollapsed(sel: EditorSelection): boolean {
  return sel.anchor === sel.focus && (!sel.focusParagraphId || sel.focusParagraphId === sel.paragraphId);
}

interface MultiRange {
  startPid: string;
  startOffset: number;
  endPid: string;
  endOffset: number;
}

/** Convert selection to ordered multi-paragraph range */
function getMultiRange(doc: Document, sel: EditorSelection): MultiRange | null {
  const aPid = sel.paragraphId;
  const fPid = sel.focusParagraphId || sel.paragraphId;
  const aIdx = doc.paragraphs.findIndex((p) => p.id === aPid);
  const fIdx = doc.paragraphs.findIndex((p) => p.id === fPid);
  if (aIdx === -1 || fIdx === -1) return null;

  if (aIdx < fIdx) {
    return { startPid: aPid, startOffset: sel.anchor, endPid: fPid, endOffset: sel.focus };
  } else if (aIdx > fIdx) {
    return { startPid: fPid, startOffset: sel.focus, endPid: aPid, endOffset: sel.anchor };
  } else {
    // Same paragraph: normalize offsets so startOffset <= endOffset
    return {
      startPid: aPid,
      startOffset: Math.min(sel.anchor, sel.focus),
      endPid: fPid,
      endOffset: Math.max(sel.anchor, sel.focus),
    };
  }
}

/** Apply or toggle formatting on a selection range within the document.
 *  For a boolean key where value is undefined, it toggles. */
function applyFormatToSelection(doc: Document, sel: EditorSelection, attrs: Partial<AllowedStyles>) {
  const range = getMultiRange(doc, sel);
  if (!range) return;

  const paras = doc.paragraphs;
  const sIdx = paras.findIndex((p) => p.id === range.startPid);
  const eIdx = paras.findIndex((p) => p.id === range.endPid);
  if (sIdx === -1 || eIdx === -1) return;

  // Only toggle boolean keys that are EXPLICITLY in attrs (from toggleBold/toggleItalic)
  let resolved = { ...attrs };
  for (const key of ['bold', 'italic'] as const) {
    if (key in attrs && attrs[key] === undefined) {
      let hasAll = true;
      let foundAny = false;
      for (let i = sIdx; i <= eIdx && hasAll; i++) {
        const p = paras[i];
        const f = i === sIdx ? range.startOffset : 0;
        const t = i === eIdx ? range.endOffset : flatLength(p);
        hasAll = rangeHasFormat(p, f, t, key);
        if (f < t) foundAny = true;
      }
      if (foundAny) {
        resolved = { ...resolved, [key]: hasAll ? false : true };
      }
    }
  }

  // Keep false/undefined values — formatRange uses them to remove keys
  const finalAttrs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(resolved)) {
    if (v === false || v === undefined) finalAttrs[k] = false; // false = "remove this key"
    else finalAttrs[k] = v;
  }

  const newParas = [...paras];
  for (let i = sIdx; i <= eIdx; i++) {
    const f = i === sIdx ? range.startOffset : 0;
    const t = i === eIdx ? range.endOffset : flatLength(newParas[i]);
    if (f >= t) continue;
    newParas[i] = formatRange(newParas[i], f, t, finalAttrs as Partial<AllowedStyles>);
  }

  useEditorStore.setState((s) => ({
    document: { ...s.document, paragraphs: newParas },
  }));
}

function rangeHasFormat(para: Paragraph, from: number, to: number, key: 'bold' | 'italic'): boolean {
  let pos = 0;
  for (const child of para.children) {
    if (child.type === 'soft-break') continue;
    const spanLen = child.insert.length;
    const spanEnd = pos + spanLen;
    if (spanEnd <= from || pos >= to) { pos = spanEnd; continue; }
    if (!child.attributes?.[key]) return false;
    pos = spanEnd;
  }
  return true;
}

// ---- store ----

interface EditorState {
  document: Document;
  selection: EditorSelection | null;
  isComposing: boolean;
  hideDeleted: boolean;
  activeFormats: AllowedStyles;

  setSelection: (sel: EditorSelection | null) => void;
  setIsComposing: (v: boolean) => void;
  toggleHideDeleted: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  setColor: (color: string | undefined) => void;
  setFontSize: (size: string | undefined) => void;
  setLineHeight: (lh: string | undefined) => void;

  insertText: (text: string) => void;
  softDelete: (direction: 'backward' | 'forward') => void;
  hardDelete: () => void;
  splitParagraph: () => void;
  loadDocument: (doc: Document) => void;
  getDocument: () => Document;
  initDocument: (doc: Document) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: { chapterId: 'ch1', paragraphs: [{ id: 'p1', children: [] }] },
  selection: null,
  isComposing: false,
  hideDeleted: false,
  activeFormats: {},

  setSelection: (sel) => {
    // Update activeFormats based on cursor position
    if (sel) {
      const para = get().document.paragraphs.find((p) => p.id === sel.paragraphId);
      if (para) {
        const fmt = getFormatAt(para, sel.anchor);
        set({ selection: sel, activeFormats: fmt });
        return;
      }
    }
    set({ selection: sel });
  },
  setIsComposing: (v) => set({ isComposing: v }),
  toggleHideDeleted: () => set((s) => ({ hideDeleted: !s.hideDeleted })),

  toggleBold: () => {
    const { document, selection, activeFormats } = get();
    if (!selection) return;
    if (!isCollapsed(selection)) {
      applyFormatToSelection(document, selection, { bold: undefined });
      return;
    }
    const next = { ...activeFormats };
    if (activeFormats.bold) delete next.bold; else next.bold = true;
    set({ activeFormats: next });
  },
  toggleItalic: () => {
    const { document, selection, activeFormats } = get();
    if (!selection) return;
    if (!isCollapsed(selection)) {
      applyFormatToSelection(document, selection, { italic: undefined });
      return;
    }
    const next = { ...activeFormats };
    if (activeFormats.italic) delete next.italic; else next.italic = true;
    set({ activeFormats: next });
  },
  setColor: (color) => {
    const { document, selection, activeFormats } = get();
    if (!selection) return;
    if (!isCollapsed(selection)) {
      applyFormatToSelection(document, selection, { color: color ?? undefined });
      return;
    }
    const next = { ...activeFormats };
    if (color) next.color = color; else delete next.color;
    set({ activeFormats: next });
  },
  setFontSize: (size) => {
    const { document, selection, activeFormats } = get();
    if (!selection) return;
    if (!isCollapsed(selection)) {
      applyFormatToSelection(document, selection, { fontSize: size ?? undefined });
      return;
    }
    const next = { ...activeFormats };
    if (size) next.fontSize = size; else delete next.fontSize;
    set({ activeFormats: next });
  },
  setLineHeight: (lh) => {
    const { document, selection } = get();
    if (!selection) return;
    const paraId = selection.paragraphId;
    set((s) => ({
      document: {
        ...s.document,
        paragraphs: s.document.paragraphs.map((p) =>
          p.id === paraId ? { ...p, lineHeight: lh } : p,
        ),
      },
    }));
  },

  insertText: (text) => {
    const { document, selection } = get();
    if (!selection) return;

    const paraId = selection.paragraphId;
    const anchor = selection.anchor;

    if (!isCollapsed(selection)) {
      const range = getMultiRange(document, selection);
      if (!range) return;
      // For now, only handle single-paragraph range replacement
      if (range.startPid !== range.endPid) return;
      const idx = document.paragraphs.findIndex((p) => p.id === paraId);
      if (idx === -1) return;
      const para = document.paragraphs[idx];
      const from = Math.min(range.startOffset, range.endOffset);
      const to = Math.max(range.startOffset, range.endOffset);
      const afterSoftDel = softDeleteRange(para, from, to);
      const afterInsert = insertTextAt(afterSoftDel, from, text, get().activeFormats);
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
          p.id === paraId ? insertTextAt(p, anchor, text, s.activeFormats) : p,
        ),
      },
      selection: { paragraphId: paraId, anchor: anchor + text.length, focus: anchor + text.length },
    }));
  },

  softDelete: (direction) => {
    const { document, selection, isComposing } = get();
    if (!selection || isComposing) return;

    const paras = document.paragraphs;

    // Handle non-collapsed (range) selection
    if (!isCollapsed(selection)) {
      const range = getMultiRange(document, selection);
      if (!range) return;

      const sIdx = paras.findIndex((p) => p.id === range.startPid);
      const eIdx = paras.findIndex((p) => p.id === range.endPid);
      if (sIdx === -1 || eIdx === -1) return;

      const newParas = [...paras];

      if (sIdx === eIdx) {
        // Single paragraph range
        const from = Math.min(range.startOffset, range.endOffset);
        const to = Math.max(range.startOffset, range.endOffset);
        if (from >= to) return;
        const updated = softDeleteRange(paras[sIdx], from, to);
        newParas[sIdx] = updated;
        set((s) => ({
          document: { ...s.document, paragraphs: newParas },
          selection: { paragraphId: updated.id, anchor: to, focus: to },
        }));
        return;
      }

      // Multi-paragraph soft delete: keep paragraphs separate, only mark text as deleted
      const firstLen = flatLength(paras[sIdx]);
      newParas[sIdx] = softDeleteRange(paras[sIdx], range.startOffset, firstLen);
      for (let i = sIdx + 1; i < eIdx; i++) {
        newParas[i] = softDeleteRange(paras[i], 0, flatLength(paras[i]));
      }
      newParas[eIdx] = softDeleteRange(paras[eIdx], 0, range.endOffset);

      set((s) => ({
        document: { ...s.document, paragraphs: newParas },
        selection: { paragraphId: range.endPid, anchor: range.endOffset, focus: range.endOffset },
      }));
      return;
    }

    // Collapsed cursor
    const idx = paras.findIndex((p) => p.id === selection.paragraphId);
    if (idx === -1) return;
    const para = paras[idx];
    const pos = selection.anchor;

    if (direction === 'backward') {
      if (pos > 0) {
        const updated = softDeleteRange(para, pos - 1, pos);
        set((s) => ({
          document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
          selection: { paragraphId: para.id, anchor: pos - 1, focus: pos - 1 },
        }));
      } else if (idx > 0) {
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
      const len = flatLength(para);
      if (pos < len) {
        const updated = softDeleteRange(para, pos, pos + 1);
        set((s) => ({
          document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
          selection: { paragraphId: para.id, anchor: pos, focus: pos },
        }));
      } else if (idx < paras.length - 1) {
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

  hardDelete: (direction?: 'backward' | 'forward') => {
    const dir = direction || 'backward';
    const { document, selection, isComposing } = get();
    if (!selection || isComposing) { console.log('[hardDelete] BAIL sel:', !!selection, 'comp:', isComposing); return; }

    const paras = document.paragraphs;

    // Handle non-collapsed (range) selection
    if (!isCollapsed(selection)) {
      const range = getMultiRange(document, selection);
      if (!range) return;

      const sIdx = paras.findIndex((p) => p.id === range.startPid);
      const eIdx = paras.findIndex((p) => p.id === range.endPid);
      if (sIdx === -1 || eIdx === -1) return;

      const newParas = [...paras];

      if (sIdx === eIdx) {
        // Single paragraph range
        const from = Math.min(range.startOffset, range.endOffset);
        const to = Math.max(range.startOffset, range.endOffset);
        if (from >= to) return;
        const updated = hardDeleteRange(paras[sIdx], from, to);
        newParas[sIdx] = updated;
        set((s) => ({
          document: { ...s.document, paragraphs: newParas },
          selection: { paragraphId: updated.id, anchor: from, focus: from },
        }));
        return;
      }

      // Multi-paragraph: hard-delete from startOffset to end of first
      const first = hardDeleteRange(paras[sIdx], range.startOffset, flatLength(paras[sIdx]));
      // Hard-delete from 0 to endOffset in last (intermediate paragraphs are fully removed)
      const last = hardDeleteRange(paras[eIdx], 0, range.endOffset);
      const merged = normalizeParagraph({ id: first.id, children: [...first.children, ...last.children] });

      newParas.splice(sIdx, eIdx - sIdx + 1, merged);
      set((s) => ({
        document: { ...s.document, paragraphs: newParas },
        selection: { paragraphId: merged.id, anchor: range.startOffset, focus: range.startOffset },
      }));
      return;
    }

    // Collapsed cursor
    const idx = paras.findIndex((p) => p.id === selection.paragraphId);
    if (idx === -1) { console.log('[hardDelete] para not found'); return; }
    const para = paras[idx];
    const pos = selection.anchor;

    console.log('[hardDelete] pos:', pos, 'flatLen:', flatLength(para), 'paraIdx:', idx, 'totalParas:', paras.length);

    if (dir === 'forward') {
      const len = flatLength(para);
      if (pos < len) {
        const updated = hardDeleteChar(para, pos);
        set((s) => ({
          document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
          selection: { paragraphId: para.id, anchor: pos, focus: pos },
        }));
      } else if (idx < paras.length - 1) {
        const next = paras[idx + 1];
        const merged = normalizeParagraph({ id: para.id, children: [...para.children, ...next.children] });
        const newParas = [...paras];
        newParas.splice(idx, 2, merged);
        set((s) => ({
          document: { ...s.document, paragraphs: newParas },
          selection: { paragraphId: merged.id, anchor: pos, focus: pos },
        }));
      }
    } else {
      if (pos > 0) {
        const updated = hardDeleteChar(para, pos - 1);
        set((s) => ({
          document: { ...s.document, paragraphs: s.document.paragraphs.map((p) => (p.id === para.id ? updated : p)) },
          selection: { paragraphId: para.id, anchor: pos - 1, focus: pos - 1 },
        }));
      } else if (idx > 0) {
        const prev = paras[idx - 1];
        const prevLen = flatLength(prev);
        const merged = normalizeParagraph({ id: prev.id, children: [...prev.children, ...para.children] });
        const newParas = [...paras];
        newParas.splice(idx - 1, 2, merged);
        set((s) => ({
          document: { ...s.document, paragraphs: newParas },
          selection: { paragraphId: merged.id, anchor: prevLen, focus: prevLen },
        }));
      }
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
        const cutAt = pos - accumulated;
        const leftText = child.insert.slice(0, cutAt);
        const rightText = child.insert.slice(cutAt);

        if (leftText) leftChildren.push({ ...child, insert: leftText });
        if (rightText) rightChildren.push({ ...child, insert: rightText });
        split = true;
      }

      accumulated = spanEnd;
    }

    const newId = nextPid();
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
  getDocument: () => get().document,
  initDocument: (doc) => set({ document: doc, selection: null, activeFormats: {}, hideDeleted: false }),
}));


