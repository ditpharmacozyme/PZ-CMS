import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cleanup from './utils/fileCleanup';

// cascadeFor (in App.tsx) composes the fileCleanup primitives; this exercises
// that composition's decision logic without a full App render (App pulls in
// Supabase, routing, etc). The deferred post-delete path re-checks references
// at fire time with NO exclusion, so an Undo restore cancels the delete.
const mockRemove = vi.fn();
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
    storage: { from: () => ({ remove: (...a: unknown[]) => mockRemove(...a) }) },
  },
}));

describe('App delete-cascade wiring contract', () => {
  beforeEach(() => { mockRemove.mockReset(); localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const POST_URL = 'https://sgevopyvcsclkasvekah.supabase.co/storage/v1/object/public/brand-assets/assets/POSTIMG.png';

  it('cancels the deferred post file-delete when the post is restored via Undo (same id)', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    const ref = cleanup.identifyFile({ url: POST_URL })!;

    // schedule exactly as cascadeFor's deferred branch does: NO exclusion.
    cleanup.scheduleFileDelete(ref, 6000, () => !cleanup.isFileStillReferenced(ref, records, ''));

    // user hits Undo before 6s: the post is back under its ORIGINAL id, same image.
    records.posts = [{ id: 'p1', visualUrl: POST_URL } as never];
    await vi.advanceTimersByTimeAsync(6000);

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('runs the deferred post file-delete when the post is never restored', async () => {
    mockRemove.mockResolvedValue({ data: [{}], error: null });
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    const ref = cleanup.identifyFile({ url: POST_URL })!;

    cleanup.scheduleFileDelete(ref, 6000, () => !cleanup.isFileStillReferenced(ref, records, ''));

    // no Undo: records stays empty through the window.
    await vi.advanceTimersByTimeAsync(6000);

    expect(mockRemove).toHaveBeenCalledWith(['assets/POSTIMG.png']);
  });

  it('deletes a template image immediately when nothing else references it', () => {
    const spy = vi.spyOn(cleanup, 'cascadeFileDelete').mockResolvedValue();
    const ref = cleanup.identifyFile({ url: 'https://lh3.googleusercontent.com/d/TPLIMG' })!;
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    // immediate branch: the just-deleted record is still excluded by its own id.
    if (!cleanup.isFileStillReferenced(ref, records, 't1')) void cleanup.cascadeFileDelete(ref);
    expect(spy).toHaveBeenCalledWith(ref);
  });
});
