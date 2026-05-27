import { describe, it, expect } from 'vitest';
import {
  exportPlainText, exportMarkdown,
  renderDocToHtml, renderDocToFullHtml, exportWordBlob,
  renderBookToHtml, exportBookPlainText, exportBookWordBlob,
} from './export';
import type { Document, Paragraph } from './types';

function doc(paragraphs: Paragraph[]): Document {
  return { chapterId: 'ch1', paragraphs };
}

function p(id: string, children: Paragraph['children']): Paragraph {
  return { id, children };
}

function t(insert: string, status: 'normal' | 'deleted' = 'normal', attrs?: { bold?: boolean; italic?: boolean }): any {
  return { type: 'text', insert, status, attributes: attrs };
}

function sb(): any {
  return { type: 'soft-break', status: 'deleted' };
}

describe('exportPlainText', () => {
  it('outputs normal text, skips deleted', () => {
    const d = doc([p('1', [t('hello '), t('world', 'deleted'), t('!')])]);
    expect(exportPlainText(d)).toBe('hello !');
  });

  it('skips soft-break spans', () => {
    const d = doc([p('1', [t('hello'), sb(), t('world')])]);
    expect(exportPlainText(d)).toBe('helloworld');
  });

  it('separates paragraphs with double newline', () => {
    const d = doc([p('1', [t('para1')]), p('2', [t('para2')])]);
    expect(exportPlainText(d)).toBe('para1\n\npara2');
  });

  it('empty document returns empty string', () => {
    const d = doc([p('1', [])]);
    expect(exportPlainText(d)).toBe('');
  });

  it('all deleted paragraph returns empty', () => {
    const d = doc([p('1', [t('all gone', 'deleted')])]);
    expect(exportPlainText(d)).toBe('');
  });
});

describe('exportMarkdown', () => {
  it('outputs normal text as-is', () => {
    const d = doc([p('1', [t('hello world')])]);
    expect(exportMarkdown(d)).toBe('hello world');
  });

  it('wraps deleted text in ~~', () => {
    const d = doc([p('1', [t('hello'), t(' deleted ', 'deleted'), t('world')])]);
    expect(exportMarkdown(d)).toBe('hello~~ deleted ~~world');
  });

  it('bold text wrapped in **', () => {
    const d = doc([p('1', [t('bold', 'normal', { bold: true })])]);
    expect(exportMarkdown(d)).toBe('**bold**');
  });

  it('italic text wrapped in *', () => {
    const d = doc([p('1', [t('italic', 'normal', { italic: true })])]);
    expect(exportMarkdown(d)).toBe('*italic*');
  });

  it('bold+italic wrapped in ***', () => {
    const d = doc([p('1', [t('both', 'normal', { bold: true, italic: true })])]);
    expect(exportMarkdown(d)).toBe('***both***');
  });

  it('deleted bold text: ~~**text**~~', () => {
    const d = doc([p('1', [t('x', 'deleted', { bold: true })])]);
    expect(exportMarkdown(d)).toBe('~~**x**~~');
  });

  it('soft-break becomes HTML comment + newline', () => {
    const d = doc([p('1', [t('a'), sb(), t('b')])]);
    expect(exportMarkdown(d)).toBe('a<!-- deleted break -->\nb');
  });

  it('paragraphs separated by double newline', () => {
    const d = doc([p('1', [t('one')]), p('2', [t('two')])]);
    expect(exportMarkdown(d)).toBe('one\n\ntwo');
  });
});

