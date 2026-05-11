import Editor from './Editor';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <h1 style={{ fontSize: 20, fontWeight: 400, color: '#4a4238', marginBottom: 8 }}>
        推敲 Trace
      </h1>
      <div style={{ fontSize: 13, color: '#b0a89b', marginBottom: 32, lineHeight: 1.6 }}>
        Backspace <b>删除留痕</b> | Shift+Backspace <b>真删除</b> | Enter 换段 | Cmd+V 粘贴
      </div>
      <Editor />
    </div>
  );
}
