// Central settings persistence — localStorage for simple values, OPFS for font files

export type Theme = 'warm' | 'light' | 'dark' | 'eye';
export type Lang = 'zh' | 'en';

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  key: string;
}

export interface UserSettings {
  theme: Theme;
  lang: Lang;
  pageWidth: string;
  editorFont: string;
  hideHints: boolean;
  shortcuts: ShortcutDef[];
}

const STORAGE_KEY = 'trace_settings';

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'softDelete', label: '删除留痕', keys: 'Backspace', ctrlKey: false, shiftKey: false, key: 'Backspace' },
  { id: 'hardDelete', label: '真删除', keys: 'Cmd+Backspace', ctrlKey: true, shiftKey: false, key: 'Backspace' },
  { id: 'splitParagraph', label: '换段', keys: 'Enter', ctrlKey: false, shiftKey: false, key: 'Enter' },
  { id: 'toggleBold', label: '粗体', keys: 'Ctrl+B', ctrlKey: true, shiftKey: false, key: 'b' },
  { id: 'toggleItalic', label: '斜体', keys: 'Ctrl+I', ctrlKey: true, shiftKey: false, key: 'i' },
  { id: 'toggleHideDeleted', label: '清屏/恢复', keys: 'Tab', ctrlKey: false, shiftKey: false, key: 'Tab' },
];

const DEFAULTS: UserSettings = {
  theme: 'warm',
  lang: 'zh',
  pageWidth: '760px',
  editorFont: '',
  hideHints: false,
  shortcuts: DEFAULT_SHORTCUTS,
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, shortcuts: [...DEFAULTS.shortcuts] };
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme || DEFAULTS.theme,
      lang: parsed.lang || DEFAULTS.lang,
      pageWidth: parsed.pageWidth || DEFAULTS.pageWidth,
      editorFont: parsed.editorFont || DEFAULTS.editorFont,
      hideHints: parsed.hideHints ?? DEFAULTS.hideHints,
      shortcuts: Array.isArray(parsed.shortcuts) && parsed.shortcuts.length > 0
        ? parsed.shortcuts
        : [...DEFAULTS.shortcuts],
    };
  } catch {
    return { ...DEFAULTS, shortcuts: [...DEFAULTS.shortcuts] };
  }
}

export function saveSettings(s: UserSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function applyTheme(theme: Theme) {
  localStorage.setItem('trace_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

export function getTheme(): Theme {
  return (localStorage.getItem('trace_theme') as Theme) || 'warm';
}

export function applyPageWidth(w: string) {
  document.documentElement.style.setProperty('--page-width', w);
}

export function applyEditorFont(f: string) {
  document.documentElement.style.setProperty('--editor-font', f || DEFAULT_FONT_FAMILY);
}

const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Serif SC", serif';

// ---- Font file management (OPFS) ----

export interface FontEntry {
  name: string;
  family: string;
  file: string; // filename in OPFS
}

const FONTS_KEY = 'trace_fonts';

export function loadFontList(): FontEntry[] {
  try {
    const raw = localStorage.getItem(FONTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFontList(list: FontEntry[]) {
  localStorage.setItem(FONTS_KEY, JSON.stringify(list));
}

export async function importFontFile(file: File): Promise<FontEntry | null> {
  try {
    const root = await navigator.storage.getDirectory();
    let fontsDir: FileSystemDirectoryHandle;
    try {
      fontsDir = await root.getDirectoryHandle('fonts', { create: true });
    } catch { return null; }

    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fh = await fontsDir.getFileHandle(safeName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();

    const family = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fff ]/g, '');
    const entry: FontEntry = { name: file.name, family, file: safeName };
    const list = loadFontList();
    // Replace if same family exists
    const idx = list.findIndex((f) => f.family === family);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    saveFontList(list);
    await injectFontFace(entry);
    return entry;
  } catch { return null; }
}

export async function removeFont(family: string) {
  const list = loadFontList();
  const entry = list.find((f) => f.family === family);
  if (!entry) return;
  try {
    const root = await navigator.storage.getDirectory();
    const fontsDir = await root.getDirectoryHandle('fonts');
    await fontsDir.removeEntry(entry.file);
  } catch {}
  saveFontList(list.filter((f) => f.family !== family));
}

export async function initFonts() {
  const list = loadFontList();
  for (const entry of list) {
    try {
      await injectFontFace(entry);
    } catch {}
  }
}

async function injectFontFace(entry: FontEntry) {
  const root = await navigator.storage.getDirectory();
  const fontsDir = await root.getDirectoryHandle('fonts');
  const fh = await fontsDir.getFileHandle(entry.file);
  const file = await fh.getFile();
  const url = URL.createObjectURL(file);

  const styleId = `font-${entry.family.replace(/\s+/g, '-')}`;
  const existing = document.getElementById(styleId);
  if (existing) {
    URL.revokeObjectURL((existing as HTMLStyleElement).dataset.url || '');
    existing.remove();
  }

  const style = document.createElement('style');
  style.id = styleId;
  (style as any).dataset.url = url;
  style.textContent = `@font-face { font-family: '${entry.family}'; src: url('${url}'); }`;
  document.head.appendChild(style);
}

// ---- Preset fonts (system fonts, always available) ----

export const PRESET_FONTS = [
  { label: '系统默认', value: '' },
  { label: '宋体', value: '"SimSun", "宋体", serif' },
  { label: '黑体', value: '"SimHei", "黑体", sans-serif' },
  { label: '楷体', value: '"KaiTi", "楷体", serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "微软雅黑", sans-serif' },
  { label: 'PingFang SC', value: '"PingFang SC", sans-serif' },
  { label: 'Noto Serif SC', value: '"Noto Serif SC", serif' },
  { label: 'Noto Sans SC', value: '"Noto Sans SC", sans-serif' },
];

export const PAGE_WIDTHS = [
  { label: '窄', value: '600px' },
  { label: '中', value: '760px' },
  { label: '宽', value: '900px' },
];
