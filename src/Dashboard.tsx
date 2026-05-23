import { useEffect, useState } from 'react';
import { useProjectStore } from './store';
import { importTracebookFull, isOPFSAvailable } from './storage';
import ProjectCard from './ProjectCard';
import NewProjectDialog from './NewProjectDialog';
import SettingsDialog from './SettingsDialog';
import type { ProjectType } from './types';

export default function Dashboard() {
  const {
    projects, isLoading, error,
    loadProjectList, openProject, createProject, deleteProject, renameProject,
  } = useProjectStore();

  const [opfsOk, setOpfsOk] = useState(true);
  const [newDialog, setNewDialog] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        <button className="gear-btn" onClick={() => setSettingsOpen(true)} title="设置">⚙</button>
      </div>

      <div className="app-divider" />

      {opfsOk && (
        <div className="db-toolbar">
          <button className="app-btn" onClick={() => setNewDialog(true)}>
            新建
          </button>
          <button className="app-btn" onClick={handleImport}>
            导入 .tracebook
          </button>
        </div>
      )}

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
          <span className="db-empty-text">还没有作品</span>
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

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
