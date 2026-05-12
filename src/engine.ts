import type { Paragraph, InlineNode, TextSpan, SoftBreakSpan, AllowedStyles } from './types';

/** 合并相邻同状态同属性的 TextSpan */
export function normalizeParagraph(paragraph: Paragraph): Paragraph {
  const merged: InlineNode[] = [];

  for (const child of paragraph.children) {
    if (child.type === 'soft-break') {
      merged.push(child);
      continue;
    }

    const last = merged[merged.length - 1];
    if (
      last &&
      last.type === 'text' &&
      last.status === child.status &&
      sameAttrs(last.attributes, child.attributes)
    ) {
      last.insert += child.insert;
    } else {
      merged.push({ ...child });
    }
  }

  return { ...paragraph, children: merged };
}

/** 在指定字符偏移处插入文本，支持废墟建房。
 *  attrs 用于为新文本指定格式；若不传则继承周围 span 的属性。 */
export function insertTextAt(paragraph: Paragraph, offset: number, text: string, attrs?: AllowedStyles): Paragraph {
  if (!text) return paragraph;

  const result: InlineNode[] = [];
  let pos = 0;
  let done = false;

  for (const child of paragraph.children) {
    if (done) {
      result.push(child);
      continue;
    }

    if (child.type === 'soft-break') {
      if (offset === pos) {
        result.push(child);
        result.push(span(text, 'normal', attrs));
        done = true;
      } else {
        result.push(child);
      }
      continue;
    }

    const spanLen = child.insert.length;
    const spanEnd = pos + spanLen;

    if (offset <= pos) {
      result.push(span(text, 'normal', attrs));
      result.push(child);
      done = true;
    } else if (offset < spanEnd) {
      const splitAt = offset - pos;
      const left = child.insert.slice(0, splitAt);
      const right = child.insert.slice(splitAt);

      if (left) result.push({ ...child, insert: left });
      // Inherit surrounding span's attrs, overridden by explicit attrs
      const inherit = attrs ?? child.attributes;
      result.push(span(text, 'normal', inherit));
      if (right) result.push({ ...child, insert: right });
      done = true;
    } else {
      result.push(child);
    }

    pos = spanEnd;
  }

  if (!done) {
    result.push(span(text, 'normal', attrs));
  }

  return normalizeParagraph({ ...paragraph, children: result });
}

/** 段落软删合并：在交界处插入幽灵 soft-break */
export function mergeParagraphs(para1: Paragraph, para2: Paragraph): Paragraph {
  const softBreak: SoftBreakSpan = { type: 'soft-break', status: 'deleted' };
  const merged: InlineNode[] = [
    ...para1.children,
    softBreak,
    ...para2.children,
  ];

  return normalizeParagraph({
    id: para1.id,
    children: merged,
  });
}

/** 对 [from, to) 范围的文本应用格式属性（合并到已有属性上） */
export function formatRange(para: Paragraph, from: number, to: number, attrs: Partial<AllowedStyles>): Paragraph {
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
      pos = spanEnd;
      continue;
    }

    const segStart = Math.max(from, pos);
    const segEnd = Math.min(to, spanEnd);
    const before = child.insert.slice(0, segStart - pos);
    const mid = child.insert.slice(segStart - pos, segEnd - pos);
    const after = child.insert.slice(segEnd - pos);

    if (before) result.push({ ...child, insert: before });
    if (mid) {
      const merged: Record<string, unknown> = { ...child.attributes };
      for (const [k, v] of Object.entries(attrs)) {
        if (v === false || v === undefined) delete merged[k];
        else merged[k] = v;
      }
      result.push({ ...child, insert: mid, attributes: cleanAttrs(merged as AllowedStyles) });
    }
    if (after) result.push({ ...child, insert: after });

    pos = spanEnd;
  }

  return normalizeParagraph({ ...para, children: result });
}

/** 获取段落中某位置的格式属性（取前一个 span 的属性，若在位置 0 则取后一个） */
export function getFormatAt(para: Paragraph, offset: number): AllowedStyles {
  let pos = 0;
  for (const child of para.children) {
    if (child.type === 'soft-break') continue;
    const spanLen = child.insert.length;
    const spanEnd = pos + spanLen;
    if (offset > pos && offset <= spanEnd) {
      return child.attributes ?? {};
    }
    if (offset === pos) {
      // At a boundary — prefer the span that starts here
      if (child.attributes) return child.attributes;
    }
    pos = spanEnd;
  }
  // At end of paragraph — return attrs of last text span
  for (let i = para.children.length - 1; i >= 0; i--) {
    const c = para.children[i];
    if (c.type === 'text' && c.attributes) return c.attributes;
  }
  return {};
}

// ---- helpers ----

function span(insert: string, status: 'normal' | 'deleted' = 'normal', attrs?: AllowedStyles): TextSpan {
  return { type: 'text', insert, status, attributes: cleanAttrs(attrs) };
}

function sameAttrs(a: TextSpan['attributes'], b: TextSpan['attributes']): boolean {
  return (a?.bold ?? false) === (b?.bold ?? false)
    && (a?.italic ?? false) === (b?.italic ?? false)
    && (a?.color ?? undefined) === (b?.color ?? undefined)
    && (a?.fontSize ?? undefined) === (b?.fontSize ?? undefined);
}

function cleanAttrs(attrs: TextSpan['attributes']): TextSpan['attributes'] {
  if (!attrs) return undefined;
  const cleaned: Record<string, unknown> = {};
  if (attrs.bold) cleaned.bold = true;
  if (attrs.italic) cleaned.italic = true;
  if (attrs.color) cleaned.color = attrs.color;
  if (attrs.fontSize) cleaned.fontSize = attrs.fontSize;
  return Object.keys(cleaned).length > 0 ? (cleaned as AllowedStyles) : undefined;
}
