import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'x' }, error: null });
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/x' } });
  return { supabase: { storage: { from: () => ({ upload, getPublicUrl }) } } };
});

import { uploadAsset, humanFileSize, AssetUploadError, ASSET_UPLOAD_MAX_BYTES } from './uploadAsset';

function fakeFile(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('humanFileSize', () => {
  it('formats bytes as MB with one decimal', () => {
    expect(humanFileSize(2_621_440)).toBe('2.5 MB');
  });
  it('uses KB below a megabyte', () => {
    expect(humanFileSize(4096)).toBe('4.0 KB');
  });
});

describe('uploadAsset', () => {
  it('rejects an unsupported type', async () => {
    await expect(uploadAsset(fakeFile('a.exe', 'application/x-msdownload', 10), 'assets'))
      .rejects.toBeInstanceOf(AssetUploadError);
  });

  it('rejects a file over the size cap', async () => {
    await expect(uploadAsset(fakeFile('big.pdf', 'application/pdf', ASSET_UPLOAD_MAX_BYTES + 1), 'assets'))
      .rejects.toBeInstanceOf(AssetUploadError);
  });

  it('returns url, storagePath, size and contentType on success', async () => {
    const res = await uploadAsset(fakeFile('Logo Final.png', 'image/png', 1024), 'logos');
    expect(res.url).toBe('https://cdn/x');
    expect(res.storagePath).toMatch(/^logos\/[0-9a-f-]+-logo-final\.png$/);
    expect(res.size).toBe('1.0 KB');
    expect(res.contentType).toBe('image/png');
  });
});
