import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorStore, useProjectStore } from './store';
import { exportTracebook, exportTextFile, saveBlobWithPicker } from './storage';
import { exportPlainText, exportWordBlob, exportImageBlob } from './export';
import { loadChapter } from './storage/projects';
import CopyModal from './CopyModal';
import SettingsDialog from './SettingsDialog';

export default function EditorHeader() {
  const doc = useEditorStore((s) => s.document);
  const activeProject = useProjectStore((s) => s.activeProject);
  const chapters = useProjectStore((s) => s.chapters);
  const activeChapterId = useProjectStore((s) => s.activeChapterId);
  const closeProject = useProjectStore((s) => s.closeProject);
  const renameProject = useProjectStore((s) => s.renameProject);

  const [exportOpen, setExportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionPick, setVersionPick] = useState<'word' | 'image' | null>(null);
  const [editing, setEditing] = useState(false);
  const [etitle, setEtitle] = useState('');
  const titRef = useRef<HTMLInputElement>(null);

  // Title editing
  const startEdit = useCallback(() => {
    if (!activeProject) return;
    setEtitle(activeProject.title);
    setEditing(true);
    requestAnimationFrame(() => titRef.current?.select());
  }, [activeProject]);

  const commitEdit = useCallback(() => {
    const t = etitle.trim();
    if (t && activeProject && t !== activeProject.title) {
      renameProject(activeProject.id, t);
    }
    setEditing(false);
  }, [etitle, activeProject, renameProject]);

  interface ChapterData {
    id: string;
    title: string;
    doc: import('./types').Document;
  }

  // Gather all chapter docs for book-level export
  const collectBookChapters = useCallback(async (): Promise<ChapterData[] | null> => {
    const project = activeProject;
    if (!project || project.type !== 'book') return null;
    const chs = chapters;
    const chId = activeChapterId;
    const currentDoc = useEditorStore.getState().document;
    const result: ChapterData[] = [];
    for (const ch of chs) {
      if (ch.id === chId) {
        result.push({ id: ch.id, title: ch.title, doc: currentDoc });
      } else {
        const d = await loadChapter(project.id, ch.id, 'book');
        if (d) result.push({ id: ch.id, title: ch.title, doc: d });
      }
    }
    return result;
  }, [activeProject, chapters, activeChapterId]);

  const handleCopy = useCallback(() => {
    setCopyOpen(true);
    setExportOpen(false);
  }, []);

  const handleExportTxt = useCallback(async () => {
    const title = activeProject?.title || '写作';
    await exportTextFile(exportPlainText(doc), `${title}（纯净）.txt`);
    setExportOpen(false);
  }, [doc, activeProject]);

  const handleExportTracebook = useCallback(async () => {
    const title = activeProject?.title || '写作';
    await exportTracebook(doc, `${title}.tracebook`);
    setExportOpen(false);
  }, [doc, activeProject]);

  // Book: export each chapter as a separate .doc file inside a folder
  const exportBookToFolder = useCallback(async (clean: boolean) => {
    const mode = clean ? 'clean' : 'trace';
    const title = activeProject?.title || '写作';
    const suffix = clean ? '（纯净）' : '（原版）';

    // Try directory picker; fall back to single merged file
    let dirHandle: FileSystemDirectoryHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch {
      // User cancelled or API unavailable — fall back to merged .doc
      const chs = await collectBookChapters();
      if (chs) {
        // Merged fallback
        const parts: string[] = [];
        for (const ch of chs) {
          parts.push(ch.title);
          parts.push(exportPlainText(ch.doc));
        }
        await saveBlobWithPicker({
          blob: new Blob([parts.join('\n\n')], { type: 'application/msword;charset=utf-8' }),
          suggestedName: `${title}${suffix}.doc`,
          mimeType: 'application/msword',
          extension: '.doc',
        });
      }
      setExportOpen(false);
      return;
    }

    // Create book folder
    const safeName = title.replace(/[/\\?%*:|"<>]/g, '_');
    const bookDir = await dirHandle.getDirectoryHandle(safeName, { create: true });

    const chs = await collectBookChapters();
    if (!chs) { setExportOpen(false); return; }

    for (let i = 0; i < chs.length; i++) {
      const ch = chs[i];
      const num = String(i + 1).padStart(2, '0');
      const chName = `${num}_${ch.title.replace(/[/\\?%*:|"<>]/g, '_')}`;
      const blob = exportWordBlob(ch.doc, mode);
      const fileHandle = await bookDir.getFileHandle(`${chName}.doc`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    }

    setExportOpen(false);
  }, [activeProject, collectBookChapters]);

  const doExportWord = useCallback(async (clean: boolean) => {
    const mode = clean ? 'clean' : 'trace';
    const title = activeProject?.title || '写作';
    const suffix = clean ? '（纯净）' : '（原版）';
    const blob = exportWordBlob(doc, mode);
    await saveBlobWithPicker({ blob, suggestedName: `${title}${suffix}.doc`, mimeType: 'application/msword', extension: '.doc' });
    setExportOpen(false);
  }, [doc, activeProject]);

  const doExportImage = useCallback(async (clean: boolean) => {
    const mode = clean ? 'clean' : 'trace';
    const title = activeProject?.title || '写作';
    const suffix = clean ? '（纯净）' : '（原版）';
    const blob = await exportImageBlob(doc, mode);
    await saveBlobWithPicker({ blob, suggestedName: `${title}${suffix}.png`, mimeType: 'image/png', extension: '.png' });
    setExportOpen(false);
  }, [doc, activeProject]);

  const handleVersionPick = useCallback((clean: boolean) => {
    const kind = versionPick;
    setVersionPick(null);
    if (kind === 'word') {
      if (activeProject?.type === 'book') exportBookToFolder(clean);
      else doExportWord(clean);
    } else if (kind === 'image') {
      doExportImage(clean);
    }
  }, [versionPick, activeProject, exportBookToFolder, doExportWord, doExportImage]);

  const isBook = activeProject?.type === 'book';
  const currentChapter = chapters.find(c => c.id === activeChapterId);

  return (
    <>
      <div className="eh-header">
        <button className="eh-back" onClick={closeProject} title="返回作品列表">
          ←
        </button>

        <div className="eh-center">
          {editing ? (
            <input
              ref={titRef}
              className="eh-title-input"
              value={etitle}
              onChange={(e) => setEtitle(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <div className="eh-title" onClick={startEdit} title="点击修改标题">
              {activeProject?.title || '推敲 Trace'}
            </div>
          )}
          {isBook && currentChapter && (
            <div className="eh-chapter-indicator">
              第 {chapters.findIndex(c => c.id === activeChapterId) + 1}/{chapters.length} 章 · {currentChapter.title}
            </div>
          )}
        </div>

        <div className="eh-actions">
          <button className="gear-btn" onClick={() => setSettingsOpen(true)} title="设置">⚙</button>
          <div className="app-dropdown">
            <button className="app-btn" onMouseDown={(e) => { e.preventDefault(); setExportOpen(!exportOpen); }}>
              导出 ▾
            </button>
            {exportOpen && (
              <DropdownOverlay onClose={() => setExportOpen(false)}>
                <div className="dropdown-menu">
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleCopy(); }}>
                    复制
                  </button>
                  {!isBook && (
                    <>
                      <div className="dropdown-sep" />
                      <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleExportTxt(); }}>
                        纯文本 (.txt)
                      </button>
                      <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleExportTracebook(); }}>
                        源文件 (.tracebook)
                      </button>
                    </>
                  )}
                  <div className="dropdown-sep" />
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); setExportOpen(false); setVersionPick('word'); }}>
                    Word 文档 (.doc)
                  </button>
                  {!isBook && (
                    <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); setExportOpen(false); setVersionPick('image'); }}>
                      图片 (.png)
                    </button>
                  )}
                </div>
              </DropdownOverlay>
            )}
          </div>
        </div>
      </div>

      <div className="app-divider" />

      {copyOpen && <CopyModal doc={doc} onClose={() => setCopyOpen(false)} />}

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      {versionPick && (
        <div className="vp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setVersionPick(null); }}>
          <div className="vp-dialog">
            <div className="vp-title">选择导出版本</div>
            <div className="vp-buttons">
              <button className="vp-btn vp-btn-trace" onMouseDown={(e) => { e.preventDefault(); handleVersionPick(false); }}>
                原版
              </button>
              <button className="vp-btn vp-btn-clean" onMouseDown={(e) => { e.preventDefault(); handleVersionPick(true); }}>
                纯净版
              </button>
            </div>
            <button className="vp-cancel" onMouseDown={(e) => { e.preventDefault(); setVersionPick(null); }}>
              取消
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DropdownOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);
  return <div ref={overlayRef}>{children}</div>;
}
