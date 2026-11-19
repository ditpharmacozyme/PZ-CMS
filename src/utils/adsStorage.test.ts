import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const upsert = vi.fn();
const eq = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ upsert: (...a: unknown[]) => upsert(...a), delete: () => ({ eq: (...a: unknown[]) => eq(...a) }) })
  }
}));

import {
  rowToCreative,
  creativeToRow,
  rowToProgram,
  rowToSet,
  rowToShareLink,
  fetchPublicLibrary,
  fetchSharedScope,
  upsertRemoteShareLink,
  upsertRemoteAudience,
  deleteRemoteCreative
} from './adsStorage';

const EMPTY = { programs: [], sets: [], creatives: [] };

describe('adsStorage mappers', () => {
  it('round-trips a creative with uploaded_by defaulting to empty', () => {
    const c = rowToCreative({
      id: 'c1',
      set_id: 's1',
      name: 'A',
      format: 'image',
      files: [{ driveFileId: 'f' }]
    });
    expect(c.uploadedBy).toBe('');
    expect(c.sourceUrl).toBe('');
    expect(c.hidden).toBe(false);
    const row = creativeToRow(c);
    expect(row.id).toBe('c1');
    expect(row.set_id).toBe('s1');
    expect(row.uploaded_by).toBe('');
    expect(row.files).toEqual([{ driveFileId: 'f' }]);
  });

  it('defaults missing files to []', () => {
    expect(rowToCreative({ id: 'c', set_id: 's', name: 'n' }).files).toEqual([]);
  });

  it('defaults stripped fields on program/set/share link', () => {
    expect(rowToProgram({ id: 'p', name: 'P' }).driveFolderId).toBe('');
    const s = rowToSet({ id: 's', name: 'S' });
    expect(s.programId).toBeNull();
    expect(s.isSystem).toBe(false);
    expect(rowToShareLink({ token: 't', level: 'set', target_id: 'x' }).revokedAt).toBeNull();
  });
});

describe('public RPC wrappers', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('fetchPublicLibrary returns empty on error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await fetchPublicLibrary()).toEqual(EMPTY);
    expect(rpc).toHaveBeenCalledWith('ads_public_library');
  });

  it('fetchPublicLibrary returns empty when rpc throws', async () => {
    rpc.mockRejectedValue(new Error('boom'));
    expect(await fetchPublicLibrary()).toEqual(EMPTY);
  });

  it('fetchSharedScope passes the token', async () => {
    rpc.mockResolvedValue({
      data: { programs: [], sets: [], creatives: [{ id: 'c', set_id: 's', name: 'n' }] },
      error: null
    });
    const snap = await fetchSharedScope('t');
    expect(rpc).toHaveBeenCalledWith('ads_shared_scope', { p_token: 't' });
    expect(snap.creatives).toHaveLength(1);
    expect(snap.creatives[0].setId).toBe('s');
  });
});

describe('ads writes report failure', () => {
  beforeEach(() => {
    upsert.mockReset();
    eq.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const link = { token: 't', level: 'set' as const, targetId: 's', label: '', createdBy: '', createdAt: 'x', revokedAt: 'y' };

  it('a failed upsert throws with the database message', async () => {
    upsert.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(upsertRemoteShareLink(link)).rejects.toThrow('permission denied');
  });

  it('a duplicate audience name throws instead of failing silently', async () => {
    upsert.mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint' } });
    await expect(upsertRemoteAudience({ id: 'a', name: 'nurses', sortOrder: 1 })).rejects.toThrow(/duplicate key/);
  });

  it('a failed delete throws', async () => {
    eq.mockResolvedValue({ error: { message: 'nope' } });
    await expect(deleteRemoteCreative('c1')).rejects.toThrow('nope');
  });

  it('a successful write resolves', async () => {
    upsert.mockResolvedValue({ error: null });
    eq.mockResolvedValue({ error: null });
    await expect(upsertRemoteShareLink(link)).resolves.toBeUndefined();
    await expect(deleteRemoteCreative('c1')).resolves.toBeUndefined();
  });
});
