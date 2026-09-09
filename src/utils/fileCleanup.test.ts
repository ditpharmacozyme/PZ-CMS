import { describe, it, expect, vi } from 'vitest';
import { identifyFile, fileRefsEqual } from './fileCleanup';

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
