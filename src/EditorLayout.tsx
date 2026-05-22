import { useMemo } from 'react';
import { useEditorStore } from './store';
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

  return (
    <div className="app">
      <EditorHeader />
      <div className="el-body">
        <ChapterSidebar />
        <div className="el-editor">
          <Editor />
        </div>
      </div>

      {/* Stats — bottom right */}
      <div className="el-stats">
        <span>{stats.normalChars.toLocaleString()} 字</span>
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
