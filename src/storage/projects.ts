import type { ProjectMeta, Document, TableOfContents, ChapterEntry, ProjectType } from '../types';
import { getProjectDir, getChaptersDir, getProjectsDir, writeJSON, readJSON, remove, listProjectIds } from './opfs';

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

// ---- Project CRUD ----

export async function listProjects(): Promise<ProjectMeta[]> {
  const ids = await listProjectIds();
  const metas: ProjectMeta[] = [];
  for (const id of ids) {
    const dir = await getProjectDir(id);
    const meta = await readJSON<ProjectMeta>(dir, 'meta.json');
    if (meta) metas.push(meta);
  }
  metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return metas;
}

export async function createProject(
  title: string,
  type: ProjectType,
): Promise<ProjectMeta> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const meta: ProjectMeta = {
    id, title, type, createdAt: now, updatedAt: now, wordCount: 0,
  };

  const dir = await getProjectDir(id);
  await writeJSON(dir, 'meta.json', meta);

  if (type === 'article') {
    const doc: Document = { chapterId: 'main', paragraphs: [{ id: 'p1', children: [] }] };
    await writeJSON(dir, 'content.json', doc);
  } else {
    const toc: TableOfContents = {
      chapters: [{ id: 'ch_001', title: '第1章' }],
    };
    await writeJSON(dir, 'toc.json', toc);

    const chaptersDir = await getChaptersDir(id);
    const doc: Document = { chapterId: 'ch_001', paragraphs: [{ id: 'p1', children: [] }] };
    await writeJSON(chaptersDir, 'ch_001.json', doc);
  }

  return meta;
}

export async function loadProjectMeta(projectId: string): Promise<ProjectMeta | null> {
  const dir = await getProjectDir(projectId);
  return readJSON<ProjectMeta>(dir, 'meta.json');
}

export async function saveProjectMeta(projectId: string, meta: ProjectMeta): Promise<void> {
  const dir = await getProjectDir(projectId);
  await writeJSON(dir, 'meta.json', meta);
}

export async function deleteProject(projectId: string): Promise<void> {
  const parent = await getProjectsDir();
  await remove(parent, projectId);
}

// ---- Chapter operations ----

export async function saveChapter(
  projectId: string,
  chapterId: string,
  doc: Document,
): Promise<void> {
  const meta = await loadProjectMeta(projectId);
  if (!meta) return;

  if (meta.type === 'article') {
    const dir = await getProjectDir(projectId);
    await writeJSON(dir, 'content.json', doc);
  } else {
    const dir = await getChaptersDir(projectId);
    await writeJSON(dir, `${chapterId}.json`, doc);
  }

  meta.updatedAt = new Date().toISOString();
  meta.wordCount = countWords(doc);
  await saveProjectMeta(projectId, meta);
}

export async function loadChapter(
  projectId: string,
  chapterId: string,
  type: ProjectType,
): Promise<Document | null> {
  if (type === 'article') {
    const dir = await getProjectDir(projectId);
    return readJSON<Document>(dir, 'content.json');
  }
  const dir = await getChaptersDir(projectId);
  return readJSON<Document>(dir, `${chapterId}.json`);
}

export async function loadTOC(projectId: string): Promise<TableOfContents | null> {
  const dir = await getProjectDir(projectId);
  return readJSON<TableOfContents>(dir, 'toc.json');
}

export async function saveTOC(projectId: string, toc: TableOfContents): Promise<void> {
  const dir = await getProjectDir(projectId);
  await writeJSON(dir, 'toc.json', toc);
}

export async function createChapter(
  projectId: string,
  title: string,
): Promise<ChapterEntry> {
  const toc = await loadTOC(projectId);
  if (!toc) throw new Error('Not a book project');

  const idx = toc.chapters.length + 1;
  const cid = `ch_${String(idx).padStart(3, '0')}`;
  const entry: ChapterEntry = { id: cid, title };
  toc.chapters.push(entry);
  await saveTOC(projectId, toc);

  const doc: Document = { chapterId: cid, paragraphs: [{ id: 'p1', children: [] }] };
  const dir = await getChaptersDir(projectId);
  await writeJSON(dir, `${cid}.json`, doc);

  return entry;
}

export async function updateChapterTitle(
  projectId: string,
  chapterId: string,
  title: string,
): Promise<void> {
  const toc = await loadTOC(projectId);
  if (!toc) return;
  const entry = toc.chapters.find(c => c.id === chapterId);
  if (entry) entry.title = title;
  await saveTOC(projectId, toc);
}

export async function deleteChapter(
  projectId: string,
  chapterId: string,
): Promise<void> {
  const toc = await loadTOC(projectId);
  if (!toc) return;
  if (toc.chapters.length <= 1) return; // keep at least one chapter
  toc.chapters = toc.chapters.filter(c => c.id !== chapterId);
  await saveTOC(projectId, toc);

  const dir = await getChaptersDir(projectId);
  await remove(dir, `${chapterId}.json`);
}
