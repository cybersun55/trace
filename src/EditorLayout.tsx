import { useMemo, useState, useEffect } from 'react';
import { useEditorStore } from './store';
import { useProjectStore } from './store/projectStore';
import { loadSettings } from './settings';
import Editor from './Editor';
import EditorHeader from './EditorHeader';
import ChapterSidebar from './ChapterSidebar';

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

export default function EditorLayout() {
  const doc = useEditorStore((s) => s.document);
  const stats = useMemo(() => computeStats(doc), [doc]);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [hideHints, setHideHints] = useState(false);
  const [hintHtml, setHintHtml] = useState('');

  // Total word count: for books use the store's total (updated on save),
  // for articles use the live count from current doc
  const totalWords = activeProject?.type === 'book' ? activeProject.wordCount : stats.normalChars;

  // Build hint from shortcut settings
  useEffect(() => {
    const isMac = /Mac/i.test(navigator.platform);
    const modKey = (keys: string) => isMac ? keys : keys.replace(/Cmd/gi, 'Ctrl');

    const s = loadSettings();
    setHideHints(s.hideHints);
    const parts = s.shortcuts
      .filter((sc) => ['softDelete', 'hardDelete', 'splitParagraph', 'toggleBold', 'toggleItalic', 'toggleHideDeleted'].includes(sc.id))
      .map((sc) => {
        if (sc.id === 'toggleBold') return `<span>${modKey(sc.keys)}</span> / <span>${modKey(s.shortcuts.find(x => x.id === 'toggleItalic')?.keys || 'Ctrl+I')}</span> <b>格式</b>`;
        if (sc.id === 'toggleItalic') return null; // combined with toggleBold
        return `<span>${modKey(sc.keys)}</span> <b>${sc.label}</b>`;
      })
      .filter(Boolean)
      .join(' | ');
    setHintHtml(parts);
  }, []);

  return (
    <div className="app">
      <EditorHeader />
      {!hideHints && (
        <div className="hint" dangerouslySetInnerHTML={{ __html: hintHtml }} />
      )}
      <div className="el-body">
        <ChapterSidebar />
        <div className="el-editor">
          <Editor />
        </div>
      </div>

      {/* Stats — bottom right */}
      <div className="el-stats">
        <span>{totalWords.toLocaleString()} 字</span>
        <span className="el-stats-dot">·</span>
        <span>{stats.paragraphs} 段</span>
        {stats.deletedChars > 0 && (
          <>
            <span className="el-stats-dot">·</span>
            <span>{stats.deletedChars} 处留痕</span>
          </>
        )}
      </div>
    </div>
  );
}
