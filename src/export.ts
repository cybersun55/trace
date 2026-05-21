import { toPng } from 'html-to-image';
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

// ---- shared HTML rendering ----

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fontSizeCSS(s: string): string {
  const map: Record<string, string> = { small: '0.8em', medium: '1em', large: '1.5em' };
  return map[s] || s;
}

export type RenderMode = 'clean' | 'trace';

export function renderDocToHtml(doc: Document, mode: RenderMode): string {
  const paras = doc.paragraphs.map((p) => {
    const spans = p.children.map((child) => {
      if (child.type === 'soft-break') {
        if (mode === 'clean') return '';
        return '<span style="color:#c5bdb2;text-decoration:line-through;font-size:14px;margin:0 1px;">\u00B6</span>';
      }

      const cls = child.status === 'deleted' ? 't-del' : 't-norm';
      const st: string[] = [];
      if (child.attributes?.bold) st.push('font-weight:bold');
      if (child.attributes?.italic) st.push('font-style:italic');
      if (child.attributes?.fontSize) st.push(`font-size:${fontSizeCSS(child.attributes.fontSize)}`);
      if (child.attributes?.color && child.status !== 'deleted') st.push(`color:${child.attributes.color}`);

      let text = escapeHtml(child.insert);

      if (mode === 'trace' && child.status === 'deleted') {
        text = `<span class="t-del">${text}</span>`;
      } else if (mode === 'clean' && child.status === 'deleted') {
        return ''; // skip deleted in clean mode
      }

      const styleAttr = st.length > 0 ? ` style="${st.join(';')}"` : '';
      return `<span${styleAttr}>${text}</span>`;
    }).join('');

    return `<p class="t-para">${spans || '<span>\u200B</span>'}</p>`;
  }).join('\n');

  return paras;
}

export function renderDocToFullHtml(doc: Document, mode: RenderMode, title: string): string {
  const body = renderDocToHtml(doc, mode);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Noto Serif SC', serif;
    background: #fffef9; color: #2c2c2c; line-height: 1.8;
    max-width: 720px; margin: 40px auto; padding: 40px 60px;
  }
  .t-para { padding: 4px 0; min-height: 1.8em; font-size: 17px; letter-spacing: 0.02em; }
  .t-del { color: #b0a89b; text-decoration: line-through; }
</style>
</head>
<body>${body}</body>
</html>`;
}

// ---- Word (.doc) ----

export function exportWordBlob(doc: Document, mode: RenderMode = 'trace'): Blob {
  const body = renderDocToHtml(doc, mode);

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: 'Noto Serif SC', serif; color: #2c2c2c; line-height: 1.8; padding: 40px 60px; }
  .t-para { padding: 4px 0; font-size: 17px; }
  .t-del { color: #999; text-decoration: line-through; }
</style>
</head>
<body>${body}</body>
</html>`;

  return new Blob([html], { type: 'application/msword;charset=utf-8' });
}

// ---- Image (.png) ----

export async function exportImageBlob(doc: Document, mode: RenderMode = 'trace'): Promise<Blob> {
  // White overlay to hide the rendering process
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fffef9;';
  document.body.appendChild(overlay);

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 720px; padding: 48px 64px 64px;
    background: #fffef9; color: #2c2c2c;
    font-family: -apple-system, BlinkMacSystemFont, 'Noto Serif SC', serif;
    line-height: 1.8; z-index: 10000;
  `;

  const body = renderDocToHtml(doc, mode);
  const wordCount = countNormalChars(doc);

  container.innerHTML = `<style>
  .t-para { padding: 4px 0; }
  .t-del { color: #b0a89b; text-decoration: line-through; }
</style>
<div style="font-size:17px;letter-spacing:0.02em;">${body}</div>
<div style="margin-top:24px;text-align:right;font-size:12px;color:#b0a89b;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  ${wordCount.toLocaleString()} 字
</div>`;

  document.body.appendChild(container);

  // Wait for layout
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const dataUrl = await toPng(container, { pixelRatio: 2 });
    const resp = await fetch(dataUrl);
    return await resp.blob();
  } finally {
    document.body.removeChild(container);
    document.body.removeChild(overlay);
  }
}

function countNormalChars(doc: Document): number {
  let total = 0;
  for (const p of doc.paragraphs) {
    for (const c of p.children) {
      if (c.type === 'text' && c.status === 'normal') {
        total += [...c.insert].length;
      }
    }
  }
  return total;
}

// ---- Book combined exports ----

interface ChapterData {
  title: string;
  doc: Document;
}

export function exportBookPlainText(chapters: ChapterData[]): string {
  const parts: string[] = [];
  for (let i = 0; i < chapters.length; i++) {
    if (i > 0) parts.push('\n\n---\n\n');
    parts.push(exportPlainText(chapters[i].doc));
  }
  return parts.join('');
}

export function renderBookToHtml(chapters: ChapterData[], mode: RenderMode): string {
  const parts: string[] = [];
  for (const ch of chapters) {
    parts.push(`<h2 style="font-size:1.2em;font-weight:600;margin:1.5em 0 0.5em;color:#4a4238;">${escapeHtml(ch.title)}</h2>`);
    parts.push(renderDocToHtml(ch.doc, mode));
  }
  return parts.join('\n');
}

export function exportBookWordBlob(chapters: ChapterData[], mode: RenderMode = 'trace'): Blob {
  const body = renderBookToHtml(chapters, mode);

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: 'Noto Serif SC', serif; color: #2c2c2c; line-height: 1.8; padding: 40px 60px; }
  .t-para { padding: 4px 0; font-size: 17px; }
  .t-del { color: #999; text-decoration: line-through; }
</style>
</head>
<body>${body}</body>
</html>`;

  return new Blob([html], { type: 'application/msword;charset=utf-8' });
}

export async function exportBookImageBlob(
  chapters: ChapterData[],
  mode: RenderMode = 'trace',
): Promise<Blob> {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fffef9;';
  document.body.appendChild(overlay);

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 720px; padding: 48px 64px 64px;
    background: #fffef9; color: #2c2c2c;
    font-family: -apple-system, BlinkMacSystemFont, 'Noto Serif SC', serif;
    line-height: 1.8; z-index: 10000;
  `;

  const body = renderBookToHtml(chapters, mode);
  let totalWords = 0;
  for (const ch of chapters) totalWords += countNormalChars(ch.doc);

  container.innerHTML = `<style>
  .t-para { padding: 4px 0; }
  .t-del { color: #b0a89b; text-decoration: line-through; }
</style>
<div style="font-size:17px;letter-spacing:0.02em;">${body}</div>
<div style="margin-top:24px;text-align:right;font-size:12px;color:#b0a89b;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  ${totalWords.toLocaleString()} 字
</div>`;

  document.body.appendChild(container);

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const dataUrl = await toPng(container, { pixelRatio: 2 });
    const resp = await fetch(dataUrl);
    return await resp.blob();
  } finally {
    document.body.removeChild(container);
    document.body.removeChild(overlay);
  }
}
