import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText, copyImage } from './clipboard';

describe('copyText', () => {
  it('writes to navigator.clipboard and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('https://example.com/x.png')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/x.png');
    vi.unstubAllGlobals();
  });

  it('returns false when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('x')).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('copyImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches the image and writes it to the clipboard as image data', async () => {
    const blob = new Blob(['fake-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', function ClipboardItem(items: unknown) { return items; });
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } });

    await expect(copyImage('https://example.com/x.png')).resolves.toBe('image');
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('re-encodes a non-PNG image (e.g. JPEG) to PNG before writing, since Chrome only accepts image/png', async () => {
    const jpegBlob = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });
    const pngBlob = new Blob(['fake-png-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(jpegBlob) }));
    vi.stubGlobal('ClipboardItem', function ClipboardItem(items: Record<string, Blob>) { return items; });

    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(pngBlob);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10 }));
    vi.stubGlobal(
      'OffscreenCanvas',
      function OffscreenCanvas(this: any) {
        this.getContext = () => ({ drawImage });
        this.convertToBlob = convertToBlob;
      },
    );

    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } });

    await expect(copyImage('https://example.com/x.jpg')).resolves.toBe('image');
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/png' });
    expect(write).toHaveBeenCalledWith([{ 'image/png': pngBlob }]);
  });

  it('falls back to copying the link when ClipboardItem is unsupported', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    // No ClipboardItem global in this environment.

    await expect(copyImage('https://example.com/x.png')).resolves.toBe('link');
    expect(writeText).toHaveBeenCalledWith('https://example.com/x.png');
  });

  it('falls back to the link when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.stubGlobal('ClipboardItem', vi.fn());
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn(), writeText } });

    await expect(copyImage('https://example.com/x.png')).resolves.toBe('link');
  });

  it('returns failed when neither image nor link copy succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('navigator', {});

    await expect(copyImage('https://example.com/x.png')).resolves.toBe('failed');
  });
});
