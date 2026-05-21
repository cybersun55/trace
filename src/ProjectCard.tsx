import { useState, useRef, useCallback } from 'react';
import type { ProjectMeta } from './types';

interface Props {
  project: ProjectMeta;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    if (diff < 172_800_000) return '昨天';
    return d.toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
}

function fmtWordCount(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}千`;
  return n.toLocaleString();
}

export default function ProjectCard({ project, onOpen, onDelete, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(project.title);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [project.title]);

  const commitEdit = useCallback(() => {
    const t = editTitle.trim();
    if (t && t !== project.title) onRename(project.id, t);
    setEditing(false);
  }, [editTitle, project, onRename]);

  return (
    <div className="pc-card" onClick={() => onOpen(project.id)}>
      <div className={`pc-type-badge pc-type-${project.type}`}>
        {project.type === 'article' ? '单篇' : '书'}
      </div>

      <div className="pc-body">
        {editing ? (
          <input
            ref={inputRef}
            className="pc-title-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="pc-title" onDoubleClick={startEdit}>
            {project.title}
          </div>
        )}

        <div className="pc-meta">
          <span>{fmtWordCount(project.wordCount)} 字</span>
          <span className="pc-meta-dot">·</span>
          <span>{fmtTime(project.updatedAt)}</span>
        </div>
      </div>

      <div className="pc-menu" ref={menuRef}>
        <button
          className="pc-menu-btn"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          title="更多操作"
        >
          ···
        </button>
        {menuOpen && (
          <div className="pc-menu-dropdown">
            <button
              className="dropdown-item"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(e as any); setMenuOpen(false); }}
            >
              重命名
            </button>
            <button
              className="dropdown-item"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project.id); setMenuOpen(false); }}
            >
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
