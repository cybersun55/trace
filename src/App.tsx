import { useEffect, useRef } from 'react';
import Editor from './Editor';
import { useStore } from './store';
import { autoSave, exportTracebook, importTracebook } from './storage';
import './App.css';

export default function App() {
  const loadDocument = useStore((s) => s.loadDocument);
  const doc = useStore((s) => s.document);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-save to localStorage on every document change
  useEffect(() => {
    autoSave(doc);
  }, [doc]);

  const handleSave = async () => {
    await exportTracebook(doc);
  };

  const handleOpen = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imported = await importTracebook(file);
    if (imported) loadDocument(imported);
    // Reset so the same file can be re-opened
    e.target.value = '';
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1 style={{ fontSize: 20, fontWeight: 400, color: '#4a4238', marginBottom: 8 }}>
          推敲 Trace
        </h1>
        <div className="app-actions">
          <button className="app-btn" onClick={handleSave}>保存</button>
          <button className="app-btn" onClick={handleOpen}>打开</button>
          <input
            ref={fileRef}
            type="file"
            accept=".tracebook"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>
      <div className="hint">
        Backspace <b>删除留痕</b> | Shift+Backspace <b>真删除</b> | Enter 换段 | Cmd+B/I 格式 | Tab 清屏
      </div>
      <Editor />
    </div>
  );
}
