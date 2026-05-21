import { useEffect, useState } from 'react';
import { useProjectStore } from './store';
import { importTracebookFull } from './storage';
import ProjectCard from './ProjectCard';
import NewProjectDialog from './NewProjectDialog';
import type { ProjectType } from './types';

export default function Dashboard() {
  const {
    projects, isLoading, error,
    loadProjectList, openProject, createProject, deleteProject, renameProject,
  } = useProjectStore();

  const [newDialog, setNewDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadProjectList();
  }, [loadProjectList]);

  const handleNew = async (title: string, type: ProjectType) => {
    const id = await createProject(title, type);
    setNewDialog(false);
    if (id) openProject(id);
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setDeleteConfirm(null);
  };

  const handleImport = async () => {
    const result = await importTracebookFull();
    if (!result) return;
    // Import as either article or book
    const pid = await createProject(result.title, result.type);
    if (!pid) return;
    openProject(pid);
  };

  return (
    <div className="app">
      <div className="db-header">
        <div className="db-title">推敲 Trace</div>
        <div className="db-subtitle">作品列表</div>
      </div>

      <div className="db-toolbar">
        <button className="app-btn" onClick={() => setNewDialog(true)}>
          新建
        </button>
        <button className="app-btn" onClick={handleImport}>
          导入 .tracebook
        </button>
      </div>

      <div className="app-divider" />

      {isLoading && (
        <div className="db-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="pc-card pc-skeleton" />
          ))}
        </div>
      )}

      {error && (
        <div className="db-error">
          <p>{error}</p>
          <p>请检查浏览器是否支持持久存储，或使用标准模式打开。</p>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="db-empty">
          <div className="db-empty-icon">pen</div>
          <div className="db-empty-text">还没有作品</div>
          <button className="vp-btn vp-btn-trace" onClick={() => setNewDialog(true)}>
            开始写作
          </button>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="db-grid">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={openProject}
              onDelete={(id) => setDeleteConfirm(id)}
              onRename={renameProject}
            />
          ))}
        </div>
      )}

      {newDialog && (
        <NewProjectDialog
          onClose={() => setNewDialog(false)}
          onCreate={handleNew}
        />
      )}

      {deleteConfirm && (
        <div className="vp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="vp-dialog">
            <div className="vp-title">确定删除此作品？</div>
            <p style={{ fontSize: '13px', color: '#8c8276', marginBottom: '16px' }}>
              删除后无法恢复
            </p>
            <div className="vp-buttons">
              <button className="vp-btn vp-btn-trace" onMouseDown={(e) => { e.preventDefault(); handleDelete(deleteConfirm); }}>
                删除
              </button>
              <button className="vp-btn vp-btn-clean" onMouseDown={(e) => { e.preventDefault(); setDeleteConfirm(null); }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
