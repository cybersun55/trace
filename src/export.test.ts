import { describe, it, expect } from 'vitest';
import { exportPlainText, exportMarkdown } from './export';
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
