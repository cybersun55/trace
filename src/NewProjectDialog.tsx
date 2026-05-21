import { useState, useRef, useEffect } from 'react';
import type { ProjectType } from './types';

interface Props {
  onClose: () => void;
  onCreate: (title: string, type: ProjectType) => void;
}

export default function NewProjectDialog({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProjectType>('article');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKD);
    return () => window.removeEventListener('keydown', onKD);
  }, [onClose]);

  const handleCreate = () => {
    const t = title.trim();
    if (!t) return;
    onCreate(t, type);
  };

  return (
    <div className="vp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="np-dialog">
        <div className="np-title">新建作品</div>

        <input
          ref={inputRef}
          className="np-input"
          type="text"
          value={title}
          placeholder="作品标题"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') onClose();
          }}
        />

        <div className="np-type-label">类型（创建后不可更改）</div>
        <div className="np-types">
          <button
            className={`np-type-card${type === 'article' ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); setType('article'); }}
          >
            <div className="np-type-icon">doc</div>
            <div className="np-type-name">单篇文章</div>
            <div className="np-type-desc">一个独立的文档</div>
          </button>
          <button
            className={`np-type-card${type === 'book' ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); setType('book'); }}
          >
            <div className="np-type-icon">book</div>
            <div className="np-type-name">多章节书</div>
            <div className="np-type-desc">包含多个章节</div>
          </button>
        </div>

        <div className="np-actions">
          <button className="vp-cancel" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>
            取消
          </button>
          <button
            className="vp-btn vp-btn-trace"
            onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
            disabled={!title.trim()}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
