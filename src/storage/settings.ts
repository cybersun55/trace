import type { AppSettings, RecentProjectEntry } from '../types';

const SETTINGS_KEY = 'trace_settings';

const DEFAULT: AppSettings = {
  lastOpenProjectId: null,
  recentProjects: [],
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT;
    return JSON.parse(raw) as AppSettings;
  } catch {
    return DEFAULT;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function addRecentProject(entry: RecentProjectEntry): void {
  const settings = loadSettings();
  settings.recentProjects = settings.recentProjects.filter(e => e.id !== entry.id);
  settings.recentProjects.unshift(entry);
  if (settings.recentProjects.length > 10) settings.recentProjects.length = 10;
  settings.lastOpenProjectId = entry.id;
  saveSettings(settings);
}
