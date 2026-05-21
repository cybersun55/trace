import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from './store';

export default function ChapterSidebar() {
  const {
    activeProject, chapters, activeChapterId,
    switchChapter, addChapter,
  } = useProjectStore();

  const [collapsed, setCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBook = activeProject?.type === 'book';
  if (!isBook) return null;

  const handleAdd = useCallback(() => {
    const t = newTitle.trim();
    if (!t) return;
    addChapter(t);
    setNewTitle('');
    setAdding(false);
  }, [newTitle, addChapter]);

  const showAddInput = () => {
    setAdding(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      {/* Collapse toggle when hidden */}
      {collapsed && (
        <button className="cs-toggle" onClick={() => setCollapsed(false)} title="展开章节列表">
          章
        </button>
      )}

      <div className={`cs-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="cs-header">
          <span>章节</span>
          <button className="cs-collapse-btn" onClick={() => setCollapsed(true)} title="收起">
            ×
          </button>
        </div>

        <div className="cs-list">
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              className={`cs-item${ch.id === activeChapterId ? ' active' : ''}`}
              onClick={() => switchChapter(ch.id)}
            >
              <span className="cs-item-num">{i + 1}</span>
              <span className="cs-item-title">{ch.title}</span>
            </button>
          ))}
        </div>

        <div className="cs-footer">
          {adding ? (
            <div className="cs-add-form">
              <input
                ref={inputRef}
                className="cs-add-input"
                value={newTitle}
                placeholder="章节标题"
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
                }}
                onBlur={() => { if (!newTitle.trim()) setAdding(false); }}
              />
              <button className="cs-add-ok" onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}>
                确定
              </button>
            </div>
          ) : (
            <button className="cs-add-btn" onClick={showAddInput}>
              + 添加章节
            </button>
          )}
        </div>
      </div>
    </>
  );
}
