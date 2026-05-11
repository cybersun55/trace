// PRD Section 3.1 核心数据接口

export type AllowedStyles = { bold?: boolean; italic?: boolean };
export type TraceStatus = 'normal' | 'deleted';

export interface TextSpan {
  type: 'text';
  insert: string;
  status: TraceStatus;
  attributes?: AllowedStyles;
}

export interface SoftBreakSpan {
  type: 'soft-break';
  status: 'deleted';
}

export type InlineNode = TextSpan | SoftBreakSpan;

export interface Paragraph {
  id: string;
  children: InlineNode[];
}

export interface Document {
  chapterId: string;
  paragraphs: Paragraph[];
}
