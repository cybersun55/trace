import JSZip from 'jszip';
import type { Document, ProjectMeta, ChapterEntry } from '../types';
import { loadProjectMeta, loadTOC, loadChapter } from './projects';

// ---- generic save dialog ----

export interface SavePickerOptions {
  blob: Blob;
  suggestedName: string;
  mimeType: string;
  extension: string;
}

export async function saveBlobWithPicker(opts: SavePickerOptions): Promise<boolean> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: opts.suggestedName,
        types: [{
          description: opts.suggestedName,
          accept: { [opts.mimeType]: [opts.extension] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(opts.blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
    }
  }

  downloadBlob(opts.blob, opts.suggestedName);
  return true;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- .tracebook file export/import ----

interface TracebookMeta {
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  wordCount: number;
}

interface TocEntry {
  id: string;
  title: string;
  file: string;
}

function countWords(doc: Document): number {
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

// ---- single-chapter export (existing) ----

export async function exportTracebook(doc: Document, suggestedName?: string): Promise<boolean> {
  const zip = new JSZip();
  const now = new Date().toISOString();

  const meta: TracebookMeta = {
    title: '未命名',
    author: '',
    createdAt: now,
    updatedAt: now,
    version: 1,
    wordCount: countWords(doc),
  };

  const toc = {
    chapters: [{ id: doc.chapterId, title: 'Chapter 1', file: 'chapters/ch_001.json' }],
  };

  zip.file('metadata.json', JSON.stringify(meta, null, 2));
  zip.file('toc.json', JSON.stringify(toc, null, 2));
  zip.file('chapters/ch_001.json', JSON.stringify(doc, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  return saveBlobWithPicker({
    blob,
    suggestedName: suggestedName || '写作.tracebook',
    mimeType: 'application/zip',
    extension: '.tracebook',
  });
}

// ---- book export ----

export async function exportBookTracebook(
  meta: ProjectMeta,
  tocEntries: ChapterEntry[],
  chapters: Map<string, Document>,
): Promise<boolean> {
  const zip = new JSZip();

  const tbMeta: TracebookMeta = {
    title: meta.title,
    author: '',
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    version: 1,
    wordCount: meta.wordCount,
  };

  const tbToc = {
    chapters: tocEntries.map((c, i) => ({
      id: c.id,
      title: c.title,
      file: `chapters/ch_${String(i + 1).padStart(3, '0')}.json`,
    })),
  };

  zip.file('metadata.json', JSON.stringify(tbMeta, null, 2));
  zip.file('toc.json', JSON.stringify(tbToc, null, 2));

  for (let i = 0; i < tocEntries.length; i++) {
    const doc = chapters.get(tocEntries[i].id);
    if (doc) {
      zip.file(`chapters/ch_${String(i + 1).padStart(3, '0')}.json`, JSON.stringify(doc, null, 2));
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return saveBlobWithPicker({
    blob,
    suggestedName: `${meta.title}.tracebook`,
    mimeType: 'application/zip',
    extension: '.tracebook',
  });
}

// ---- import ----

interface ImportResult {
  type: 'article' | 'book';
  title: string;
  chapters: { entry: { id: string; title: string }; doc: Document }[];
}

export async function importTracebookFull(file?: File): Promise<ImportResult | null> {
  if (!file && 'showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'Tracebook 文档',
          accept: { 'application/zip': ['.tracebook'] },
        }],
        multiple: false,
      });
      file = await handle.getFile();
    } catch {
      return null;
    }
  }

  if (!file) return null;

  try {
    const zip = await JSZip.loadAsync(file);

    const tocFile = zip.file('toc.json');
    const toc = tocFile ? JSON.parse(await tocFile.async('text')) : null;

    const chapters: ImportResult['chapters'] = [];
    if (toc?.chapters) {
      for (const entry of toc.chapters) {
        const docFile = zip.file(entry.file);
        if (!docFile) continue;
        const doc = JSON.parse(await docFile.async('text')) as Document;
        if (!doc.chapterId || !Array.isArray(doc.paragraphs)) continue;
        chapters.push({ entry: { id: entry.id, title: entry.title || 'Chapter' }, doc });
      }
    } else {
      // Fallback: try old single-chapter format
      const docFile = zip.file('chapters/ch_001.json');
      if (docFile) {
        const doc = JSON.parse(await docFile.async('text')) as Document;
        if (doc.chapterId && Array.isArray(doc.paragraphs)) {
          chapters.push({ entry: { id: 'ch_001', title: 'Chapter 1' }, doc });
        }
      }
    }

    if (chapters.length === 0) return null;

    const metaFile = zip.file('metadata.json');
    const meta = metaFile ? JSON.parse(await metaFile.async('text')) : null;
    const title = meta?.title || file.name.replace(/\.tracebook$/, '') || '导入的文档';

    return {
      type: chapters.length === 1 ? 'article' : 'book',
      title,
      chapters,
    };
  } catch {
    return null;
  }
}

// Legacy import: returns single Document for backward compat
export async function importTracebook(file?: File): Promise<Document | null> {
  const result = await importTracebookFull(file);
  return result?.chapters[0]?.doc || null;
}

// ---- text file export ----

export function exportTextFile(text: string, suggestedName: string): Promise<boolean> {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const ext = suggestedName.endsWith('.md') ? '.md' : '.txt';
  return saveBlobWithPicker({
    blob,
    suggestedName,
    mimeType: 'text/plain',
    extension: ext,
  });
}

// ---- recent files (kept for backward compat in migration) ----

const RECENT_KEY = 'trace_recent';

export interface RecentEntry {
  name: string;
  time: string;
}

export function getRecentFiles(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(name: string): void {
  const list = getRecentFiles().filter((e) => e.name !== name);
  list.unshift({ name, time: new Date().toISOString() });
  if (list.length > 10) list.length = 10;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

export function clearRecentFiles(): void {
  localStorage.removeItem(RECENT_KEY);
}
