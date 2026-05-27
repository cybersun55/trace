import { useEffect, useState } from 'react';
import { useProjectStore } from './store';
import { importTracebookFull, isOPFSAvailable, getOPFSError, resetOPFSCheck } from './storage';
import ProjectCard from './ProjectCard';
import NewProjectDialog from './NewProjectDialog';
import SettingsDialog from './SettingsDialog';
import { useT } from './i18n';
import type { ProjectType } from './types';

export default function Dashboard() {
  const {
    projects, isLoading, error,
    loadProjectList, openProject, createProject, deleteProject, renameProject,
  } = useProjectStore();

  const tt = useT();
  const [opfsOk, setOpfsOk] = useState(true);
  const [opfsError, setOpfsError] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isOPFSAvailable();
      setOpfsOk(ok);
      if (!ok) setOpfsError(getOPFSError());
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
        <div className="db-title">{tt('app.title')}</div>
        <button className="gear-btn" onClick={() => setSettingsOpen(true)} title={tt('eh.settings')}>⚙</button>
      </div>

      <div className="app-divider" />

      {opfsOk && (
        <div className="db-toolbar">
          <button className="app-btn" onClick={() => setNewDialog(true)}>
            {tt('db.new')}
          </button>
          <button className="app-btn" onClick={handleImport}>
            {tt('db.import')}
          </button>
        </div>
      )}

      {!opfsOk && (
        <div className="db-error">
          <p>此浏览器不支持本地持久存储</p>
          {opfsError && <p style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>{opfsError}</p>}
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            请使用 Chromium 内核浏览器（Chrome / Edge / Opera），
            且不要使用隐私/无痕模式。
          </p>
          <button className="app-btn" style={{ marginTop: '12px' }} onClick={() => {
            resetOPFSCheck();
            setOpfsOk(true);
            setOpfsError('');
            isOPFSAvailable().then(ok => {
              setOpfsOk(ok);
              if (!ok) setOpfsError(getOPFSError());
              if (ok) loadProjectList();
            });
          }}>
            重试
          </button>
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
          <span className="db-empty-text">{tt('db.empty')}</span>
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
            <div className="vp-title">{tt('db.deleteConfirm')}</div>
            <p style={{ fontSize: '13px', color: '#8c8276', marginBottom: '16px' }}>
              {tt('db.deleteWarning')}
            </p>
            <div className="vp-buttons">
              <button className="vp-btn vp-btn-trace" onMouseDown={(e) => { e.preventDefault(); handleDelete(deleteConfirm); }}>
                {tt('db.delete')}
              </button>
              <button className="vp-btn vp-btn-clean" onMouseDown={(e) => { e.preventDefault(); setDeleteConfirm(null); }}>
                {tt('db.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
