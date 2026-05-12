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

export async function exportTracebook(doc: Document): Promise<void> {
  const blob = await buildZip(doc);

  // Prefer native save dialog (Chromium) — user picks folder + name
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: '写作.tracebook',
        types: [{
          description: 'Tracebook 文档',
          accept: { 'application/zip': ['.tracebook'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled the dialog
      if (err?.name === 'AbortError') return;
      // Otherwise fall through to download fallback
    }
  }

  // Fallback: prompt for filename, then download
  const filename = prompt('保存文件名：', '写作.tracebook');
  if (!filename) return;
  const finalName = filename.endsWith('.tracebook') ? filename : filename + '.tracebook';
  downloadBlob(blob, finalName);
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
