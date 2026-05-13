import JSZip from 'jszip';
import type { Document } from './types';

const LS_KEY = 'trace_document';

// ---- localStorage auto-save ----

export function autoSave(doc: Document): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(doc));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function autoLoad(): Document | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Document;
  } catch {
    return null;
  }
}

// ---- generic save dialog ----

interface SavePickerOptions {
  blob: Blob;
  suggestedName: string;
  mimeType: string;
  extension: string;
}

/**
 * Saves a blob to disk. Uses native save dialog (Chromium) when available,
 * falls back to prompt + download otherwise.
 * Returns true if saved, false if cancelled.
 */
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
      // Fall through to download fallback on other errors
    }
  }

  // Fallback: prompt + download
  const filename = prompt('保存文件名：', opts.suggestedName);
  if (!filename) return false;
  const finalName = filename.endsWith(opts.extension) ? filename : filename + opts.extension;
  downloadBlob(opts.blob, finalName);
  return true;
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

async function buildZip(doc: Document): Promise<Blob> {
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

  const toc: { chapters: TocEntry[] } = {
    chapters: [{ id: doc.chapterId, title: 'Chapter 1', file: 'chapters/ch_001.json' }],
  };

  zip.file('metadata.json', JSON.stringify(meta, null, 2));
  zip.file('toc.json', JSON.stringify(toc, null, 2));
  zip.file('chapters/ch_001.json', JSON.stringify(doc, null, 2));

  return zip.generateAsync({ type: 'blob' });
}

export async function exportTracebook(doc: Document): Promise<boolean> {
  const blob = await buildZip(doc);
  return saveBlobWithPicker({
    blob,
    suggestedName: '写作.tracebook',
    mimeType: 'application/zip',
    extension: '.tracebook',
  });
}

export async function importTracebook(file?: File): Promise<Document | null> {
  // Prefer native open dialog
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
      return null; // user cancelled
    }
  }

  if (!file) return null;

  try {
    const zip = await JSZip.loadAsync(file);
    const docFile = zip.file('chapters/ch_001.json');
    if (!docFile) return null;

    const text = await docFile.async('text');
    const doc = JSON.parse(text) as Document;

    if (!doc.chapterId || !Array.isArray(doc.paragraphs)) return null;

    return doc;
  } catch {
    return null;
  }
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

// ---- recent files ----

const RECENT_KEY = 'trace_recent';

export interface RecentEntry {
  name: string;
  time: string; // ISO
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

// ---- helpers ----

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
