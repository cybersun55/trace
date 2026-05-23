import { useState, useCallback } from 'react';

type Theme = 'warm' | 'light' | 'dark' | 'eye';
type Lang = 'zh' | 'en';
type Tab = 'general' | 'editor' | 'shortcuts' | 'data' | 'about';

interface Props {
  onClose: () => void;
}

const THEME_LABELS: Record<Theme, string> = { warm: '暖黄', light: '浅色', dark: '深色', eye: '护眼' };

function getTheme(): Theme {
  return (localStorage.getItem('trace_theme') as Theme) || 'warm';
}

function setTheme(t: Theme) {
  localStorage.setItem('trace_theme', t);
  document.documentElement.setAttribute('data-theme', t);
}

function getLang(): Lang {
  return (localStorage.getItem('trace_lang') as Lang) || 'zh';
}

function setLang(l: Lang) {
  localStorage.setItem('trace_lang', l);
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'editor', label: '编辑器' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'data', label: '数据' },
  { id: 'about', label: '关于' },
];

const SHORTCUTS = [
  ['Backspace', '删除留痕'],
  ['Shift + Backspace', '真删除'],
  ['Enter', '换段'],
  ['Ctrl + B', '粗体'],
  ['Ctrl + I', '斜体'],
  ['Tab', '清屏 / 恢复'],
  ['Ctrl + C', '复制'],
  ['Ctrl + V', '粘贴'],
];

export default function SettingsDialog({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [lang, setLangState] = useState<Lang>(getLang);
  const [clearInput, setClearInput] = useState('');
  const [clearDone, setClearDone] = useState(false);

  const handleTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setTheme(t);
  }, []);

  const handleLang = useCallback((l: Lang) => {
    setLangState(l);
    setLang(l);
  }, []);

  const handleClearAll = useCallback(async () => {
    if (clearInput !== '删除') return;
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry('projects', { recursive: true });
    } catch {}
    localStorage.clear();
    setClearDone(true);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  }, [clearInput]);

  const handleExportAll = useCallback(async () => {
    // Export all projects as a JSON backup
    const result: Record<string, unknown> = {};
    try {
      const root = await navigator.storage.getDirectory();
      let projectsDir: FileSystemDirectoryHandle;
      try {
        projectsDir = await root.getDirectoryHandle('projects');
      } catch {
        alert('没有可导出的数据');
        return;
      }
      for await (const [name, handle] of (projectsDir as any).entries()) {
        if (handle.kind === 'directory') {
          const proj: Record<string, unknown> = {};
          for await (const [fname, fhandle] of (handle as any).entries()) {
            if (fhandle.kind === 'file') {
              const file = await (fhandle as FileSystemFileHandle).getFile();
              proj[fname] = JSON.parse(await file.text());
            }
          }
          result[name] = proj;
        }
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trace_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('导出失败');
    }
  }, []);

  return (
    <div className="st-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="st-dialog">
        <div className="st-sidebar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`st-tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="st-content">
          {tab === 'general' && (
            <div className="st-section">
              <h3 className="st-section-title">通用</h3>

              <div className="st-row">
                <span className="st-label">语言</span>
                <div className="st-toggle-group">
                  <button className={`st-toggle${lang === 'zh' ? ' active' : ''}`} onClick={() => handleLang('zh')}>中文</button>
                  <button className={`st-toggle${lang === 'en' ? ' active' : ''}`} onClick={() => handleLang('en')}>English</button>
                </div>
              </div>

              <div className="st-row">
                <span className="st-label">主题</span>
                <div className="st-theme-grid">
                  {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                    <button
                      key={t}
                      className={`st-theme-card${theme === t ? ' active' : ''}`}
                      onClick={() => handleTheme(t)}
                    >
                      <div className={`st-theme-swatch st-theme-${t}`} />
                      <span>{THEME_LABELS[t]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <div className="st-section">
              <h3 className="st-section-title">编辑器</h3>
              <div className="st-row">
                <span className="st-label">字体</span>
                <span className="st-hint">在编辑器中选中文字后，通过浮动工具栏调整字号、颜色和行距</span>
              </div>
              <div className="st-row">
                <span className="st-label">页面宽度</span>
                <span className="st-hint">自适应，最大宽度 760px</span>
              </div>
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="st-section">
              <h3 className="st-section-title">快捷键</h3>
              <table className="st-shortcut-table">
                <thead>
                  <tr><th>按键</th><th>功能</th></tr>
                </thead>
                <tbody>
                  {SHORTCUTS.map(([key, desc]) => (
                    <tr key={key}>
                      <td><kbd>{key}</kbd></td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'data' && (
            <div className="st-section">
              <h3 className="st-section-title">数据管理</h3>

              <div className="st-row">
                <span className="st-label">导出全部数据</span>
                <button className="app-btn" onClick={handleExportAll}>导出备份 (.json)</button>
              </div>

              <div className="st-divider" />

              <div className="st-row">
                <span className="st-label">清除所有数据</span>
                <span className="st-hint">此操作不可恢复，将删除所有作品和设置</span>
              </div>
              {!clearDone ? (
                <div className="st-clear-row">
                  <input
                    className="st-clear-input"
                    placeholder="输入「删除」确认"
                    value={clearInput}
                    onChange={(e) => setClearInput(e.target.value)}
                  />
                  <button
                    className="app-btn"
                    style={{ color: clearInput === '删除' ? '#e74c3c' : undefined }}
                    onClick={handleClearAll}
                  >
                    确认清除
                  </button>
                </div>
              ) : (
                <div className="st-clear-done">数据已清除，即将刷新页面...</div>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="st-section">
              <h3 className="st-section-title">关于 推敲 Trace</h3>
              <div className="st-about">
                <p>推敲 Trace — 一个支持留痕修订的写作编辑器。</p>
                <p>删除的文字不会立即消失，而是以删除线标记，让你看清每一处修改。</p>
                <div className="st-meta">
                  <div><span>版本</span><span>1.0.0</span></div>
                  <div><span>许可</span><span>MIT</span></div>
                  <div><span>技术</span><span>React + Zustand + OPFS</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button className="st-close" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
