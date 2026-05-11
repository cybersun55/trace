import type { Paragraph, InlineNode, TextSpan, SoftBreakSpan } from './types';

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

/** 在指定字符偏移处插入文本，支持废墟建房 */
export function insertTextAt(paragraph: Paragraph, offset: number, text: string): Paragraph {
  if (!text) return paragraph;

  const result: InlineNode[] = [];
  let pos = 0;    // 当前在 flat text 中的位置
  let done = false;

  for (const child of paragraph.children) {
    if (done) {
      result.push(child);
      continue;
    }

    if (child.type === 'soft-break') {
      // SoftBreak 零宽度，不推进 pos
      if (offset === pos) {
        // 在 soft-break 所在位置插入 → 放到它后面
        result.push(child);
        result.push(span(text, 'normal'));
        done = true;
      } else {
        result.push(child);
      }
      continue;
    }

    // child 是 TextSpan
    const spanLen = child.insert.length;
    const spanEnd = pos + spanLen;

    if (offset <= pos) {
      // 在 span 之前插入
      result.push(span(text, 'normal'));
      result.push(child);
      done = true;
    } else if (offset < spanEnd) {
      // 在 span 内部插入 → 需要分割
      const splitAt = offset - pos;
      const left = child.insert.slice(0, splitAt);
      const right = child.insert.slice(splitAt);

      if (left) {
        result.push({ ...child, insert: left });
      }
      result.push(span(text, 'normal'));
      if (right) {
        result.push({ ...child, insert: right });
      }
      done = true;
    } else {
      // offset 还在更后面
      result.push(child);
    }

    pos = spanEnd;
  }

  if (!done) {
    // offset 在段落末尾之外
    result.push(span(text, 'normal'));
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

// ---- helpers ----

function span(insert: string, status: 'normal' | 'deleted' = 'normal'): TextSpan {
  return { type: 'text', insert, status };
}

function sameAttrs(a: TextSpan['attributes'], b: TextSpan['attributes']): boolean {
  return (a?.bold ?? false) === (b?.bold ?? false) && (a?.italic ?? false) === (b?.italic ?? false);
}
