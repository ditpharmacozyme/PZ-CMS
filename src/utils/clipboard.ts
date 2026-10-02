/** Copy text to the clipboard. Resolves true on success, false otherwise. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chrome/Edge's Clipboard API only accepts `image/png` for an image write —
 * writing a `ClipboardItem` with `image/jpeg` (the common case for photos)
 * throws `NotAllowedError: Type image/jpeg not supported on write`. Most of
 * our images are JPEGs served from Google Drive, so this re-encodes any
 * non-PNG blob to PNG via an offscreen canvas before it reaches the
 * clipboard.
 */
async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  if (!pngBlob) throw new Error('PNG conversion failed');
  return pngBlob;
}

/**
 * Copy the actual image at `url` to the clipboard as image data, so pasting
 * elsewhere (chat apps, docs, design tools) pastes the image itself rather
 * than a link. Falls back to copying the URL as text when the browser
 * doesn't support writing images to the clipboard (or the fetch/convert/
 * write fails), so the caller can still tell the user *something* was
 * copied.
 */
export async function copyImage(url: string): Promise<'image' | 'link' | 'failed'> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator?.clipboard?.write) {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const pngBlob = await toPngBlob(blob);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        return 'image';
      }
    }
  } catch {
    // fall through to the link fallback below
  }
  return (await copyText(url)) ? 'link' : 'failed';
}
