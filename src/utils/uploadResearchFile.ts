/**
 * Upload path for Research & Plans files (CSV, XLSX, MD, DOCX, PDF) -- any
 * type, unlike uploadImage.ts which is image-only and downscales/compresses.
 * Files go to Google Drive through the same Apps Script web app, under
 * "Research & Plans / {brand} / {type}" (see src/data/googleAppsScript.ts's
 * uploadResearchFile action), and only the resulting fileId + webViewLink
 * are ever stored -- the file itself is never persisted as base64.
 */

import { supabase } from '../lib/supabase';
import { UploadNotConfiguredError } from './uploadImage';

// Vercel caps serverless request bodies at 4.5MB; base64 inflates by ~33%,
// so the real ceiling is closer to 3MB. Enforced client-side for a clear
// error instead of a generic 413 from the platform.
export const MAX_RESEARCH_FILE_BYTES = 3 * 1024 * 1024;

export interface ResearchUploadResult {
  fileId: string;
  webViewLink: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** Upload a research/plans file and return its Drive fileId + webViewLink. */
export async function uploadResearchFile(file: File, brand: string, type: string): Promise<ResearchUploadResult> {
  if (file.size > MAX_RESEARCH_FILE_BYTES) {
    throw new Error(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 3MB.`);
  }
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('No active session.');

  const base64Data = await readAsDataUrl(file);

  const response = await fetch('/api/appscript/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      payload: {
        action: 'uploadResearchFile',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data,
        brand,
        type
      }
    })
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 400 && /no google apps script url/i.test(body?.message || '')) {
      throw new UploadNotConfiguredError(body.message);
    }
    throw new Error(body?.message || `Upload failed (HTTP ${response.status}).`);
  }

  const fileId: string | undefined = body?.data?.fileId;
  const webViewLink: string | undefined = body?.data?.webViewLink;

  if (!fileId || !webViewLink) {
    const detail = body?.data?.error || body?.message || 'Google Drive did not return a file id/link.';
    throw new Error(`Upload failed: ${detail}`);
  }

  return { fileId, webViewLink };
}
