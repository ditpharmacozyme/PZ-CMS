import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadToDrive } from './adsUpload';
import { createUploadSession, finalizeFile } from './adsDrive';

vi.mock('./adsDrive', () => ({
  createUploadSession: vi.fn(),
  finalizeFile: vi.fn(),
}));

interface FakeOpts { status?: number; body?: string; throwOnBody?: boolean; fail?: 'error' | 'abort' | 'timeout'; progress?: [number, number] }
let opts: FakeOpts = {};
let instances: FakeXHR[] = [];

class FakeXHR {
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  status = 0;
  method = ''; url = ''; headers: Record<string, string> = {}; sent: unknown = null;
  constructor() { instances.push(this); }
  open(m: string, u: string) { this.method = m; this.url = u; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  get responseText(): string {
    if (opts.throwOnBody) throw new Error('blocked');
    return opts.body ?? '';
  }
  send(body: unknown) {
    this.sent = body;
    queueMicrotask(() => {
      if (opts.progress) this.upload.onprogress?.({ lengthComputable: true, loaded: opts.progress[0], total: opts.progress[1] });
      if (opts.fail === 'error') return this.onerror?.();
      if (opts.fail === 'abort') return this.onabort?.();
      if (opts.fail === 'timeout') return this.ontimeout?.();
      this.status = opts.status ?? 200;
      this.onload?.();
    });
  }
}

const MSG = 'Upload failed — check your connection and try again';
const file = new File(['hello'], 'ad.png', { type: 'image/png' });
const adFile = { id: 'f1' } as never;

beforeEach(() => {
  opts = {}; instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  vi.mocked(createUploadSession).mockReset().mockResolvedValue('https://session/url');
  vi.mocked(finalizeFile).mockReset().mockResolvedValue(adFile);
});
afterEach(() => vi.unstubAllGlobals());

describe('uploadToDrive', () => {
  it('creates session from name/type, PUTs with content-type, finalizes with readable id', async () => {
    opts = { body: JSON.stringify({ id: 'f1' }) };
    const r = await uploadToDrive(file, 'folder1');
    expect(createUploadSession).toHaveBeenCalledWith({ folderId: 'folder1', fileName: 'ad.png', mimeType: 'image/png' });
    expect(instances[0].method).toBe('PUT');
    expect(instances[0].url).toBe('https://session/url');
    expect(instances[0].headers['Content-Type']).toBe('image/png');
    expect(instances[0].sent).toBe(file);
    expect(finalizeFile).toHaveBeenCalledWith({ folderId: 'folder1', fileName: 'ad.png', fileId: 'f1' });
    expect(r).toBe(adFile);
  });

  it('falls back to octet-stream when type empty', async () => {
    const f = new File(['x'], 'raw.bin');
    await uploadToDrive(f, 'folder1');
    expect(createUploadSession).toHaveBeenCalledWith({ folderId: 'folder1', fileName: 'raw.bin', mimeType: 'application/octet-stream' });
    expect(instances[0].headers['Content-Type']).toBe('application/octet-stream');
  });

  it('finalizes without fileId when body unreadable', async () => {
    opts = { body: '' };
    await uploadToDrive(file, 'folder1');
    expect(finalizeFile).toHaveBeenCalledWith({ folderId: 'folder1', fileName: 'ad.png' });
  });

  it('finalizes without fileId when responseText throws', async () => {
    opts = { throwOnBody: true };
    await uploadToDrive(file, 'folder1');
    expect(finalizeFile).toHaveBeenCalledWith({ folderId: 'folder1', fileName: 'ad.png' });
  });

  it('rejects on HTTP 500 without finalizing', async () => {
    opts = { status: 500 };
    await expect(uploadToDrive(file, 'folder1')).rejects.toThrow(MSG);
    expect(finalizeFile).not.toHaveBeenCalled();
  });

  it.each(['error', 'abort', 'timeout'] as const)('rejects on %s without finalizing', async (fail) => {
    opts = { fail };
    await expect(uploadToDrive(file, 'folder1')).rejects.toThrow(MSG);
    expect(finalizeFile).not.toHaveBeenCalled();
  });

  it('reports progress fraction', async () => {
    opts = { progress: [50, 100] };
    const onProgress = vi.fn();
    await uploadToDrive(file, 'folder1', onProgress);
    expect(onProgress).toHaveBeenCalledWith(0.5);
  });

  it('does not dedupe same file name', async () => {
    const a = await uploadToDrive(file, 'folder1');
    const b = await uploadToDrive(file, 'folder1');
    expect(a).toBe(adFile);
    expect(b).toBe(adFile);
    expect(finalizeFile).toHaveBeenCalledTimes(2);
  });
});
