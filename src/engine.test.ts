import { describe, it, expect } from 'vitest';
import { normalizeParagraph, insertTextAt, mergeParagraphs } from './engine';
import type { Paragraph, TextSpan, SoftBreakSpan } from './types';

function p(id: string, children: Paragraph['children']): Paragraph {
  return { id, children };
}

function t(insert: string, status: 'normal' | 'deleted' = 'normal'): TextSpan {
  return { type: 'text', insert, status };
}

function sb(): SoftBreakSpan {
  return { type: 'soft-break', status: 'deleted' };
}

// ---- normalizeParagraph ----

describe('normalizeParagraph', () => {
  it('merges adjacent TextSpans with same status', () => {
    const para = p('1', [t('hello '), t('world')]);
    const result = normalizeParagraph(para);
    expect(result.children).toEqual([t('hello world')]);
  });

  it('does not merge spans with different status', () => {
    const para = p('1', [t('keep '), t('deleted', 'deleted'), t('more')]);
    const result = normalizeParagraph(para);
    expect(result.children).toEqual([
      t('keep '),
      t('deleted', 'deleted'),
      t('more'),
    ]);
  });

  it('does not merge spans separated by soft-break', () => {
    const para = p('1', [t('a'), sb(), t('a')]);
    const result = normalizeParagraph(para);
    expect(result.children).toEqual([t('a'), sb(), t('a')]);
  });

  it('merges multiple same-status spans', () => {
    const para = p('1', [t('a'), t('b'), t('c')]);
    const result = normalizeParagraph(para);
    expect(result.children).toEqual([t('abc')]);
  });

  it('does not merge spans with different attributes', () => {
    const para = p('1', [
      { type: 'text', insert: 'bold', status: 'normal', attributes: { bold: true } },
      { type: 'text', insert: 'plain', status: 'normal' },
    ] as Paragraph['children']);
    const result = normalizeParagraph(para);
    expect(result.children).toHaveLength(2);
  });
});

// ---- insertTextAt ----

describe('insertTextAt', () => {
  it('inserts at the beginning', () => {
    const para = p('1', [t('world')]);
    const result = insertTextAt(para, 0, 'hello ');
    expect(result.children).toEqual([t('hello world')]);
  });

  it('inserts at the end', () => {
    const para = p('1', [t('hello')]);
    const result = insertTextAt(para, 5, ' world');
    expect(result.children).toEqual([t('hello world')]);
  });

  it('inserts in the middle of a span', () => {
    const para = p('1', [t('ab')]);
    const result = insertTextAt(para, 1, 'X');
    expect(result.children).toEqual([t('aXb')]);
  });

  it('废墟建房: inserting into a deleted span produces three-way split', () => {
    const para = p('1', [t('old text', 'deleted')]);
    const result = insertTextAt(para, 4, 'new');
    expect(result.children).toEqual([
      t('old ', 'deleted'),
      t('new', 'normal'),
      t('text', 'deleted'),
    ]);
  });

  it('inserting between two spans', () => {
    const para = p('1', [t('hello'), t('world')]);
    const result = insertTextAt(para, 5, ' ');
    expect(result.children).toEqual([t('hello world')]);
  });

  it('insert at soft-break boundary', () => {
    const para = p('1', [t('line1'), sb(), t('line2')]);
    const result = insertTextAt(para, 5, 'X');
    // offset=5 is right after "line1", at the soft-break position
    // new text goes after the soft-break
    expect(result.children).toEqual([t('line1'), sb(), t('Xline2')]);
  });

  it('empty text returns unchanged paragraph', () => {
    const para = p('1', [t('hello')]);
    const result = insertTextAt(para, 2, '');
    expect(result.children).toEqual([t('hello')]);
  });

  it('inserts into empty paragraph', () => {
    const para = p('1', []);
    const result = insertTextAt(para, 0, 'hello');
    expect(result.children).toEqual([t('hello')]);
  });

  it('inserts at offset beyond paragraph length', () => {
    const para = p('1', [t('ab')]);
    const result = insertTextAt(para, 10, 'X');
    expect(result.children).toEqual([t('abX')]);
  });
});

// ---- mergeParagraphs ----

describe('mergeParagraphs', () => {
  it('inserts soft-break between two paragraphs', () => {
    const p1 = p('1', [t('first')]);
    const p2 = p('2', [t('second')]);
    const result = mergeParagraphs(p1, p2);
    expect(result.children).toEqual([t('first'), sb(), t('second')]);
  });

  it('uses the first paragraph id', () => {
    const p1 = p('abc', [t('a')]);
    const p2 = p('xyz', [t('b')]);
    const result = mergeParagraphs(p1, p2);
    expect(result.id).toBe('abc');
  });

  it('handles empty first paragraph', () => {
    const p1 = p('1', []);
    const p2 = p('2', [t('text')]);
    const result = mergeParagraphs(p1, p2);
    expect(result.children).toEqual([sb(), t('text')]);
  });

  it('handles empty second paragraph', () => {
    const p1 = p('1', [t('text')]);
    const p2 = p('2', []);
    const result = mergeParagraphs(p1, p2);
    expect(result.children).toEqual([t('text'), sb()]);
  });

  it('handles both empty', () => {
    const p1 = p('1', []);
    const p2 = p('2', []);
    const result = mergeParagraphs(p1, p2);
    expect(result.children).toEqual([sb()]);
  });
});
