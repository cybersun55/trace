import Editor from './Editor';
import EditorHeader from './EditorHeader';
import ChapterSidebar from './ChapterSidebar';

export default function EditorLayout() {
  return (
    <div className="app">
      <EditorHeader />
      <div className="el-body">
        <ChapterSidebar />
        <div className="el-editor">
          <Editor />
        </div>
      </div>
    </div>
  );
}
