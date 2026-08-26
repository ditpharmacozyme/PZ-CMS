import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRollingBackups,
  saveRollingBackup,
  deleteRollingBackup,
  checkAndTriggerAutoBackup,
  WorkspaceBackupPayload
} from './autoBackup';

const mockPayload: WorkspaceBackupPayload = {
  version: '1.0',
  timestamp: new Date().toISOString(),
  posts: [
    {
      id: 'p1',
      brandId: 'pharmacozyme',
      title: 'Sample Post',
      caption: 'Test caption',
      platform: 'instagram',
      specType: 'feed-post',
      scheduledDate: '2026-08-26',
      scheduledTime: '10:00 AM',
      status: 'not-started',
      assignees: [],
      visualUrl: '',
      approved: false,
      tags: [],
      comments: [],
      activityLog: []
    }
  ],
  contentBank: [],
  researchPlans: [],
  templates: [],
  teamMembers: []
};

describe('autoBackup utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty rolling backups', () => {
    expect(getRollingBackups()).toEqual([]);
  });

  it('saves a backup snapshot and retrieves it', () => {
    const list = saveRollingBackup(mockPayload);
    expect(list).toHaveLength(1);
    expect(list[0].postCount).toBe(1);
    expect(getRollingBackups()).toHaveLength(1);
  });

  it('caps rolling backups at maximum 5 entries', () => {
    for (let i = 0; i < 7; i++) {
      saveRollingBackup({
        ...mockPayload,
        posts: [{ ...mockPayload.posts[0], id: `p-${i}` }]
      });
    }

    const backups = getRollingBackups();
    expect(backups).toHaveLength(5);
  });

  it('deletes a specific snapshot by id', () => {
    saveRollingBackup(mockPayload);
    const backups = getRollingBackups();
    const idToDelete = backups[0].id;

    const remaining = deleteRollingBackup(idToDelete);
    expect(remaining).toHaveLength(0);
    expect(getRollingBackups()).toHaveLength(0);
  });

  it('triggers auto backup when none has been performed', () => {
    const triggered = checkAndTriggerAutoBackup(mockPayload);
    expect(triggered).toBe(true);
    expect(getRollingBackups()).toHaveLength(1);

    // Immediately calling it again should not re-trigger because interval has not passed
    const triggeredAgain = checkAndTriggerAutoBackup(mockPayload);
    expect(triggeredAgain).toBe(false);
  });
});
