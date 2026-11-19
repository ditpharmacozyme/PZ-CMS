import type { AdFile } from '../types';
import { supabase } from '../lib/supabase';

/**
 * Client for the Ads Library Apps Script actions, called through the
 * authenticated /api/appscript/proxy (same pattern as fileCleanup.ts).
 * Every helper throws Error(message) when the script reports status:'error'
 * or the HTTP call fails.
 */
async function call(payload: Record<string, unknown>): Promise<Record<string, any>> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const res = await fetch('/api/appscript/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error || body?.data?.error || `Request failed (${res.status})`);
  }
  const data = body?.data ?? {};
  if (data.status === 'error') {
    throw new Error(data.error || 'Apps Script request failed');
  }
  // A non-JSON script reply (e.g. a Google sign-in page) is wrapped by the
  // proxy as { data: { text } } with HTTP 200 — never treat that as success.
  if (data.status !== 'success') {
    throw new Error(data.error || UNEXPECTED_REPLY);
  }
  return data;
}

const UNEXPECTED_REPLY =
  'Google Apps Script returned an unexpected reply — redeploy the script / re-authorize it in Integrations';

function requireString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error(UNEXPECTED_REPLY);
  return value;
}

export async function ensureFolder(name: string, parentId?: string): Promise<string> {
  const data = await call({ action: 'adsEnsureFolder', name, ...(parentId ? { parentId } : {}) });
  return requireString(data.folderId);
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  await call({ action: 'adsRenameFolder', folderId, name });
}

export async function moveFolder(folderId: string, parentId?: string): Promise<void> {
  await call({ action: 'adsMoveFolder', folderId, ...(parentId ? { parentId } : {}) });
}

export async function moveFile(fileId: string, folderId: string): Promise<void> {
  await call({ action: 'adsMoveFile', fileId, folderId });
}

export async function createUploadSession(args: { folderId: string; fileName: string; mimeType: string }): Promise<string> {
  const data = await call({ action: 'adsCreateUploadSession', ...args, origin: window.location.origin });
  return requireString(data.sessionUrl);
}

export async function finalizeFile(args: { folderId: string; fileName: string; fileId?: string }): Promise<AdFile> {
  const data = await call({ action: 'adsFinalizeFile', ...args });
  return {
    driveFileId: requireString(data.fileId),
    name: requireString(data.name),
    mimeType: requireString(data.mimeType),
    sizeBytes: Number(data.sizeBytes) || 0,
  };
}

export async function trashFile(fileId: string): Promise<void> {
  await call({ action: 'adsTrashFile', fileId });
}

export async function trashFolder(folderId: string): Promise<void> {
  await call({ action: 'adsTrashFolder', folderId });
}
