import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import {
  rowToCreative,
  creativeToRow,
  rowToProgram,
  rowToSet,
  rowToShareLink,
  fetchPublicLibrary,
  fetchSharedScope
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
