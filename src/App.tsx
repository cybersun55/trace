import Editor from './Editor';
import Toolbar from './Toolbar';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <h1 style={{ fontSize: 20, fontWeight: 400, color: '#4a4238', marginBottom: 8 }}>
        推敲 Trace
      </h1>
      <div className="hint">
        Backspace <b>删除留痕</b> | Shift+Backspace <b>真删除</b> | Enter 换段 | Cmd+B/I 格式 | Cmd+H 清屏
      </div>
      <Editor />
    </div>
  );
}
