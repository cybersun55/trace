import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type Theme, type Lang, type ShortcutDef, type FontEntry,
  loadSettings, saveSettings, applyTheme, applyPageWidth, applyEditorFont,
  getTheme, DEFAULT_SHORTCUTS, PRESET_FONTS, PAGE_WIDTHS,
  loadFontList, importFontFile, removeFont, initFonts,
} from './settings';

interface Props { onClose: () => void; }

const THEME_LABELS: Record<Theme, string> = { warm: '暖黄', light: '浅色', dark: '深色', eye: '护眼' };

type Tab = 'general' | 'editor' | 'shortcuts' | 'data' | 'about';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'editor', label: '编辑器' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'data', label: '数据' },
  { id: 'about', label: '关于' },
];

export default function SettingsDialog({ onClose }: Props) {
  const [settings, setSettings] = useState(() => loadSettings());
  const [tab, setTab] = useState<Tab>('general');
  const [clearInput, setClearInput] = useState('');
  const [clearDone, setClearDone] = useState(false);
  const [fonts, setFonts] = useState<FontEntry[]>(loadFontList);
  const [recording, setRecording] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Apply theme immediately
  const handleTheme = useCallback((t: Theme) => {
    applyTheme(t);
    setSettings((s) => ({ ...s, theme: t }));
  }, []);

  const handleLang = useCallback((l: Lang) => {
    setSettings((s) => {
      const next = { ...s, lang: l };
      saveSettings(next);
      return next;
    });
  }, []);

  // Page width
  const handlePageWidth = useCallback((w: string) => {
    applyPageWidth(w);
    setSettings((s) => {
      const next = { ...s, pageWidth: w };
      saveSettings(next);
      return next;
    });
  }, []);

  // Editor font
  const handleEditorFont = useCallback((f: string) => {
    applyEditorFont(f);
    setSettings((s) => {
      const next = { ...s, editorFont: f };
      saveSettings(next);
      return next;
    });
  }, []);

  // Font import
  const handleFontImport = useCallback(async () => {
    fileRef.current?.click();
  }, []);

  const handleFontFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['ttf', 'otf', 'woff2', 'woff'].includes(ext)) {
      alert('仅支持 .ttf / .otf / .woff2 / .woff 字体文件');
      return;
    }
    const entry = await importFontFile(file);
    if (entry) setFonts(loadFontList());
    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleFontRemove = useCallback(async (family: string) => {
    await removeFont(family);
    setFonts(loadFontList());
  }, []);

  // Shortcuts
  const handleShortcutEdit = useCallback((id: string) => {
    setRecording(id);
  }, []);

  const handleShortcutReset = useCallback(() => {
    setSettings((s) => {
      const next = { ...s, shortcuts: [...DEFAULT_SHORTCUTS] };
      saveSettings(next);
      return next;
    });
  }, []);

  // Hide hints toggle
  const handleHideHints = useCallback(() => {
    setSettings((s) => {
      const next = { ...s, hideHints: !s.hideHints };
      saveSettings(next);
      return next;
    });
  }, []);

  // Clear all data
  const handleClearAll = useCallback(async () => {
    if (clearInput !== '删除') return;
    try {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('projects', { recursive: true }); } catch {}
      try { await root.removeEntry('fonts', { recursive: true }); } catch {}
    } catch {}
    localStorage.clear();
    setClearDone(true);
    setTimeout(() => window.location.reload(), 800);
  }, [clearInput]);

  // Listen for key recording
  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;
      if (['Control', 'Shift', 'Meta', 'Alt'].includes(key)) return;

      let keys = '';
      if (ctrl) keys += 'Ctrl+';
      if (shift) keys += 'Shift+';
      if (key === 'Backspace') keys += 'Backspace';
      else if (key === 'Enter') keys += 'Enter';
      else if (key === 'Tab') keys += 'Tab';
      else if (key === ' ') keys += 'Space';
      else if (key.length === 1) keys += key.toUpperCase();
      else keys += key;

      setSettings((s) => {
        const next = {
          ...s,
          shortcuts: s.shortcuts.map((sc) =>
            sc.id === recording
              ? { ...sc, keys, ctrlKey: ctrl, shiftKey: shift, key: e.key }
              : sc
          ),
        };
        saveSettings(next);
        return next;
      });
      setRecording(null);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [recording]);

  const allFonts = [
    ...PRESET_FONTS.map((p) => ({ ...p, isPreset: true })),
    ...fonts.map((f) => ({ label: f.family, value: `"${f.family}"`, isPreset: false })),
  ];

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
          {/* ---- 通用 ---- */}
          {tab === 'general' && (
            <div className="st-section">
              <h3 className="st-section-title">通用</h3>
              <div className="st-row">
                <span className="st-label">语言</span>
                <div className="st-toggle-group">
                  <button className={`st-toggle${settings.lang === 'zh' ? ' active' : ''}`} onClick={() => handleLang('zh')}>中文</button>
                  <button className={`st-toggle${settings.lang === 'en' ? ' active' : ''}`} onClick={() => handleLang('en')}>English</button>
                </div>
              </div>
              <div className="st-row">
                <span className="st-label">主题</span>
                <div className="st-theme-grid">
                  {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                    <button
                      key={t}
                      className={`st-theme-card${settings.theme === t ? ' active' : ''}`}
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

          {/* ---- 编辑器 ---- */}
          {tab === 'editor' && (
            <div className="st-section">
              <h3 className="st-section-title">编辑器</h3>

              <div className="st-setting-block">
                <div className="st-label">字体</div>
                <div className="st-font-list">
                  {allFonts.map((f) => (
                    <button
                      key={f.label}
                      className={`st-font-opt${settings.editorFont === f.value ? ' active' : ''}`}
                      onClick={() => handleEditorFont(f.value)}
                      title={f.value || '系统默认'}
                    >
                      <span style={f.value ? { fontFamily: f.value } : undefined}>
                        {f.label}
                      </span>
                      {!f.isPreset && (
                        <span
                          className="st-font-del"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleFontRemove(f.label); }}
                          title="删除此字体"
                        >✕</span>
                      )}
                    </button>
                  ))}
                </div>
                <button className="app-btn" onClick={handleFontImport} style={{ marginTop: 8 }}>
                  导入字体 (.ttf/.otf/.woff2)
                </button>
                <input ref={fileRef} type="file" accept=".ttf,.otf,.woff2,.woff" style={{ display: 'none' }} onChange={handleFontFile} />
              </div>

              <div className="st-setting-block">
                <div className="st-label">页面宽度</div>
                <div className="st-toggle-group" style={{ marginBottom: 8 }}>
                  {PAGE_WIDTHS.map((pw) => (
                    <button
                      key={pw.value}
                      className={`st-toggle${settings.pageWidth === pw.value ? ' active' : ''}`}
                      onClick={() => handlePageWidth(pw.value)}
                    >
                      {pw.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="st-custom-input"
                    type="text"
                    placeholder="自定义 px"
                    value={PAGE_WIDTHS.some(p => p.value === settings.pageWidth) ? '' : settings.pageWidth.replace('px', '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^\d*$/.test(v) && v.length <= 5) {
                        if (v) handlePageWidth(`${v}px`);
                      }
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>px</span>
                </div>
              </div>
            </div>
          )}

          {/* ---- 快捷键 ---- */}
          {tab === 'shortcuts' && (
            <div className="st-section">
              <h3 className="st-section-title">快捷键</h3>

              <div className="st-row" style={{ marginBottom: 12 }}>
                <label className="st-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.hideHints}
                    onChange={handleHideHints}
                  />
                  <span>隐藏编辑器操作提示</span>
                </label>
                <button className="app-btn" onClick={handleShortcutReset}>恢复默认</button>
              </div>

              <table className="st-shortcut-table">
                <thead>
                  <tr><th>功能</th><th>按键</th><th></th></tr>
                </thead>
                <tbody>
                  {settings.shortcuts.map((sc) => (
                    <tr key={sc.id}>
                      <td>{sc.label}</td>
                      <td>
                        {recording === sc.id ? (
                          <span className="st-recording">按下新按键...</span>
                        ) : (
                          <kbd>{sc.keys}</kbd>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="app-btn"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleShortcutEdit(sc.id)}
                        >
                          {recording === sc.id ? '录制中...' : '编辑'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- 数据 ---- */}
          {tab === 'data' && (
            <div className="st-section">
              <h3 className="st-section-title">数据管理</h3>
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

          {/* ---- 关于 ---- */}
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
