import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ensureFolder, renameFolder, moveFolder, moveFile,
  createUploadSession, finalizeFile, trashFile, trashFolder,
} from './adsDrive';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) },
  },
}));

const fetchMock = vi.fn();

function ok(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });
}

function lastBody() {
  return JSON.parse(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('adsDrive', () => {
  it('ensureFolder posts the action with a Bearer header and returns folderId', async () => {
    fetchMock.mockReturnValue(ok({ status: 'success', folderId: 'f1' }));
    const id = await ensureFolder('PPC Batch 3', 'p1');
    expect(id).toBe('f1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/appscript/proxy');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(lastBody()).toEqual({ payload: { action: 'adsEnsureFolder', name: 'PPC Batch 3', parentId: 'p1' } });
  });

  it('rejects with the script error message', async () => {
    fetchMock.mockReturnValue(ok({ status: 'error', error: 'boom' }));
    await expect(ensureFolder('x')).rejects.toThrow('boom');
  });

  it('rejects on a non-ok HTTP response', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'bad gateway' }) }));
    await expect(trashFile('a')).rejects.toThrow('bad gateway');
  });

  it('rename/move/trash send the right payloads', async () => {
    fetchMock.mockReturnValue(ok({ status: 'success' }));
    await renameFolder('f', 'New');
    expect(lastBody().payload).toEqual({ action: 'adsRenameFolder', folderId: 'f', name: 'New' });
    await moveFolder('f', 'p');
    expect(lastBody().payload).toEqual({ action: 'adsMoveFolder', folderId: 'f', parentId: 'p' });
    await moveFile('x', 'f');
    expect(lastBody().payload).toEqual({ action: 'adsMoveFile', fileId: 'x', folderId: 'f' });
    await trashFile('x');
    expect(lastBody().payload).toEqual({ action: 'adsTrashFile', fileId: 'x' });
    await trashFolder('f');
    expect(lastBody().payload).toEqual({ action: 'adsTrashFolder', folderId: 'f' });
  });

  it('createUploadSession adds origin and returns sessionUrl', async () => {
    fetchMock.mockReturnValue(ok({ status: 'success', sessionUrl: 'https://upload/x' }));
    const url = await createUploadSession({ folderId: 'f', fileName: 'a.png', mimeType: 'image/png' });
    expect(url).toBe('https://upload/x');
    expect(lastBody().payload).toEqual({
      action: 'adsCreateUploadSession', folderId: 'f', fileName: 'a.png', mimeType: 'image/png',
      origin: window.location.origin,
    });
  });

  it('finalizeFile maps the response to an AdFile', async () => {
    fetchMock.mockReturnValue(ok({ status: 'success', fileId: 'd1', name: 'a.png', mimeType: 'image/png', sizeBytes: 12 }));
    const f = await finalizeFile({ folderId: 'f', fileName: 'a.png', fileId: 'd1' });
    expect(f).toEqual({ driveFileId: 'd1', name: 'a.png', mimeType: 'image/png', sizeBytes: 12 });
    expect(lastBody().payload).toEqual({ action: 'adsFinalizeFile', folderId: 'f', fileName: 'a.png', fileId: 'd1' });
  });
});