describe('renderDocToHtml', () => {
  it('renders normal text in span', () => {
    const d = doc([p('1', [t('hello')])]);
    const html = renderDocToHtml(d, 'trace');
    expect(html).toContain('<span>hello</span>');
  });

  it('trace mode shows deleted text with strikethrough', () => {
    const d = doc([p('1', [t('normal'), t('deleted', 'deleted')])]);
    const html = renderDocToHtml(d, 'trace');
    expect(html).toContain('<span>normal</span>');
    expect(html).toContain('t-del');
    expect(html).toContain('deleted');
  });

  it('clean mode omits deleted text completely', () => {
    const d = doc([p('1', [t('keep'), t('gone', 'deleted')])]);
    const html = renderDocToHtml(d, 'clean');
    expect(html).toContain('keep');
    expect(html).not.toContain('gone');
    expect(html).not.toContain('t-del');
  });

  it('renders bold and italic styles', () => {
    const d = doc([p('1', [t('x', 'normal', { bold: true, italic: true })])]);
    const html = renderDocToHtml(d, 'trace');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('font-style:italic');
  });

  it('renders soft-break as pilcrow in trace mode', () => {
    const d = doc([p('1', [t('a'), sb(), t('b')])]);
    const html = renderDocToHtml(d, 'trace');
    expect(html).toContain('\u00B6');
  });

  it('omits soft-break in clean mode', () => {
    const d = doc([p('1', [t('a'), sb(), t('b')])]);
    const html = renderDocToHtml(d, 'clean');
    expect(html).not.toContain('\u00B6');
  });

  it('escapes HTML in text', () => {
    const d = doc([p('1', [t('<script>alert("x")</script>')])]);
    const html = renderDocToHtml(d, 'trace');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('wraps output in paragraph tags', () => {
    const d = doc([p('1', [t('hello')]), p('2', [t('world')])]);
    const html = renderDocToHtml(d, 'trace');
    expect(html).toMatch(/^<p class="t-para">/);
    expect(html.split('</p>').length).toBe(3); // two closing tags
  });
});

describe('renderDocToFullHtml', () => {
  it('wraps content in full HTML document', () => {
    const d = doc([p('1', [t('hello')])]);
    const html = renderDocToFullHtml(d, 'trace', 'My Title');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My Title</title>');
    expect(html).toContain('<span>hello</span>');
  });

  it('escapes title', () => {
    const d = doc([p('1', [t('x')])]);
    const html = renderDocToFullHtml(d, 'trace', '<b>Bad</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('exportWordBlob', () => {
  it('returns a Blob with Word MIME type', () => {
    const d = doc([p('1', [t('hello')])]);
    const blob = exportWordBlob(d, 'trace');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('application/msword');
  });

  it('contains content in blob', async () => {
    const d = doc([p('1', [t('hello world')])]);
    const blob = exportWordBlob(d, 'trace');
    const text = await blob.text();
    expect(text).toContain('hello world');
    expect(text).toContain('<html');
  });

  it('omits deleted text in clean mode', async () => {
    const d = doc([p('1', [t('keep'), t('gone', 'deleted')])]);
    const blob = exportWordBlob(d, 'clean');
    const text = await blob.text();
    expect(text).toContain('keep');
    expect(text).not.toContain('gone');
  });
});

describe('renderBookToHtml', () => {
  it('renders chapter titles as headings', () => {
    const d1 = doc([p('1', [t('ch1 text')])]);
    const d2 = doc([p('2', [t('ch2 text')])]);
    const html = renderBookToHtml([
      { title: 'Chapter One', doc: d1 },
      { title: 'Chapter Two', doc: d2 },
    ], 'trace');
    expect(html).toContain('<h2');
    expect(html).toContain('Chapter One');
    expect(html).toContain('Chapter Two');
    expect(html).toContain('ch1 text');
    expect(html).toContain('ch2 text');
  });

  it('escapes HTML in chapter titles', () => {
    const d = doc([p('1', [t('x')])]);
    const html = renderBookToHtml([{ title: '<script>', doc: d }], 'trace');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('exportBookPlainText', () => {
  it('joins chapters with separator', () => {
    const d1 = doc([p('1', [t('Chapter 1')])]);
    const d2 = doc([p('2', [t('Chapter 2')])]);
    const text = exportBookPlainText([
      { title: 'One', doc: d1 },
      { title: 'Two', doc: d2 },
    ]);
    expect(text).toContain('Chapter 1');
    expect(text).toContain('Chapter 2');
    expect(text).toContain('---');
  });
});

describe('exportBookWordBlob', () => {
  it('returns a Blob with all chapters', async () => {
    const d1 = doc([p('1', [t('first')])]);
    const d2 = doc([p('2', [t('second')])]);
    const blob = exportBookWordBlob([
      { title: 'One', doc: d1 },
      { title: 'Two', doc: d2 },
    ], 'trace');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('application/msword');
    const text = await blob.text();
    expect(text).toContain('first');
    expect(text).toContain('second');
    expect(text).toContain('One');
    expect(text).toContain('Two');
  });
});
