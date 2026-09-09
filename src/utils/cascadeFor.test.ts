import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCascadeFor } from './cascadeFor';
import type { CleanupRecords } from './fileCleanup';

// cascadeFor composes the fileCleanup primitives; this exercises the REAL
// extracted helper (App.tsx just wires recordsRef.current into it).
const mockRemove = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
    storage: { from: () => ({ remove: (...a: unknown[]) => mockRemove(...a) }) },
  },
}));

const emptyRecords = (): CleanupRecords => ({ posts: [], templates: [], assets: [], research: [], logoUrls: [] });
const SB_URL = 'https://sgevopyvcsclkasvekah.supabase.co/storage/v1/object/public/brand-assets/assets/IMG.png';
const DRIVE_URL = 'https://lh3.googleusercontent.com/d/TPLIMG';

describe('makeCascadeFor', () => {
  beforeEach(() => { mockRemove.mockReset(); localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('does nothing for a file it cannot identify', () => {
    const cascadeFor = makeCascadeFor(emptyRecords);
    cascadeFor({ url: 'https://images.unsplash.com/photo-1' }, 'p1', { deferMs: 6000 });
    vi.advanceTimersByTime(6000);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('cancels the deferred post file-delete when the post is restored via Undo (same id)', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    const records = emptyRecords();
    const cascadeFor = makeCascadeFor(() => records);

    cascadeFor({ url: SB_URL }, 'p1', { deferMs: 6000 });
    // user hits Undo before 6s: the post is back under its ORIGINAL id, same image.
    records.posts = [{ id: 'p1', visualUrl: SB_URL } as never];
    await vi.advanceTimersByTimeAsync(6000);

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('runs the deferred post file-delete when the post is never restored', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    const cascadeFor = makeCascadeFor(emptyRecords);

    cascadeFor({ url: SB_URL }, 'p1', { deferMs: 6000 });
    await vi.advanceTimersByTimeAsync(6000);

    expect(mockRemove).toHaveBeenCalledWith(['assets/IMG.png']);
  });

  it('deletes a template image immediately when nothing else references it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { status: 'success' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const cascadeFor = makeCascadeFor(emptyRecords);

    cascadeFor({ url: DRIVE_URL }, 't1');
    await vi.runAllTimersAsync();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.payload).toEqual({ action: 'deleteFile', fileId: 'TPLIMG' });
  });

  it('skips the immediate delete when another record still references the file', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { status: 'success' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const records = emptyRecords();
    records.templates = [{ id: 'other', imagePreview: DRIVE_URL } as never];
    const cascadeFor = makeCascadeFor(() => records);

    cascadeFor({ url: DRIVE_URL }, 't1');
    await vi.runAllTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
