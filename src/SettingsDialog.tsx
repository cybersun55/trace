import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type Theme, type Lang, type ShortcutDef, type FontEntry,
  loadSettings, saveSettings, applyTheme, applyPageWidth, applyEditorFont,
  getTheme, DEFAULT_SHORTCUTS, PRESET_FONTS, PAGE_WIDTHS,
  loadFontList, importFontFile, removeFont,
} from './settings';
import { useT, notifyLangChange, t as translate } from './i18n';

interface Props { onClose: () => void; }

type Tab = 'general' | 'editor' | 'shortcuts' | 'data' | 'about';

function getTabs(lang: Lang): { id: Tab; label: string }[] {
  return [
    { id: 'general', label: translate('settings.general', lang) },
    { id: 'editor', label: translate('settings.editor', lang) },
    { id: 'shortcuts', label: translate('settings.shortcuts', lang) },
    { id: 'data', label: translate('settings.data', lang) },
    { id: 'about', label: translate('settings.about', lang) },
  ];
}

export default function SettingsDialog({ onClose }: Props) {
  const [settings, setSettings] = useState(() => loadSettings());
  const [tab, setTab] = useState<Tab>('general');
  const [clearInput, setClearInput] = useState('');
  const [clearDone, setClearDone] = useState(false);
  const [fonts, setFonts] = useState<FontEntry[]>(loadFontList);
  const [recording, setRecording] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tt = useT();
  const lang = settings.lang;

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
    notifyLangChange();
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
  const clearWord = lang === 'zh' ? '删除' : 'delete';
  const handleClearAll = useCallback(async () => {
    if (clearInput !== clearWord) return;
    try {
      const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('projects', { recursive: true }); } catch {}
      try { await root.removeEntry('fonts', { recursive: true }); } catch {}
    } catch {}
    localStorage.clear();
    setClearDone(true);
    setTimeout(() => window.location.reload(), 800);
  }, [clearInput, clearWord]);

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
          {getTabs(lang).map((t) => (
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
              <h3 className="st-section-title">{tt('settings.general')}</h3>
              <div className="st-row">
                <span className="st-label">{tt('settings.lang')}</span>
                <div className="st-toggle-group">
                  <button className={`st-toggle${lang === 'zh' ? ' active' : ''}`} onClick={() => handleLang('zh')}>中文</button>
                  <button className={`st-toggle${lang === 'en' ? ' active' : ''}`} onClick={() => handleLang('en')}>English</button>
                </div>
              </div>
              <div className="st-row">
                <span className="st-label">{tt('settings.theme')}</span>
                <div className="st-theme-grid">
                  {(['warm', 'light', 'dark', 'eye'] as Theme[]).map((t) => (
                    <button
                      key={t}
                      className={`st-theme-card${settings.theme === t ? ' active' : ''}`}
                      onClick={() => handleTheme(t)}
                    >
                      <div className={`st-theme-swatch st-theme-${t}`} />
                      <span>{tt(`settings.theme.${t}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <div className="st-section">
              <h3 className="st-section-title">{tt('settings.editor')}</h3>

              <div className="st-setting-block">
                <div className="st-label">{tt('settings.font')}</div>
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
                          title="×"
                        >✕</span>
                      )}
                    </button>
                  ))}
                </div>
                <button className="st-font-opt st-font-import" onClick={handleFontImport}>
                  {tt('settings.fontImport')}
                </button>
                <input ref={fileRef} type="file" accept=".ttf,.otf,.woff2,.woff" style={{ display: 'none' }} onChange={handleFontFile} />
              </div>

              <div className="st-setting-block">
                <div className="st-label">{tt('settings.pageWidth')}</div>
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
                    placeholder={lang === 'zh' ? '自定义 px' : 'Custom px'}
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

          {tab === 'shortcuts' && (
            <div className="st-section">
              <h3 className="st-section-title">{tt('settings.shortcuts')}</h3>

              <div className="st-row" style={{ marginBottom: 12 }}>
                <label className="st-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.hideHints}
                    onChange={handleHideHints}
                  />
                  <span>{tt('settings.hideHints')}</span>
                </label>
                <button className="app-btn" onClick={handleShortcutReset}>{tt('settings.resetShortcuts')}</button>
              </div>

              <table className="st-shortcut-table">
                <thead>
                  <tr><th>{lang === 'zh' ? '功能' : 'Action'}</th><th>{lang === 'zh' ? '按键' : 'Key'}</th><th></th></tr>
                </thead>
                <tbody>
                  {settings.shortcuts.map((sc) => (
                    <tr key={sc.id}>
                      <td>{tt(`sc.${sc.id}`)}</td>
                      <td>
                        {recording === sc.id ? (
                          <span className="st-recording">{tt('settings.recording')}</span>
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
                          {recording === sc.id ? tt('settings.recordingBtn') : tt('settings.edit')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'data' && (
            <div className="st-section">
              <h3 className="st-section-title">{tt('settings.data')}</h3>
              <div className="st-row">
                <span className="st-label">{tt('settings.clearData')}</span>
                <span className="st-hint">{tt('settings.clearHint')}</span>
              </div>
              {!clearDone ? (
                <div className="st-clear-row">
                  <input
                    className="st-clear-input"
                    placeholder={tt('settings.clearPlaceholder')}
                    value={clearInput}
                    onChange={(e) => setClearInput(e.target.value)}
                  />
                  <button
                    className="app-btn"
                    style={{ color: clearInput === clearWord ? '#e74c3c' : undefined }}
                    onClick={handleClearAll}
                  >
                    {tt('settings.clearBtn')}
                  </button>
                </div>
              ) : (
                <div className="st-clear-done">{tt('settings.clearDone')}</div>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="st-section">
              <h3 className="st-section-title">{translate('app.title', lang)}</h3>
              <div className="st-about">
                <p>{tt('settings.aboutText1')}</p>
                <p>{tt('settings.aboutText2')}</p>
                <div className="st-meta">
                  <div><span>{tt('settings.version')}</span><span>1.0.0</span></div>
                  <div><span>{tt('settings.license')}</span><span>MIT</span></div>
                  <div><span>{tt('settings.tech')}</span><span>React + Zustand + OPFS</span></div>
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
