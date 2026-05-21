import type { Document } from '../types';

const CRASH_KEY = 'trace_crash';

interface CrashData {
  doc: Document;
  projectId: string;
  chapterId: string;
  time: number;
}

export function crashSave(doc: Document, projectId: string, chapterId: string): void {
  try {
    localStorage.setItem(CRASH_KEY, JSON.stringify({
      doc, projectId, chapterId, time: Date.now(),
    }));
  } catch {}
}

export function crashLoad(): CrashData | null {
  try {
    const raw = localStorage.getItem(CRASH_KEY);
    if (!raw) return null;
    const data: CrashData = JSON.parse(raw);
    if (Date.now() - data.time > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CRASH_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function crashClear(): void {
  localStorage.removeItem(CRASH_KEY);
}
