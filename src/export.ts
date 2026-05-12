import type { Document } from './types';

export function exportPlainText(doc: Document): string {
  const parts: string[] = [];

  for (let i = 0; i < doc.paragraphs.length; i++) {
    const para = doc.paragraphs[i];
    if (i > 0) parts.push('\n\n');

    for (const child of para.children) {
      if (child.type === 'soft-break') continue;
      if (child.status === 'deleted') continue;
      parts.push(child.insert);
    }
  }

  return parts.join('');
}

export function exportMarkdown(doc: Document): string {
  const parts: string[] = [];

  for (let i = 0; i < doc.paragraphs.length; i++) {
    const para = doc.paragraphs[i];
    if (i > 0) parts.push('\n\n');

    for (const child of para.children) {
      if (child.type === 'soft-break') {
        parts.push('<!-- deleted break -->\n');
        continue;
      }

      let text = child.insert;

      if (child.status === 'deleted') {
        text = wrapFormat(text, child.attributes);
        text = `~~${text}~~`;
      } else {
        text = wrapFormat(text, child.attributes);
      }

      parts.push(text);
    }
  }

  return parts.join('');
}

function wrapFormat(text: string, attrs?: { bold?: boolean; italic?: boolean }): string {
  if (!attrs) return text;
  if (attrs.bold && attrs.italic) return `***${text}***`;
  if (attrs.bold) return `**${text}**`;
  if (attrs.italic) return `*${text}*`;
  return text;
}
