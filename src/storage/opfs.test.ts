import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock File System API
function createMockFileSystem() {
  const store = new Map<string, any>();

  const makeDirHandle = (path: string): FileSystemDirectoryHandle => {
    const getPath = (name: string) => `${path}/${name}`;
    return {
      kind: 'directory' as const,
      name: path.split('/').pop() || '',
      getDirectoryHandle: async (name: string, opts?: { create?: boolean }) => {
        const full = getPath(name);
        if (store.has(full + '/.dir')) return makeDirHandle(full);
        if (opts?.create) {
          store.set(full + '/.dir', true);
          return makeDirHandle(full);
        }
        throw new DOMException('Not found', 'NotFoundError');
      },
      getFileHandle: async (name: string, opts?: { create?: boolean }) => {
        const full = getPath(name);
        if (store.has(full) || opts?.create) {
          return makeFileHandle(full);
        }
        throw new DOMException('Not found', 'NotFoundError');
      },
      removeEntry: async (name: string, _opts?: { recursive?: boolean }) => {
        const full = getPath(name);
        for (const [key] of store) {
          if (key.startsWith(full)) store.delete(key);
        }
      },
      entries: () => {
        const prefix = path + '/';
        const seen = new Set<string>();
        const items: [string, any][] = [];
        for (const [key] of store) {
          const rel = key.slice(prefix.length);
          const top = rel.split('/')[0];
          if (!seen.has(top) && top && top !== '.dir') {
            seen.add(top);
            items.push([top, store.has(prefix + top + '/.dir') ? makeDirHandle(prefix + top) : makeFileHandle(prefix + top)]);
          }
        }
        return (async function* () { for (const item of items) yield item; })();
      },
    } as any;
  };

  const makeFileHandle = (path: string): FileSystemFileHandle => ({
    kind: 'file' as const,
    name: path.split('/').pop() || '',
    getFile: async () => {
      const content = store.get(path) || '';
      return new File([content], path.split('/').pop() || '', { type: 'application/octet-stream' });
    },
    createWritable: async () => {
      let written = '';
      return {
        write: async (data: string) => { written = data; },
        close: async () => { store.set(path, written); },
      };
    },
  } as any);

  const root = makeDirHandle('');

  return { root, store };
}

function installMock(mockRoot: FileSystemDirectoryHandle) {
  // Use Object.defineProperty because navigator is a getter-only property
  const mockNav = {
    storage: {
      getDirectory: async () => mockRoot,
    },
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNav,
    writable: true,
    configurable: true,
  });
}

// Also need File global for the mock
beforeEach(() => {
  if (typeof File === 'undefined') {
    (globalThis as any).File = class MockFile {
      text: string;
      name: string;
      type: string;
      constructor(parts: string[], name: string, opts?: { type?: string }) {
        this.text = parts.join('');
        this.name = name;
        this.type = opts?.type || '';
      }
    };
  }
});

describe('isOPFSAvailable', () => {
  it('returns true when OPFS is accessible', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);

    // Fresh import with mock in place
    vi.resetModules();
    const { isOPFSAvailable } = await import('./opfs');
    const result = await isOPFSAvailable();
    expect(result).toBe(true);
  });

  it('returns false when storage is missing', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    vi.resetModules();
    const { isOPFSAvailable } = await import('./opfs');
    const result = await isOPFSAvailable();
    expect(result).toBe(false);
  });
});

describe('writeJSON / readJSON', () => {
  it('writes and reads JSON round-trip', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);
    vi.resetModules();
    const { writeJSON, readJSON, getProjectsDir } = await import('./opfs');

    const dir = await getProjectsDir();
    const data = { hello: 'world', num: 42 };
    await writeJSON(dir, 'test.json', data);
    const result = await readJSON<typeof data>(dir, 'test.json');
    expect(result).toEqual(data);
  });

  it('returns null for missing file', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);
    vi.resetModules();
    const { readJSON, getProjectsDir } = await import('./opfs');

    const dir = await getProjectsDir();
    const result = await readJSON(dir, 'nonexistent.json');
    expect(result).toBeNull();
  });

  it('writes arrays', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);
    vi.resetModules();
    const { writeJSON, readJSON, getProjectsDir } = await import('./opfs');

    const dir = await getProjectsDir();
    await writeJSON(dir, 'arr.json', [1, 2, 3]);
    expect(await readJSON(dir, 'arr.json')).toEqual([1, 2, 3]);
  });
});

describe('listProjectIds', () => {
  it('returns empty array for empty projects dir', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);
    vi.resetModules();
    const { listProjectIds } = await import('./opfs');

    const ids = await listProjectIds();
    expect(ids).toEqual([]);
  });
});

describe('getProjectDir / getChaptersDir', () => {
  it('creates project and chapters directories', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);
    vi.resetModules();
    const { getProjectDir, getChaptersDir, writeJSON, readJSON } = await import('./opfs');

    const projDir = await getProjectDir('test-uuid');
    const chDir = await getChaptersDir('test-uuid');

    // Write a file in each
    await writeJSON(projDir, 'meta.json', { id: 'test-uuid' });
    await writeJSON(chDir, 'ch_001.json', { chapter: 1 });

    const meta = await readJSON(projDir, 'meta.json');
    const chapter = await readJSON(chDir, 'ch_001.json');
    expect(meta).toEqual({ id: 'test-uuid' });
    expect(chapter).toEqual({ chapter: 1 });
  });
});

describe('remove', () => {
  it('removes a directory entry', async () => {
    const mockFS = createMockFileSystem();
    installMock(mockFS.root);
    vi.resetModules();
    const { getProjectDir, writeJSON, readJSON, remove } = await import('./opfs');

    const dir = await getProjectDir('rm-test');
    await writeJSON(dir, 'meta.json', { x: 1 });
    expect(await readJSON(dir, 'meta.json')).toEqual({ x: 1 });

    await remove(dir, 'meta.json');
    expect(await readJSON(dir, 'meta.json')).toBeNull();
  });
});
