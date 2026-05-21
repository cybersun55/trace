// OPFS (Origin Private File System) primitives
// Directory layout:
//   trace_projects/projects/{uuid}/meta.json + content.json (article)
//   trace_projects/projects/{uuid}/meta.json + toc.json + chapters/*.json (book)

const ROOT_NAME = 'trace_projects';
let rootHandle: FileSystemDirectoryHandle | null = null;

export async function getRoot(): Promise<FileSystemDirectoryHandle> {
  if (rootHandle) return rootHandle;
  const root = await navigator.storage.getDirectory();
  rootHandle = root;
  return rootHandle;
}

export async function getProjectsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot();
  return ensureDir(root, 'projects');
}

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

export async function writeJSON(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  data: unknown,
): Promise<void> {
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function readJSON<T>(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<T | null> {
  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function remove(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    await dir.removeEntry(name, { recursive: true });
  } catch {
    // already gone
  }
}

export async function listProjectIds(): Promise<string[]> {
  try {
    const dir = await getProjectsDir();
    const ids: string[] = [];
    for await (const [name] of (dir as any).entries()) {
      ids.push(name);
    }
    return ids;
  } catch {
    return [];
  }
}

export async function getProjectDir(projectId: string): Promise<FileSystemDirectoryHandle> {
  const parent = await getProjectsDir();
  return ensureDir(parent, projectId);
}

export async function getChaptersDir(projectId: string): Promise<FileSystemDirectoryHandle> {
  const projDir = await getProjectDir(projectId);
  return ensureDir(projDir, 'chapters');
}
