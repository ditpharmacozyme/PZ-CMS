import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cleanup from './utils/fileCleanup';

// This test targets the cascadeFor decision logic by exercising the exported
// primitives the way App wires them — a focused unit test of the contract,
// not a full App render (App pulls in Supabase, routing, etc).
describe('App delete-cascade wiring contract', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('defers a post file-delete and cancels it when the image is still referenced', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(cleanup, 'cascadeFileDelete').mockResolvedValue();
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    const ref = cleanup.identifyFile({ url: 'https://lh3.googleusercontent.com/d/POSTIMG' })!;

    // schedule as App does (defer 6s, exclude the deleted post's id), reading a mutable records ref
    cleanup.scheduleFileDelete(ref, 6000, () => !cleanup.isFileStillReferenced(ref, records, 'p1'));

    // before 6s a live record still points at the image (post restored via Undo / image reused)
    records.posts = [{ id: 'p2', visualUrl: 'https://lh3.googleusercontent.com/d/POSTIMG' } as never];
    await vi.advanceTimersByTimeAsync(6000);

    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('deletes a template image when nothing else references it', () => {
    const spy = vi.spyOn(cleanup, 'cascadeFileDelete').mockResolvedValue();
    const ref = cleanup.identifyFile({ url: 'https://lh3.googleusercontent.com/d/TPLIMG' })!;
    const records: cleanup.CleanupRecords = { posts: [], templates: [], assets: [], research: [] };
    if (!cleanup.isFileStillReferenced(ref, records, 't1')) void cleanup.cascadeFileDelete(ref);
    expect(spy).toHaveBeenCalledWith(ref);
  });
});
