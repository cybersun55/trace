// Auto-detecting storage backend: OPFS (browser) or Tauri FS (desktop app)
//
// Directory layout (same for both backends):
//   {root}/projects/{uuid}/meta.json + content.json (article)
//   {root}/projects/{uuid}/meta.json + toc.json + chapters/*.json (book)
//
// Browser:  OPFS via navigator.storage.getDirectory()
// Tauri:    Local filesystem via @tauri-apps/plugin-fs
//
// Public function signatures are unchanged — callers (projects.ts, Dashboard.tsx)
// work transparently with either backend.

const ROOT_NAME = 'trace_projects';
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// ---- OPFS (browser) state ----
let rootHandle: FileSystemDirectoryHandle | null = null;
let _checked = false;
let _available = false;
let _lastError = '';

// ---- Tauri state ----
let _tauriRoot: string | null = null;
let _tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;
let _tauriPath: typeof import('@tauri-apps/api/path') | null = null;

async function getTauriModules() {
  if (!_tauriFs) {
    _tauriFs = await import('@tauri-apps/plugin-fs');
    _tauriPath = await import('@tauri-apps/api/path');
  }
  return { fs: _tauriFs, path: _tauriPath! };
}

/** Check if storage is available. Safe to call multiple times — only probes once. */
export async function isOPFSAvailable(): Promise<boolean> {
  if (isTauri) return true;

  if (_checked) return _available;
  _checked = true;
  try {
    if (!('storage' in navigator)) {
      _lastError = 'navigator.storage not available';
      return false;
    }
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('_test_', { create: true });
    const w = await handle.createWritable();
    await w.write('ok');
    await w.close();
    await root.removeEntry('_test_');
    _available = true;
    _lastError = '';
    return true;
  } catch (e: any) {
    _available = false;
    _lastError = e?.message || String(e);
    return false;
  }
}

/** Get the last OPFS error message (for UI display). */
export function getOPFSError(): string {
  return isTauri ? '' : _lastError;
}

/** Reset storage check so isOPFSAvailable() probes again. */
export function resetOPFSCheck(): void {
  _checked = false;
  _available = false;
  _lastError = '';
  rootHandle = null;
  _tauriRoot = null;
  _tauriFs = null;
  _tauriPath = null;
}

// ==== Directory handles (opaque — callers don't inspect them) ====

export async function getRoot(): Promise<string | FileSystemDirectoryHandle> {
  if (isTauri) {
    if (_tauriRoot) return _tauriRoot;
    const { path } = await getTauriModules();
    const dataDir = await path.appDataDir();
    _tauriRoot = dataDir + ROOT_NAME;
    return _tauriRoot;
  }

  if (rootHandle) return rootHandle;
  const root = await navigator.storage.getDirectory();
  rootHandle = root;
  return rootHandle;
}

async function ensureTauriDir(fullPath: string): Promise<void> {
  const { fs } = await getTauriModules();
  if (!(await fs.exists(fullPath))) {
    await fs.mkdir(fullPath, { recursive: true });
  }
}

export async function getProjectsDir(): Promise<string | FileSystemDirectoryHandle> {
  if (isTauri) {
    const root = await getRoot() as string;
    const dir = root + '/projects';
    await ensureTauriDir(dir);
    return dir;
  }
  const root = await getRoot() as FileSystemDirectoryHandle;
  return ensureDir(root, 'projects');
}

export async function getProjectDir(projectId: string): Promise<string | FileSystemDirectoryHandle> {
  if (isTauri) {
    const parent = await getProjectsDir() as string;
    const dir = parent + '/' + projectId;
    await ensureTauriDir(dir);
    return dir;
  }
  const parent = await getProjectsDir() as FileSystemDirectoryHandle;
  return ensureDir(parent, projectId);
}

export async function getChaptersDir(projectId: string): Promise<string | FileSystemDirectoryHandle> {
  if (isTauri) {
    const projDir = await getProjectDir(projectId) as string;
    const dir = projDir + '/chapters';
    await ensureTauriDir(dir);
    return dir;
  }
  const projDir = await getProjectDir(projectId) as FileSystemDirectoryHandle;
  return ensureDir(projDir, 'chapters');
}

// ---- OPFS helper (browser-only) ----
async function ensureDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return await parent.getDirectoryHandle(name, { create: true });
  }
}

// ==== JSON read/write ====

export async function writeJSON(
  dir: string | FileSystemDirectoryHandle,
  fileName: string,
  data: unknown,
): Promise<void> {
  if (isTauri) {
    const { fs } = await getTauriModules();
    const filePath = (dir as string) + '/' + fileName;
    await fs.writeTextFile(filePath, JSON.stringify(data, null, 2));
    return;
  }
  const handle = dir as FileSystemDirectoryHandle;
  const fh = await handle.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function readJSON<T>(
  dir: string | FileSystemDirectoryHandle,
  fileName: string,
): Promise<T | null> {
  if (isTauri) {
    const { fs } = await getTauriModules();
    const filePath = (dir as string) + '/' + fileName;
    try {
      const content = await fs.readTextFile(filePath);
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }
  const handle = dir as FileSystemDirectoryHandle;
  try {
    const fh = await handle.getFileHandle(fileName);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function remove(
  dir: string | FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  if (isTauri) {
    const { fs } = await getTauriModules();
    const targetPath = (dir as string) + '/' + name;
    try {
      await fs.remove(targetPath, { recursive: true });
    } catch {
      // already gone
    }
    return;
  }
  const handle = dir as FileSystemDirectoryHandle;
  try {
    await handle.removeEntry(name, { recursive: true });
  } catch {
    // already gone
  }
}

export async function listProjectIds(): Promise<string[]> {
  if (isTauri) {
    const { fs } = await getTauriModules();
    const parent = await getProjectsDir() as string;
    try {
      const entries = await fs.readDir(parent);
      return entries.filter((e: any) => e.isDirectory).map((e: any) => e.name);
    } catch {
      return [];
    }
  }
  try {
    const dir = await getProjectsDir() as FileSystemDirectoryHandle;
    const ids: string[] = [];
    for await (const [name] of (dir as any).entries()) {
      ids.push(name);
    }
    return ids;
  } catch {
    return [];
  }
}
