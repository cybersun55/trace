import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Editor from './Editor';
import { useEditorStore } from './store';
import { exportTracebook, importTracebook, exportTextFile, saveBlobWithPicker, getRecentFiles, addRecentFile, type RecentEntry } from './storage';
import { exportPlainText, exportWordBlob, exportImageBlob } from './export';
import CopyModal from './CopyModal';
import './App.css';

// ---- stats helper ----

function computeStats(doc: import('./types').Document) {
  let normalChars = 0;
  let deletedChars = 0;
  const paragraphs = doc.paragraphs.length;

  for (const p of doc.paragraphs) {
    for (const c of p.children) {
      if (c.type === 'text') {
        const len = [...c.insert].length;
        if (c.status === 'deleted') deletedChars += len;
        else normalChars += len;
      }
    }
  }

  return { normalChars, deletedChars, paragraphs };
}

// ---- App ----

export default function App() {
  const doc = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(true);

  // Stats
  const stats = useMemo(() => computeStats(doc), [doc]);

  // ---- new document ----

  const handleNew = useCallback(() => {
    if (stats.normalChars > 0 && !confirm('新建将丢弃当前未保存到文件的内容，确定继续？')) return;
    loadDocument({ chapterId: 'ch1', paragraphs: [{ id: 'p1', children: [] }] });
  }, [loadDocument, stats.normalChars]);

  // ---- open ----

  const handleOpen = useCallback(async () => {
    if ('showOpenFilePicker' in window) {
      const imported = await importTracebook();
      if (imported) {
        loadDocument(imported);
        addRecentFile('（从文件打开）');
      }
      return;
    }
    fileRef.current?.click();
  }, [loadDocument]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imported = await importTracebook(file);
    if (imported) {
      loadDocument(imported);
      addRecentFile(file.name);
    }
    e.target.value = '';
  }, [loadDocument]);

  // ---- export ----

  const [exportOpen, setExportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const handleCopy = useCallback(() => {
    setCopyOpen(true);
    setExportOpen(false);
  }, []);

  const handleExportTxt = useCallback(async () => {
    await exportTextFile(exportPlainText(doc), '写作（纯净）.txt');
    setExportOpen(false);
  }, [doc]);

  const handleExportTracebook = useCallback(async () => {
    await exportTracebook(doc);
    setExportOpen(false);
  }, [doc]);

  // Version picker for Word / Image
  const [versionPick, setVersionPick] = useState<'word' | 'image' | null>(null);

  const doExportWord = useCallback(async (clean: boolean) => {
    const mode = clean ? 'clean' : 'trace';
    const suffix = clean ? '（纯净）' : '（原版）';
    const blob = exportWordBlob(doc, mode);
    await saveBlobWithPicker({ blob, suggestedName: `写作${suffix}.doc`, mimeType: 'application/msword', extension: '.doc' });
    setExportOpen(false);
  }, [doc]);

  const doExportImage = useCallback(async (clean: boolean) => {
    const mode = clean ? 'clean' : 'trace';
    const suffix = clean ? '（纯净）' : '（原版）';
    const blob = await exportImageBlob(doc, mode);
    await saveBlobWithPicker({ blob, suggestedName: `写作${suffix}.png`, mimeType: 'image/png', extension: '.png' });
    setExportOpen(false);
  }, [doc]);

  const handleVersionPick = useCallback((clean: boolean) => {
    const kind = versionPick;
    setVersionPick(null);
    if (kind === 'word') doExportWord(clean);
    else if (kind === 'image') doExportImage(clean);
  }, [versionPick, doExportWord, doExportImage]);

  // ---- recent files ----

  const [recentFiles] = useState<RecentEntry[]>(getRecentFiles);
  const [recentOpen, setRecentOpen] = useState(false);

  return (
    <div className="app">
      {/* Title */}
      <div className="app-title">推敲 Trace</div>

      {/* Toolbar */}
      <div className="app-toolbar">
        <div className="app-toolbar-group">
          <button className="app-btn" onClick={handleNew} title="新建文档">
            新建
          </button>
          <button className="app-btn" onClick={handleOpen} title="打开 .tracebook 文件">
            打开
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".tracebook"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        <div className="app-toolbar-sep" />

        <div className="app-toolbar-group">
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
                  <div className="dropdown-sep" />
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleExportTxt(); }}>
                    纯文本 (.txt)
                  </button>
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleExportTracebook(); }}>
                    源文件 (.tracebook)
                  </button>
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); setExportOpen(false); setVersionPick('word'); }}>
                    Word 文档 (.doc)
                  </button>
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); setExportOpen(false); setVersionPick('image'); }}>
                    图片 (.png)
                  </button>
                </div>
              </DropdownOverlay>
            )}
          </div>

          {recentFiles.length > 0 && (
            <div className="app-dropdown">
              <button className="app-btn" onMouseDown={(e) => { e.preventDefault(); setRecentOpen(!recentOpen); }}>
                最近 ▾
              </button>
              {recentOpen && (
                <DropdownOverlay onClose={() => setRecentOpen(false)}>
                  <div className="dropdown-menu">
                    {recentFiles.map((f, i) => (
                      <div key={i} className="dropdown-item recent-item">
                        <span className="recent-name">{f.name}</span>
                        <span className="recent-time">{fmtTime(f.time)}</span>
                      </div>
                    ))}
                  </div>
                </DropdownOverlay>
              )}
            </div>
          )}
        </div>

        <div className="app-toolbar-spacer" />

        {/* Clear-screen toggle */}
        <div className="app-toolbar-group">
          <button
            className="app-btn app-btn-ghost"
            onClick={() => useEditorStore.getState().toggleHideDeleted()}
            title="切换留痕显示（Tab）"
          >
            留痕
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="app-divider" />

      {/* Editor */}
      <Editor />

      {/* Copy modal */}
      {copyOpen && <CopyModal doc={doc} onClose={() => setCopyOpen(false)} />}

      {/* Version picker dialog */}
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

      {/* Status bar */}
      <div className="app-statusbar">
        <span>{stats.normalChars.toLocaleString()} 字</span>
        <span className="app-statusbar-dot">·</span>
        <span>{stats.paragraphs} 段</span>
        {stats.deletedChars > 0 && (
          <>
            <span className="app-statusbar-dot">·</span>
            <span>{stats.deletedChars} 处留痕</span>
          </>
        )}
        <span className="app-statusbar-dot">·</span>
        <span className={`app-statusbar-save ${saved ? 'saved' : ''}`}>
          {saved ? '已保存 ✓' : '未保存'}
        </span>
      </div>
    </div>
  );
}

// ---- helpers ----

/** Click-outside overlay for dropdown menus */
function DropdownOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return <div ref={overlayRef}>{children}</div>;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
}
