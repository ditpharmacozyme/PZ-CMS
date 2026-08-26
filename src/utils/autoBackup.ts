import { Post, ContentBankItem, PostTemplate, TeamMember } from '../types';

export interface WorkspaceBackupPayload {
  version: string;
  timestamp: string;
  posts: Post[];
  contentBank: ContentBankItem[];
  researchPlans: any[];
  templates: PostTemplate[];
  teamMembers: TeamMember[];
}

export interface RollingBackupSummary {
  id: string;
  timestamp: string;
  postCount: number;
  copyCount: number;
  planCount: number;
  data: WorkspaceBackupPayload;
}

const STORAGE_KEY = 'pz_rolling_backups';
const MAX_ROLLING_BACKUPS = 5;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Retrieves all stored rolling backups from localStorage.
 */
export function getRollingBackups(): RollingBackupSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse rolling backups from localStorage:', err);
    return [];
  }
}

/**
 * Saves a new backup snapshot into the rolling list, keeping up to MAX_ROLLING_BACKUPS entries.
 */
export function saveRollingBackup(payload: WorkspaceBackupPayload): RollingBackupSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = getRollingBackups();
    const newSnapshot: RollingBackupSummary = {
      id: `backup-${Date.now()}`,
      timestamp: new Date().toISOString(),
      postCount: payload.posts?.length || 0,
      copyCount: payload.contentBank?.length || 0,
      planCount: payload.researchPlans?.length || 0,
      data: payload
    };

    // Prepend new backup, keep only the latest MAX_ROLLING_BACKUPS
    const updated = [newSnapshot, ...existing].slice(0, MAX_ROLLING_BACKUPS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem('pz_last_auto_backup_ts', Date.now().toString());
    return updated;
  } catch (err) {
    console.error('Failed to save rolling backup:', err);
    return getRollingBackups();
  }
}

/**
 * Deletes a specific snapshot by ID.
 */
export function deleteRollingBackup(backupId: string): RollingBackupSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = getRollingBackups();
    const filtered = existing.filter((b) => b.id !== backupId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Failed to delete rolling backup:', err);
    return getRollingBackups();
  }
}

/**
 * Checks if an automated background backup is due (> 24 hours since last backup),
 * and creates one if needed.
 */
export function checkAndTriggerAutoBackup(payload: WorkspaceBackupPayload): boolean {
  if (typeof window === 'undefined') return false;
  if (!payload.posts || payload.posts.length === 0) return false;

  try {
    const lastTs = localStorage.getItem('pz_last_auto_backup_ts');
    const now = Date.now();

    if (!lastTs || now - parseInt(lastTs, 10) > AUTO_BACKUP_INTERVAL_MS) {
      saveRollingBackup(payload);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
