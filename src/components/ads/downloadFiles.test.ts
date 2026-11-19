import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AdFile } from '../../types';
import { downloadFiles, fileLink, LARGE_FILE_BYTES } from './downloadFiles';

const MB = 1024 * 1024;
const file = (id: string, sizeBytes: number): AdFile => ({ driveFileId: id, name: `${id}.mp4`, mimeType: 'video/mp4', sizeBytes });

interface Clicked { href: string; target: string; rel: string; download: string | null }
let clicked: Clicked[];

beforeEach(() => {
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, target: this.target, rel: this.rel, download: this.getAttribute('download') });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('fileLink', () => {
  it('uses the direct download for small files and the Drive page in a new tab for large ones', () => {
    expect(LARGE_FILE_BYTES).toBe(90 * MB);
    expect(fileLink(file('small', 5 * MB))).toEqual({
      href: 'https://drive.google.com/uc?export=download&id=small', large: false,
    });
    expect(fileLink(file('big', 200 * MB))).toEqual({
      href: 'https://drive.google.com/file/d/big/view', large: true,
    });
  });
});

describe('downloadFiles', () => {
  it('opens a large file in a new tab instead of leaving the page', async () => {
    await downloadFiles([file('big', 200 * MB)], 0);
    expect(clicked).toEqual([
      { href: 'https://drive.google.com/file/d/big/view', target: '_blank', rel: 'noopener noreferrer', download: null },
    ]);
  });

  it('a single small file also downloads in a new tab, so the page is never left', async () => {
    await downloadFiles([file('small', 1 * MB)], 0);
    expect(clicked).toEqual([
      { href: 'https://drive.google.com/uc?export=download&id=small', target: '_blank', rel: 'noopener noreferrer', download: 'small.mp4' },
    ]);
  });

  it('keeps the order and spacing for a mixed queue; small files in a batch download in place', async () => {
    vi.useFakeTimers();
    try {
      const run = downloadFiles([file('a', 1 * MB), file('b', 120 * MB), file('c', 2 * MB)], 400);
      expect(clicked.map((c) => c.href)).toEqual(['https://drive.google.com/uc?export=download&id=a']);
      await vi.advanceTimersByTimeAsync(400);
      expect(clicked).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(400);
      await run;
      expect(clicked.map((c) => c.href)).toEqual([
        'https://drive.google.com/uc?export=download&id=a',
        'https://drive.google.com/file/d/b/view',
        'https://drive.google.com/uc?export=download&id=c',
      ]);
      expect(clicked.map((c) => c.target)).toEqual(['', '_blank', '']);
    } finally {
      vi.useRealTimers();
    }
  });
});
