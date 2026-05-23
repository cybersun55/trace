import { useEffect } from 'react';
import { useProjectStore } from './store';
import { crashLoad, crashClear } from './storage';
import { createProject, saveChapter } from './storage/projects';
import { loadSettings, applyTheme, applyPageWidth, applyEditorFont, initFonts } from './settings';
import Dashboard from './Dashboard';
import EditorLayout from './EditorLayout';
import './App.css';

const LEGACY_KEY = 'trace_document';

export default function App() {
  const view = useProjectStore((s) => s.view);
  const openProject = useProjectStore((s) => s.openProject);
  const loadProjectList = useProjectStore((s) => s.loadProjectList);

  // On mount: apply settings, run migration, check crash recovery, load project list
  useEffect(() => {
    // 0. Apply saved settings
    const s = loadSettings();
    applyTheme(s.theme);
    applyPageWidth(s.pageWidth);
    applyEditorFont(s.editorFont);

    (async () => {
      // Init custom fonts from OPFS
      await initFonts();

      // 1. Migrate legacy localStorage data to OPFS
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          const doc = JSON.parse(raw);
          if (doc?.chapterId && Array.isArray(doc?.paragraphs)) {
            const meta = await createProject('已迁移的作品', 'article');
            await saveChapter(meta.id, 'main', doc);
            localStorage.removeItem(LEGACY_KEY);
            localStorage.removeItem('trace_recent');
          }
        }
      } catch {}

      // 2. Load project list
      await loadProjectList();

      // 3. Check crash recovery
      const crash = crashLoad();
      if (crash) {
        try {
          await openProject(crash.projectId);
        } catch {
          crashClear();
        }
      }
    })();
  }, []);

  if (view === 'dashboard') return <Dashboard />;
  if (view === 'editor') return <EditorLayout />;
  return null;
}
