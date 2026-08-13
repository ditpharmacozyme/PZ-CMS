/**
 * Single image upload path for the whole app.
 *
 * Files go to Google Drive through the Apps Script web app, and only the
 * returned URL is ever stored on a post. Base64 data URLs are never persisted —
 * a few phone photos would exceed the localStorage quota and silently break
 * saving, and they bloat every database row they land in.
 *
 * The Apps Script web app URL is server-side config (APPS_SCRIPT_URL in
 * Vercel), not something each teammate pastes into their own browser --
 * see api/appscript/proxy.ts.
 */

import { supabase } from '../lib/supabase';

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

export interface UploadResult {
  url: string;
  fileName: string;
}

export class UploadNotConfiguredError extends Error {
  constructor(detail?: string) {
    super(detail || 'Google Drive is not connected yet. An Owner needs to set APPS_SCRIPT_URL in Vercel.');
    this.name = 'UploadNotConfiguredError';
  }
}

/** True when the server has an Apps Script endpoint configured. */
export async function isUploadConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    const body = await res.json();
    return Boolean(body?.appsScriptConfigured);
  } catch {
    return false;
  }
}

/** Read a File as a base64 data URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale so the longest edge is at most MAX_EDGE_PX. Returns the original
 * data URL untouched if the image is already small enough, or if anything about
 * the canvas step fails — a slightly large upload beats a failed one.
 */
async function compress(dataUrl: string, mimeType: string): Promise<string> {
  if (!mimeType.startsWith('image/') || mimeType === 'image/gif' || mimeType === 'image/svg+xml') {
    return dataUrl;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = dataUrl;
    });

    const longestEdge = Math.max(img.width, img.height);
    if (longestEdge <= MAX_EDGE_PX) return dataUrl;

    const scale = MAX_EDGE_PX / longestEdge;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // PNG is preserved so logos keep their transparency; everything else
    // becomes JPEG, which is far smaller for photographs.
    return mimeType === 'image/png'
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return dataUrl;
  }
}

/**
 * Upload an image and return its Drive URL.
 * Throws UploadNotConfiguredError when the server has no Apps Script URL
 * configured — callers should surface that message rather than falling
 * back to a data URL.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" is not an image.`);
  }
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('No active session.');

  const raw = await readAsDataUrl(file);
  const base64Data = await compress(raw, file.type);

  const response = await fetch('/api/appscript/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      payload: { action: 'upload', fileName: file.name, mimeType: file.type, base64Data }
    })
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 400 && /no google apps script url/i.test(body?.message || '')) {
      throw new UploadNotConfiguredError(body.message);
    }
    throw new Error(body?.message || `Upload failed (HTTP ${response.status}).`);
  }

  const url: string | undefined = body?.data?.url;

  if (!url) {
    const detail = body?.data?.error || body?.message || 'Google Drive did not return a file URL.';
    throw new Error(`Upload failed: ${detail}`);
  }

  return { url, fileName: file.name };
}
