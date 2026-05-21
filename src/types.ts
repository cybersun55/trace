// PRD Section 3.1 核心数据接口

export type AllowedStyles = { bold?: boolean; italic?: boolean; color?: string; fontSize?: string };
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

// ---- Project-level types ----

export type ProjectType = 'article' | 'book';

export interface ProjectMeta {
  id: string;
  title: string;
  type: ProjectType;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}

export interface ChapterEntry {
  id: string;
  title: string;
}

export interface TableOfContents {
  chapters: ChapterEntry[];
}

export interface AppSettings {
  lastOpenProjectId: string | null;
  recentProjects: RecentProjectEntry[];
}

export interface RecentProjectEntry {
  id: string;
  title: string;
  type: ProjectType;
  lastOpened: string;
}

export type AppView = 'dashboard' | 'editor';
