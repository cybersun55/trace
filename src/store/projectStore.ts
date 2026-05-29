import { create } from 'zustand';
import type {
  ProjectMeta, ProjectType, AppView, ChapterEntry,
  Document, TableOfContents,
} from '../types';
import * as projects from '../storage/projects';
import * as settings from '../storage/settings';
import { crashSave, crashClear } from '../storage/crashSave';
import { useEditorStore } from './editorStore';

interface ProjectState {
  view: AppView;
  projects: ProjectMeta[];
  activeProject: ProjectMeta | null;
  chapters: ChapterEntry[];
  activeChapterId: string | null;
  isLoading: boolean;
  error: string | null;

  setView: (v: AppView) => void;
  loadProjectList: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  createProject: (title: string, type: ProjectType) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, title: string) => Promise<void>;
  switchChapter: (chapterId: string) => Promise<void>;
  addChapter: (title: string) => Promise<void>;
  saveCurrentChapter: () => Promise<void>;
  closeProject: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  view: 'dashboard',
  projects: [],
  activeProject: null,
  chapters: [],
  activeChapterId: null,
  isLoading: false,
  error: null,

  setView: (v) => set({ view: v }),

  loadProjectList: async () => {
    set({ isLoading: true, error: null });
    try {
      const list = await projects.listProjects();
      set({ projects: list, isLoading: false });
    } catch (e) {
      set({ error: '无法加载项目列表', isLoading: false });
    }
  },

  openProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const meta = await projects.loadProjectMeta(id);
      if (!meta) throw new Error('Project not found');

      let chapters: ChapterEntry[] = [];
      let activeChapterId: string | null;
      let doc: Document | null = null;

      if (meta.type === 'book') {
        const toc = await projects.loadTOC(id);
        if (!toc || toc.chapters.length === 0) {
          // Repair: create a default chapter for empty books
          const entry = await projects.createChapter(id, '第1章');
          chapters = [entry];
          activeChapterId = entry.id;
        } else {
          chapters = toc.chapters;
          activeChapterId = toc.chapters[0].id;
        }
        doc = await projects.loadChapter(id, activeChapterId, 'book');
      } else {
        activeChapterId = 'main';
        doc = await projects.loadChapter(id, activeChapterId, 'article');
      }

      if (!doc) throw new Error('Document not found');

      useEditorStore.getState().initDocument(doc);
      crashClear();

      settings.addRecentProject({ id, title: meta.title, type: meta.type, lastOpened: new Date().toISOString() });

      set({ activeProject: meta, chapters, activeChapterId, view: 'editor', isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: '无法打开项目: ' + msg, isLoading: false });
    }
  },

  createProject: async (title, type) => {
    try {
      const meta = await projects.createProject(title, type);
      const list = await projects.listProjects();
      set({ projects: list });
      return meta.id;
    } catch (e: any) {
      const msg = e?.message || String(e);
      set({ error: '无法创建项目: ' + msg });
      return '';
    }
  },

  deleteProject: async (id) => {
    await projects.deleteProject(id);
    const list = await projects.listProjects();
    set({ projects: list });
  },

  renameProject: async (id, title) => {
    const meta = await projects.loadProjectMeta(id);
    if (!meta) return;
    meta.title = title;
    await projects.saveProjectMeta(id, meta);
    const list = await projects.listProjects();
    set({ projects: list });
    const st = get();
    if (st.activeProject?.id === id) {
      set({ activeProject: meta });
    }
  },

  switchChapter: async (chapterId) => {
    const st = get();
    if (!st.activeProject) return;
    await get().saveCurrentChapter();

    const doc = await projects.loadChapter(st.activeProject.id, chapterId, st.activeProject.type);
    if (!doc) return;

    useEditorStore.getState().initDocument(doc);
    crashClear();
    set({ activeChapterId: chapterId });
  },

  addChapter: async (title) => {
    const st = get();
    if (!st.activeProject || st.activeProject.type !== 'book') return;

    const entry = await projects.createChapter(st.activeProject.id, title);
    const toc = await projects.loadTOC(st.activeProject.id);
    if (toc) set({ chapters: toc.chapters });
  },

  saveCurrentChapter: async () => {
    const st = get();
    if (!st.activeProject || !st.activeChapterId) return;

    const doc = useEditorStore.getState().getDocument();
    await projects.saveChapter(st.activeProject.id, st.activeChapterId, doc);

    // Refresh meta to sync updated wordCount (total for books)
    const meta = await projects.loadProjectMeta(st.activeProject.id);
    if (meta) set({ activeProject: meta });
  },

  closeProject: async () => {
    await get().saveCurrentChapter();
    crashClear();
    useEditorStore.getState().initDocument({
      chapterId: 'ch1',
      paragraphs: [{ id: 'p1', children: [] }],
    });
    set({
      view: 'dashboard',
      activeProject: null,
      chapters: [],
      activeChapterId: null,
      error: null,
    });
  },
}));

// Debounced auto-save: crash-save on every change, OPFS save after 1.5s idle
let saveTimer: ReturnType<typeof setTimeout> | null = null;

useEditorStore.subscribe((state, prevState) => {
  if (state.document === prevState.document) return;

  const ps = useProjectStore.getState();
  if (!ps.activeProject || !ps.activeChapterId) return;

  crashSave(state.document, ps.activeProject.id, ps.activeChapterId);

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    ps.saveCurrentChapter();
  }, 1500);
});
