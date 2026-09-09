import { describe, it, expect } from 'vitest';
import { findOrphans, type ManagedFile } from './orphanScan';
import type { CleanupRecords } from './fileCleanup';

const empty: CleanupRecords = { posts: [], templates: [], assets: [], research: [], logoUrls: [] };
const drive = (id: string, name: string): ManagedFile => ({ ref: { backend: 'drive', fileId: id }, name, location: 'Pharmacozyme CMS Uploads' });
const sb = (path: string): ManagedFile => ({ ref: { backend: 'supabase', path }, name: path.split('/').pop()!, location: 'brand-assets' });

describe('findOrphans', () => {
  it('flags a drive file no record points at', () => {
    expect(findOrphans([drive('A', 'a.png')], empty)).toHaveLength(1);
  });

  it('keeps a drive file a post still uses', () => {
    const records = { ...empty, posts: [{ id: 'p1', visualUrl: 'https://lh3.googleusercontent.com/d/A' } as never] };
    expect(findOrphans([drive('A', 'a.png')], records)).toEqual([]);
  });

  it('keeps a supabase file referenced by a brand logo url', () => {
    const logoUrl = 'https://sgevopyvcsclkasvekah.supabase.co/storage/v1/object/public/brand-assets/logos/med-q.png';
    expect(findOrphans([sb('logos/med-q.png')], { ...empty, logoUrls: [logoUrl] })).toEqual([]);
  });

  it('flags a supabase file with no referrer', () => {
    expect(findOrphans([sb('assets/junk.pdf')], empty)).toHaveLength(1);
  });
});
