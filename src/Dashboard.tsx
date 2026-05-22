import { useEffect, useState } from 'react';
import { useProjectStore } from './store';
import { importTracebookFull, isOPFSAvailable } from './storage';
import ProjectCard from './ProjectCard';
import NewProjectDialog from './NewProjectDialog';
import type { ProjectType } from './types';

export default function Dashboard() {
  const {
    projects, isLoading, error,
    loadProjectList, openProject, createProject, deleteProject, renameProject,
  } = useProjectStore();

  const [opfsOk, setOpfsOk] = useState(true);
  const [newDialog, setNewDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isOPFSAvailable();
      setOpfsOk(ok);
      if (ok) loadProjectList();
    })();
  }, [loadProjectList]);

  const handleNew = async (title: string, type: ProjectType) => {
    try {
      const id = await createProject(title, type);
      setNewDialog(false);
      if (id) await openProject(id);
    } catch {
      setNewDialog(false);
      useProjectStore.setState({ error: '存储空间不足或浏览器不支持' });
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteProject(id); } catch {}
    setDeleteConfirm(null);
  };

  const handleImport = async () => {
    try {
      const result = await importTracebookFull();
      if (!result) return;
      const pid = await createProject(result.title, result.type);
      if (!pid) return;
      await openProject(pid);
    } catch {}
  };

  return (
    <div className="app">
      <div className="db-header">
        <div className="db-title">推敲 Trace</div>
      </div>

      {!opfsOk && (
        <div className="db-error">
          <p>此浏览器不支持本地持久存储</p>
          <p>请使用 Chromium 内核浏览器（Chrome / Edge / Opera），
            且不要使用隐私/无痕模式。</p>
        </div>
      )}

      {opfsOk && isLoading && (
        <div className="db-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="pc-card pc-skeleton" />
          ))}
        </div>
      )}

      {opfsOk && error && (
        <div className="db-error">
          <p>{error}</p>
        </div>
      )}

      {opfsOk && !isLoading && !error && projects.length === 0 && (
        <div className="db-empty">
          <div className="db-empty-actions">
            <button className="db-big-btn" onClick={() => setNewDialog(true)}>
              新建作品
            </button>
            <button className="db-big-btn db-big-btn-import" onClick={handleImport}>
              导入 .tracebook
            </button>
          </div>
        </div>
      )}

      {opfsOk && !isLoading && !error && projects.length > 0 && (
        <div className="db-grid">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={(id) => { openProject(id).catch(() => {}); }}
              onDelete={(id) => setDeleteConfirm(id)}
              onRename={renameProject}
            />
          ))}
          {/* New / Import as cards at the end of the grid */}
          <button className="pc-card pc-card-add" onClick={() => setNewDialog(true)}>
            <span className="pc-add-icon">+</span>
            <span className="pc-add-label">新建</span>
          </button>
          <button className="pc-card pc-card-add" onClick={handleImport}>
            <span className="pc-add-icon">doc</span>
            <span className="pc-add-label">导入</span>
          </button>
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
