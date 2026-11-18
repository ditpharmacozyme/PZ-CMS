import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AdProgram, AdSet, AdCreative, AdShareLink } from '../types';

vi.mock('../utils/adsStorage', () => ({
  fetchAdsSnapshot: vi.fn(),
  fetchAdAudiences: vi.fn(),
  fetchShareLinks: vi.fn(),
  upsertRemoteProgram: vi.fn().mockResolvedValue(undefined),
  upsertRemoteSet: vi.fn().mockResolvedValue(undefined),
  upsertRemoteCreative: vi.fn().mockResolvedValue(undefined),
  upsertRemoteShareLink: vi.fn().mockResolvedValue(undefined),
  upsertRemoteAudience: vi.fn().mockResolvedValue(undefined),
  deleteRemoteProgram: vi.fn().mockResolvedValue(undefined),
  deleteRemoteSet: vi.fn().mockResolvedValue(undefined),
  deleteRemoteCreative: vi.fn().mockResolvedValue(undefined),
  deleteRemoteAudience: vi.fn().mockResolvedValue(undefined),
  subscribeAdsChanges: vi.fn(() => () => {}),
}));
vi.mock('../utils/adsDrive', () => ({
  ensureFolder: vi.fn(),
  renameFolder: vi.fn().mockResolvedValue(undefined),
  moveFolder: vi.fn().mockResolvedValue(undefined),
  moveFile: vi.fn().mockResolvedValue(undefined),
  trashFile: vi.fn().mockResolvedValue(undefined),
  trashFolder: vi.fn().mockResolvedValue(undefined),
}));

import * as storage from '../utils/adsStorage';
import * as drive from '../utils/adsDrive';
import { useAdsLibrary } from './useAdsLibrary';

const ts = '2026-01-01T00:00:00Z';
const program: AdProgram = { id: 'p1', name: 'Prog', brandId: 'b', kind: 'course', driveFolderId: 'fP', hidden: false, createdBy: 'x', createdAt: ts, updatedAt: ts };
const mkSet = (o: Partial<AdSet>): AdSet => ({ id: 's1', programId: 'p1', name: 'Set', audience: 'a', driveFolderId: 'fS', hidden: false, isSystem: false, createdBy: 'x', createdAt: ts, updatedAt: ts, ...o });
const unsorted = mkSet({ id: 'ads-unsorted', programId: null, name: 'Unsorted', driveFolderId: '', isSystem: true });
const mkCr = (o: Partial<AdCreative>): AdCreative => ({ id: 'c1', setId: 's1', name: 'C', format: 'image', files: [{ driveFileId: 'f1', name: 'a.png', mimeType: 'image/png', sizeBytes: 1 }], sourceUrl: '', hidden: false, uploadedBy: 'x', createdAt: ts, updatedAt: ts, ...o });

async function setup() {
  vi.mocked(storage.fetchAdsSnapshot).mockResolvedValue({
    programs: [program],
    sets: [unsorted, mkSet({}), mkSet({ id: 's2', driveFolderId: 'fS2' })],
    creatives: [
      mkCr({ id: 'c1' }),
      mkCr({
        id: 'c2',
        setId: 's2',
        files: [
          { driveFileId: 'f2', name: 'b.png', mimeType: 'image/png', sizeBytes: 1 },
          { driveFileId: 'f3', name: 'c.png', mimeType: 'image/png', sizeBytes: 1 },
        ],
      }),
    ],
  });
  vi.mocked(storage.fetchAdAudiences).mockResolvedValue([]);
  vi.mocked(storage.fetchShareLinks).mockResolvedValue([]);
  const hook = renderHook(() => useAdsLibrary('Tester'));
  await waitFor(() => expect(hook.result.current.programs.length).toBe(1));
  return hook;
}

describe('useAdsLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(drive.ensureFolder).mockResolvedValue('newFolder');
  });

  it('createSet does not persist when ensureFolder rejects', async () => {
    const { result } = await setup();
    vi.mocked(drive.ensureFolder).mockRejectedValue(new Error('drive down'));
    await act(async () => {
      await expect(result.current.createSet({ name: 'X', programId: 'p1', audience: 'a' })).rejects.toThrow('drive down');
    });
    expect(storage.upsertRemoteSet).not.toHaveBeenCalled();
    expect(result.current.sets.some((s) => s.name === 'X')).toBe(false);
  });

  it('deleteProgram move-to-unsorted moves files and re-parents creatives', async () => {
    const { result } = await setup();
    let res: { driveOk: boolean } | undefined;
    await act(async () => {
      res = await result.current.deleteProgram('p1', 'move-to-unsorted');
    });
    expect(res).toEqual({ driveOk: true });
    expect(drive.moveFile).toHaveBeenCalledTimes(3);
    expect(drive.ensureFolder).toHaveBeenCalledWith('Unsorted');
    expect(result.current.creatives.map((c) => c.setId)).toEqual(['ads-unsorted', 'ads-unsorted']);
    expect(result.current.countCreativesUnder('program', 'p1')).toBe(0);
    expect(result.current.programs).toHaveLength(0);
    expect(storage.deleteRemoteProgram).toHaveBeenCalledWith('p1');
    expect(drive.trashFolder).toHaveBeenCalledWith('fP');
  });

  it('deleteProgram delete-all returns driveOk:false when trashFolder rejects but row is removed', async () => {
    const { result } = await setup();
    vi.mocked(drive.trashFolder).mockRejectedValue(new Error('nope'));
    let res: { driveOk: boolean } | undefined;
    await act(async () => {
      res = await result.current.deleteProgram('p1', 'delete-all');
    });
    expect(res).toEqual({ driveOk: false });
    expect(result.current.programs).toHaveLength(0);
    expect(storage.deleteRemoteProgram).toHaveBeenCalledWith('p1');
  });

  it('cannot delete or rename ads-unsorted', async () => {
    const { result } = await setup();
    await act(async () => {
      await expect(result.current.deleteSet('ads-unsorted', 'delete-all')).rejects.toThrow("Unsorted can't be changed");
      await expect(result.current.updateSet('ads-unsorted', { name: 'Z' })).rejects.toThrow("Unsorted can't be changed");
    });
  });

  it('countCreativesUnder counts across sets of a program', async () => {
    const { result } = await setup();
    expect(result.current.countCreativesUnder('program', 'p1')).toBe(2);
    expect(result.current.countCreativesUnder('set', 's2')).toBe(1);
  });

  it('createShareLink returns 32-char lowercase hex token', async () => {
    const { result } = await setup();
    let link: AdShareLink | undefined;
    await act(async () => {
      link = await result.current.createShareLink('set', 's1', 'L');
    });
    expect(link!.token).toMatch(/^[0-9a-f]{32}$/);
    expect(storage.upsertRemoteShareLink).toHaveBeenCalled();
  });

  it('two addCreative calls with the same name produce two rows', async () => {
    const { result } = await setup();
    const files = [{ driveFileId: 'z', name: 'z.png', mimeType: 'image/png', sizeBytes: 1 }];
    await act(async () => {
      await result.current.addCreative({ setId: 's1', name: 'Same', files });
      await result.current.addCreative({ setId: 's1', name: 'Same', files });
    });
    expect(result.current.creatives.filter((c) => c.name === 'Same')).toHaveLength(2);
  });
});
