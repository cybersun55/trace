export {
  getRoot,
  getProjectsDir,
  getProjectDir,
  getChaptersDir,
  writeJSON,
  readJSON,
  remove,
  listProjectIds,
} from './opfs';

export {
  listProjects,
  createProject,
  loadProjectMeta,
  saveProjectMeta,
  deleteProject,
  saveChapter,
  loadChapter,
  loadTOC,
  saveTOC,
  createChapter,
  updateChapterTitle,
  deleteChapter,
} from './projects';

export {
  loadSettings,
  saveSettings,
  addRecentProject,
} from './settings';

export {
  crashSave,
  crashLoad,
  crashClear,
} from './crashSave';

export {
  saveBlobWithPicker,
  exportTracebook,
  exportBookTracebook,
  importTracebookFull,
  importTracebook,
  exportTextFile,
  getRecentFiles,
  addRecentFile,
  clearRecentFiles,
} from './io';

export type { SavePickerOptions, RecentEntry } from './io';
