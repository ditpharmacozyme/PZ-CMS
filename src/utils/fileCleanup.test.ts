import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyFile, fileRefsEqual, isFileStillReferenced, PENDING_DELETES_KEY, readDeleteQueue, enqueueFailedDelete, removeFromDeleteQueue } from './fileCleanup';
import type { Post, PostTemplate, BrandAsset, ResearchItem } from '../types';

describe('identifyFile', () => {
  it('prefers explicit storagePath', () => {
    expect(identifyFile({ storagePath: 'assets/abc-x.pdf', url: 'https://lh3.googleusercontent.com/d/ZZZ' }))
      .toEqual({ backend: 'supabase', path: 'assets/abc-x.pdf' });
  });

  it('prefers explicit driveFileId over url', () => {
    expect(identifyFile({ driveFileId: 'FILE123', url: 'https://example.com/x.png' }))
      .toEqual({ backend: 'drive', fileId: 'FILE123' });
  });

  it('parses a supabase public storage url', () => {
    expect(identifyFile({ url: 'https://sgevopyvcsclkasvekah.supabase.co/storage/v1/object/public/brand-assets/assets/9a2f-doc.pdf' }))
      .toEqual({ backend: 'supabase', path: 'assets/9a2f-doc.pdf' });
  });

  it('parses lh3.googleusercontent.com/d/<id>', () => {
    expect(identifyFile({ url: 'https://lh3.googleusercontent.com/d/1A2B3C' }))
      .toEqual({ backend: 'drive', fileId: '1A2B3C' });
  });

  it('parses drive.google.com/file/d/<id>/view', () => {
    expect(identifyFile({ url: 'https://drive.google.com/file/d/1A2B3C/view?usp=sharing' }))
      .toEqual({ backend: 'drive', fileId: '1A2B3C' });
  });

  it('parses drive.google.com/uc?...id=<id>', () => {
    expect(identifyFile({ url: 'https://drive.google.com/uc?export=download&id=1A2B3C' }))
      .toEqual({ backend: 'drive', fileId: '1A2B3C' });
  });

  it('returns null for a repo logo path', () => {
    expect(identifyFile({ url: '/logos/PZ_Logo.png' })).toBeNull();
  });

  it('returns null for a hand-pasted external url', () => {
    expect(identifyFile({ url: 'https://images.unsplash.com/photo-123' })).toBeNull();
  });

  it('returns null for empty / data / nullish input', () => {
    expect(identifyFile({ url: '' })).toBeNull();
    expect(identifyFile({ url: 'data:image/png;base64,iVBOR' })).toBeNull();
    expect(identifyFile({})).toBeNull();
    expect(identifyFile({ url: null, storagePath: null, driveFileId: null })).toBeNull();
  });
});

describe('fileRefsEqual', () => {
  it('matches same backend + id', () => {
    expect(fileRefsEqual({ backend: 'drive', fileId: 'X' }, { backend: 'drive', fileId: 'X' })).toBe(true);
  });
  it('rejects different id or backend', () => {
    expect(fileRefsEqual({ backend: 'drive', fileId: 'X' }, { backend: 'drive', fileId: 'Y' })).toBe(false);
    expect(fileRefsEqual({ backend: 'drive', fileId: 'X' }, { backend: 'supabase', path: 'X' })).toBe(false);
  });
});

const emptyRecords = { posts: [], templates: [], assets: [], research: [] };
const post = (id: string, visualUrl: string): Post => ({ id, visualUrl } as Post);
const tpl = (id: string, imagePreview: string): PostTemplate => ({ id, imagePreview } as PostTemplate);
const asset = (id: string, url: string, storagePath?: string): BrandAsset => ({ id, url, storagePath } as BrandAsset);
const research = (id: string, driveFileId: string): ResearchItem => ({ id, driveFileId } as ResearchItem);

describe('isFileStillReferenced', () => {
  const driveRef = { backend: 'drive' as const, fileId: 'SHARED' };
  const driveUrl = 'https://lh3.googleusercontent.com/d/SHARED';

  it('true when another post still uses the same drive file', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl), post('p2', driveUrl)] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(true);
  });

  it('false when only the excluded record used it', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl)] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(false);
  });

  it('true across collections — a template reuses a post image', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl)], templates: [tpl('t1', driveUrl)] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(true);
  });

  it('matches a supabase asset by storagePath', () => {
    const sbRef = { backend: 'supabase' as const, path: 'assets/x.pdf' };
    const records = { ...emptyRecords, assets: [asset('a1', 'https://cdn/x', 'assets/x.pdf'), asset('a2', 'https://cdn/x', 'assets/x.pdf')] };
    expect(isFileStillReferenced(sbRef, records, 'a1')).toBe(true);
  });

  it('ignores records whose file is an external / null ref', () => {
    const records = { ...emptyRecords, posts: [post('p1', driveUrl), post('p2', 'https://images.unsplash.com/y')] };
    expect(isFileStillReferenced(driveRef, records, 'p1')).toBe(false);
  });
});

describe('retry queue', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(readDeleteQueue()).toEqual([]);
  });

  it('enqueues and reads back', () => {
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toEqual([{ backend: 'drive', fileId: 'A' }]);
  });

  it('dedupes by ref-equality', () => {
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toHaveLength(1);
  });

  it('removes a specific ref', () => {
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    enqueueFailedDelete({ backend: 'supabase', path: 'p/b' });
    removeFromDeleteQueue({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toEqual([{ backend: 'supabase', path: 'p/b' }]);
  });

  it('caps at 200, dropping oldest', () => {
    for (let i = 0; i < 205; i++) enqueueFailedDelete({ backend: 'drive', fileId: `F${i}` });
    const q = readDeleteQueue();
    expect(q).toHaveLength(200);
    expect(q[0]).toEqual({ backend: 'drive', fileId: 'F5' });
    expect(q[199]).toEqual({ backend: 'drive', fileId: 'F204' });
  });

  it('survives a corrupt payload', () => {
    localStorage.setItem(PENDING_DELETES_KEY, '{not json');
    expect(readDeleteQueue()).toEqual([]);
    enqueueFailedDelete({ backend: 'drive', fileId: 'A' });
    expect(readDeleteQueue()).toEqual([{ backend: 'drive', fileId: 'A' }]);
  });
});
