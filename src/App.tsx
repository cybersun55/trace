import { useEffect, useRef, useState, useCallback } from 'react';
import Editor from './Editor';
import { useStore } from './store';
import { autoSave, exportTracebook, importTracebook, getRecentFiles, addRecentFile, downloadText, type RecentEntry } from './storage';
import { exportPlainText, exportMarkdown } from './export';
import './App.css';

export default function App() {
  const doc = useStore((s) => s.document);
  const loadDocument = useStore((s) => s.loadDocument);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage on every document change
  useEffect(() => {
    autoSave(doc);
  }, [doc]);

  // ---- save / open ----

  const handleSave = useCallback(async () => {
    await exportTracebook(doc);
  }, [doc]);

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

  const handleExportTxt = useCallback(() => {
    downloadText('写作（纯净）.txt', exportPlainText(doc));
    setExportOpen(false);
  }, [doc]);

  const handleExportMd = useCallback(() => {
    downloadText('写作（留痕）.md', exportMarkdown(doc));
    setExportOpen(false);
  }, [doc]);

  // ---- recent files ----

  const [recentFiles] = useState<RecentEntry[]>(getRecentFiles);
  const [recentOpen, setRecentOpen] = useState(false);

  return (
    <div className="app">
      <div className="app-header">
        <h1 style={{ fontSize: 20, fontWeight: 400, color: '#4a4238', marginBottom: 0 }}>
          推敲 Trace
        </h1>
        <div className="app-actions">
          {/* Save */}
          <button className="app-btn" onClick={handleSave} title="保存 .tracebook (⌘S)">保存</button>

          {/* Open */}
          <button className="app-btn" onClick={handleOpen}>打开</button>
          <input
            ref={fileRef}
            type="file"
            accept=".tracebook"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Export dropdown */}
          <div className="app-dropdown">
            <button
              className="app-btn"
              onMouseDown={(e) => { e.preventDefault(); setExportOpen(!exportOpen); }}
            >
              导出 ▾
            </button>
            {exportOpen && (
              <DropdownOverlay onClose={() => setExportOpen(false)}>
                <div className="dropdown-menu">
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleExportTxt(); }}>纯文本 (.txt)</button>
                  <button className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); handleExportMd(); }}>Markdown (.md)</button>
                </div>
              </DropdownOverlay>
            )}
          </div>

          {/* Recent files */}
          {recentFiles.length > 0 && (
            <div className="app-dropdown">
              <button
                className="app-btn"
                onMouseDown={(e) => { e.preventDefault(); setRecentOpen(!recentOpen); }}
              >
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
      </div>
      <div className="hint">
        Backspace <b>删除留痕</b> | Shift+Backspace <b>真删除</b> | Enter 换段 | Cmd+B/I 格式 | Tab 清屏 | Cmd+S 保存
      </div>
      <Editor />
    </div>
  );
}

/** Click-outside overlay for dropdown menus */
function DropdownOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer so the mousedown that opened the menu doesn't immediately close it
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
