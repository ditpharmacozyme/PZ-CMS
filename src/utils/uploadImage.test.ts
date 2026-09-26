import { describe, it, expect, vi } from 'vitest';
import { uploadImages } from './uploadImage';

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('uploadImages', () => {
  it('uploads sequentially, in order, reporting progress before each call', async () => {
    const calls: string[] = [];
    const progress: Array<[number, number]> = [];
    const uploadFn = vi.fn(async (file: File) => {
      calls.push(file.name);
      return { url: `https://drive/${file.name}`, fileName: file.name };
    });

    const files = [makeFile('a.png'), makeFile('b.png'), makeFile('c.png')];
    const result = await uploadImages(files, (done, total) => progress.push([done, total]), uploadFn);

    expect(calls).toEqual(['a.png', 'b.png', 'c.png']);
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(result.succeeded.map((r) => r.url)).toEqual(['https://drive/a.png', 'https://drive/b.png', 'https://drive/c.png']);
    expect(result.failed).toEqual([]);
  });

  it('keeps already-succeeded uploads and reports a failure without aborting the rest', async () => {
    const uploadFn = vi.fn(async (file: File) => {
      if (file.name === 'bad.png') throw new Error('Upload failed: Google Drive did not return a file URL.');
      return { url: `https://drive/${file.name}`, fileName: file.name };
    });

    const files = [makeFile('a.png'), makeFile('bad.png'), makeFile('c.png')];
    const result = await uploadImages(files, undefined, uploadFn);

    expect(result.succeeded.map((r) => r.fileName)).toEqual(['a.png', 'c.png']);
    expect(result.failed).toEqual([{ file: files[1], error: 'Upload failed: Google Drive did not return a file URL.' }]);
  });

  it('resolves with two empty arrays for an empty file list, calling onProgress and uploadFn zero times', async () => {
    const onProgress = vi.fn();
    const uploadFn = vi.fn();
    const result = await uploadImages([], onProgress, uploadFn);
    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(onProgress).not.toHaveBeenCalled();
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it('defaults uploadFn to the real uploadImage export when not supplied', async () => {
    // Confirms the default-parameter wiring only -- not a network test. A
    // non-image file rejects inside the real uploadImage() before any
    // network/FileReader call, so this exercises the "no uploadFn passed"
    // path safely.
    const result = await uploadImages([new File(['x'], 'a.txt', { type: 'text/plain' })]);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([{ file: expect.any(File), error: '"a.txt" is not an image.' }]);
  });
});
