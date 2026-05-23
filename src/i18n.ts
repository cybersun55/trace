import { loadSettings } from './settings';
import { useSyncExternalStore, useCallback } from 'react';

export type Lang = 'zh' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  'app.title': { zh: '推敲 Trace', en: 'Trace' },
  'db.new': { zh: '新建', en: 'New' },
  'db.import': { zh: '导入 .tracebook', en: 'Import .tracebook' },
  'db.empty': { zh: '还没有作品', en: 'No projects yet' },
  'db.delete': { zh: '删除', en: 'Delete' },
  'db.cancel': { zh: '取消', en: 'Cancel' },
  'db.deleteConfirm': { zh: '确定删除此作品？', en: 'Delete this project?' },
  'db.deleteWarning': { zh: '删除后无法恢复', en: 'This cannot be undone' },

  'np.title': { zh: '新建作品', en: 'New Project' },
  'np.placeholder': { zh: '作品标题', en: 'Project title' },
  'np.type': { zh: '类型', en: 'Type' },
  'np.article': { zh: '单篇文章', en: 'Article' },
  'np.articleDesc': { zh: '适合短文、随笔', en: 'Essays, notes' },
  'np.book': { zh: '多章节书', en: 'Book' },
  'np.bookDesc': { zh: '长篇写作，分章节管理', en: 'Long-form with chapters' },
  'np.create': { zh: '创建', en: 'Create' },
  'np.cancel': { zh: '取消', en: 'Cancel' },

  'eh.back': { zh: '←', en: '←' },
  'eh.export': { zh: '导出', en: 'Export' },
  'eh.copy': { zh: '复制', en: 'Copy' },
  'eh.txt': { zh: '纯文本 (.txt)', en: 'Plain Text (.txt)' },
  'eh.tracebook': { zh: '源文件 (.tracebook)', en: 'Source (.tracebook)' },
  'eh.word': { zh: 'Word 文档 (.doc)', en: 'Word (.doc)' },
  'eh.image': { zh: '图片 (.png)', en: 'Image (.png)' },
  'eh.settings': { zh: '设置', en: 'Settings' },

  'export.version': { zh: '选择导出版本', en: 'Choose version' },
  'export.trace': { zh: '原版', en: 'With marks' },
  'export.clean': { zh: '纯净版', en: 'Clean' },
  'export.cancel': { zh: '取消', en: 'Cancel' },

  'hint.softDelete': { zh: '删除留痕', en: 'Soft delete' },
  'hint.hardDelete': { zh: '真删除', en: 'Hard delete' },
  'hint.paragraph': { zh: '换段', en: 'New paragraph' },
  'hint.format': { zh: '格式', en: 'Format' },
  'hint.clear': { zh: '清屏/恢复', en: 'Toggle marks' },

  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.general': { zh: '通用', en: 'General' },
  'settings.editor': { zh: '编辑器', en: 'Editor' },
  'settings.shortcuts': { zh: '快捷键', en: 'Shortcuts' },
  'settings.data': { zh: '数据', en: 'Data' },
  'settings.about': { zh: '关于', en: 'About' },
  'settings.lang': { zh: '语言', en: 'Language' },
  'settings.theme': { zh: '主题', en: 'Theme' },
  'settings.theme.warm': { zh: '暖黄', en: 'Warm' },
  'settings.theme.light': { zh: '浅色', en: 'Light' },
  'settings.theme.dark': { zh: '深色', en: 'Dark' },
  'settings.theme.eye': { zh: '护眼', en: 'Eye' },
  'settings.font': { zh: '字体', en: 'Font' },
  'settings.fontImport': { zh: '+ 导入字体', en: '+ Import font' },
  'settings.pageWidth': { zh: '页面宽度', en: 'Page width' },
  'settings.hideHints': { zh: '隐藏编辑器操作提示', en: 'Hide editor hints' },
  'settings.resetShortcuts': { zh: '恢复默认', en: 'Reset defaults' },
  'settings.recording': { zh: '按下新按键...', en: 'Press new key...' },
  'settings.recordingBtn': { zh: '录制中...', en: 'Recording...' },
  'settings.edit': { zh: '编辑', en: 'Edit' },
  'settings.clearData': { zh: '清除所有数据', en: 'Clear all data' },
  'settings.clearHint': { zh: '此操作不可恢复，将删除所有作品和设置', en: 'This cannot be undone' },
  'settings.clearPlaceholder': { zh: '输入「删除」确认', en: 'Type "delete" to confirm' },
  'settings.clearBtn': { zh: '确认清除', en: 'Confirm' },
  'settings.clearDone': { zh: '数据已清除，即将刷新页面...', en: 'Data cleared, reloading...' },
  'settings.aboutText1': { zh: '推敲 Trace — 一个支持留痕修订的写作编辑器。', en: 'Trace — A writing editor with visual track changes.' },
  'settings.aboutText2': { zh: '删除的文字不会立即消失，而是以删除线标记，让你看清每一处修改。', en: 'Deleted text is shown with strikethrough instead of disappearing.' },
  'settings.version': { zh: '版本', en: 'Version' },
  'settings.license': { zh: '许可', en: 'License' },
  'settings.tech': { zh: '技术', en: 'Tech' },

  'stats.chars': { zh: '字', en: ' chars' },
  'stats.paragraphs': { zh: '段', en: ' ¶' },
  'stats.deleted': { zh: '处留痕', en: ' marked' },

  'editor.chapter': { zh: '章', en: 'Ch' },
  'editor.addChapter': { zh: '添加章节', en: 'Add chapter' },
  'copy.hint': { zh: '点击上方标签切换版本，选中文本后可直接 Ctrl+C 复制', en: 'Click tabs to switch version, select and Ctrl+C to copy' },
  'copy.trace': { zh: '留痕版', en: 'Tracked' },
  'copy.clean': { zh: '纯净版', en: 'Clean' },

  // Shortcut labels
  'sc.softDelete': { zh: '删除留痕', en: 'Soft delete' },
  'sc.hardDelete': { zh: '真删除', en: 'Hard delete' },
  'sc.splitParagraph': { zh: '换段', en: 'New paragraph' },
  'sc.toggleBold': { zh: '粗体', en: 'Bold' },
  'sc.toggleItalic': { zh: '斜体', en: 'Italic' },
  'sc.toggleHideDeleted': { zh: '清屏/恢复', en: 'Toggle marks' },

  'pc.article': { zh: '单篇', en: 'Article' },
  'pc.book': { zh: '书', en: 'Book' },
};

// Reactive hook: re-renders when settings change
let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function getSnapshot(): Lang {
  return loadSettings().lang || 'zh';
}

// Notify all listeners when language changes
export function notifyLangChange() {
  listeners.forEach((cb) => cb());
}

export function t(key: string, lang?: Lang): string {
  const l = lang || getSnapshot();
  return translations[key]?.[l] || translations[key]?.zh || key;
}

export function useT() {
  const lang = useSyncExternalStore(subscribe, getSnapshot);
  return useCallback((key: string) => t(key, lang), [lang]);
}
