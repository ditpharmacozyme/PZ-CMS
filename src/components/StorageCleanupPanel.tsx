import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBrands } from '../context/BrandsContext';
import { useConfirm } from './ui/ConfirmDialog';
import { cascadeFileDelete, type FileRef, type CleanupRecords } from '../utils/fileCleanup';
import { findOrphans, type ManagedFile } from '../utils/orphanScan';

interface Props {
  records: CleanupRecords;
  /** True once the first Supabase fetch for posts/templates/assets/research
   *  has resolved. Until then `records` is just localStorage and every
   *  managed file would look like an orphan. */
  recordsLoaded: boolean;
}

interface ListResult {
  files: ManagedFile[];
  error: string | null;
}

async function proxyAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function listDriveFiles(): Promise<ListResult> {
  try {
    const res = await fetch('/api/appscript/proxy', {
      method: 'POST',
      headers: await proxyAuthHeaders(),
      body: JSON.stringify({ payload: { action: 'listManagedFiles' } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { files: [], error: body?.message || `Drive listing failed (HTTP ${res.status}).` };
    }
    if (body?.data?.status === 'error' || body?.error) {
      return { files: [], error: body?.data?.error || body?.error || 'Drive listing returned an error.' };
    }
    const files: Array<{ id: string; name: string; folder: string; createdMs: number; sizeBytes: number }> =
      body?.data?.files ?? [];
    return {
      files: files.map((f) => ({
        ref: { backend: 'drive', fileId: f.id } as FileRef,
        name: f.name, location: f.folder, createdMs: f.createdMs, sizeBytes: f.sizeBytes,
      })),
      error: null,
    };
  } catch (e) {
    return { files: [], error: e instanceof Error ? e.message : 'Drive listing failed.' };
  }
}

async function listBucketFiles(): Promise<ListResult> {
  if (!supabase) return { files: [], error: null };
  const out: ManagedFile[] = [];
  for (const folder of ['assets', 'logos']) {
    let offset = 0;
    // paginate 100 at a time
    for (;;) {
      const { data, error } = await supabase.storage.from('brand-assets').list(folder, { limit: 100, offset });
      if (error) {
        return { files: out, error: `Supabase Storage listing failed: ${error.message}` };
      }
      if (!data || data.length === 0) break;
      for (const item of data) {
        if (item.id === null) continue; // sub-folder placeholder
        out.push({
          ref: { backend: 'supabase', path: `${folder}/${item.name}` },
          name: item.name,
          location: `brand-assets/${folder}`,
          createdMs: item.created_at ? Date.parse(item.created_at) : undefined,
          sizeBytes: (item.metadata as { size?: number } | null)?.size,
        });
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  return { files: out, error: null };
}

export const StorageCleanupPanel: React.FC<Props> = ({ records, recordsLoaded }) => {
  const { brands } = useBrands();
  const confirm = useConfirm();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<number | null>(null);
  const [orphans, setOrphans] = useState<ManagedFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const keyOf = (f: ManagedFile) => (f.ref.backend === 'drive' ? `d:${f.ref.fileId}` : `s:${f.ref.path}`);
  const listingFailed = driveError !== null || bucketError !== null;

  const scan = async () => {
    if (!recordsLoaded) return;
    setScanning(true);
    setError(null); setDriveError(null); setBucketError(null); setSummary(null);
    setSelected(new Set()); setFailedKeys(new Set());
    try {
      const [drive, bucket] = await Promise.all([listDriveFiles(), listBucketFiles()]);
      setDriveError(drive.error);
      setBucketError(bucket.error);
      const all = [...drive.files, ...bucket.files];
      const logoUrls = Object.values(brands).map((b) => b.logoUrl).filter((u): u is string => Boolean(u));
      const found = findOrphans(all, { ...records, logoUrls });
      setScanned(all.length);
      setOrphans(found);
      // Deliberately NOT pre-selected — the admin ticks rows on purpose.
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(orphans.map(keyOf)) : new Set());
  };

  const removeSelected = async () => {
    if (listingFailed) return;
    const targets = orphans.filter((f) => selected.has(keyOf(f)));
    if (targets.length === 0) return;

    const driveCount = targets.filter((f) => f.ref.backend === 'drive').length;
    const sbCount = targets.length - driveCount;
    const ok = await confirm({
      title: `Delete ${targets.length} file${targets.length === 1 ? '' : 's'}?`,
      body:
        `${driveCount} Drive file${driveCount === 1 ? '' : 's'} ${driveCount === 1 ? 'goes' : 'go'} to Trash (recoverable ~30 days). ` +
        `${sbCount} Supabase Storage file${sbCount === 1 ? ' is' : 's are'} deleted permanently.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    setDeleting(true);
    setSummary(null);
    const succeeded = new Set<string>();
    const failed = new Set<string>();
    for (const f of targets) {
      const done = await cascadeFileDelete(f.ref);
      (done ? succeeded : failed).add(keyOf(f));
    }
    // Keep the failed rows (with a marker); drop the ones that actually went.
    setOrphans((prev) => prev.filter((f) => !succeeded.has(keyOf(f))));
    setSelected(new Set());
    setFailedKeys(failed);
    setDeleting(false);
    setSummary(
      `${succeeded.size} ${succeeded.size === 1 ? 'file' : 'files'} removed` +
        (failed.size ? ` · ${failed.size} failed (queued for retry)` : ''),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display-xl text-base font-bold text-[#1b1c1a]">Storage cleanup</h3>
        <p className="font-body-md text-sm text-[#5f5f5b]">
          Find files in Google Drive and Supabase Storage that no post, template, asset, research item, or brand logo points at any more.
        </p>
      </div>

      <button
        onClick={scan}
        disabled={scanning || !recordsLoaded}
        className="bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
      >
        {scanning ? 'Scanning…' : 'Scan for orphaned files'}
      </button>

      {!recordsLoaded && (
        <p className="font-body-md text-sm text-[#5f5f5b]">Waiting for records to finish loading…</p>
      )}

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {(driveError || bucketError) && (
        <div className="border border-[#f0b429] bg-[#fffbeb] rounded p-3 text-xs text-[#92400e] space-y-1">
          {driveError && <p>{driveError}</p>}
          {bucketError && <p>{bucketError}</p>}
          <p className="font-bold">Orphan results may be incomplete — deletion is disabled until the next clean scan.</p>
        </div>
      )}

      {scanned !== null && !scanning && (
        <p className="font-body-md text-sm text-[#5f5f5b]">
          {scanned} file{scanned === 1 ? '' : 's'} scanned · {orphans.length} orphaned
        </p>
      )}

      {summary && <p className="font-body-md text-sm font-bold text-[#1b1c1a]">{summary}</p>}

      {orphans.length > 0 && (
        <>
          <div className="border border-[#e9e9e7] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f4f4f3] text-[#5f5f5b]">
                <tr>
                  <th className="w-8 p-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={selected.size === orphans.length && orphans.length > 0}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="text-left p-2 font-label-caps text-[10px]">Name</th>
                  <th className="text-left p-2 font-label-caps text-[10px]">Location</th>
                  <th className="text-left p-2 font-label-caps text-[10px]">Backend</th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((f) => {
                  const k = keyOf(f);
                  return (
                    <tr key={k} className="border-t border-[#e9e9e7]">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(k)}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(k); else next.delete(k);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="p-2 text-[#1b1c1a]">
                        {f.name}
                        {failedKeys.has(k) && (
                          <span className="ml-2 text-[11px] font-bold text-[#dc2626]">✗ failed — will retry</span>
                        )}
                      </td>
                      <td className="p-2 text-[#5f5f5b]">{f.location}</td>
                      <td className="p-2 text-[#5f5f5b]">{f.ref.backend === 'drive' ? 'Drive' : 'Supabase'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={removeSelected}
            disabled={deleting || selected.size === 0 || listingFailed}
            className="bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
          >
            {deleting ? 'Removing…' : `Move ${selected.size} to Trash / remove`}
          </button>
          <p className="font-body-md text-xs text-[#5f5f5b]">
            Drive files go to Trash (recoverable ~30 days); Supabase files are removed permanently.
          </p>
        </>
      )}
    </div>
  );
};
