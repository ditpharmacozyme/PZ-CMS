import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBrands } from '../context/BrandsContext';
import { cascadeFileDelete, type FileRef, type CleanupRecords } from '../utils/fileCleanup';
import { findOrphans, type ManagedFile } from '../utils/orphanScan';

interface Props {
  records: CleanupRecords;
}

async function proxyAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function listDriveFiles(): Promise<ManagedFile[]> {
  const res = await fetch('/api/appscript/proxy', {
    method: 'POST',
    headers: await proxyAuthHeaders(),
    body: JSON.stringify({ payload: { action: 'listManagedFiles' } }),
  });
  const body = await res.json().catch(() => ({}));
  const files: Array<{ id: string; name: string; folder: string; createdMs: number; sizeBytes: number }> = body?.data?.files ?? [];
  return files.map((f) => ({
    ref: { backend: 'drive', fileId: f.id } as FileRef,
    name: f.name, location: f.folder, createdMs: f.createdMs, sizeBytes: f.sizeBytes,
  }));
}

async function listBucketFiles(): Promise<ManagedFile[]> {
  if (!supabase) return [];
  const out: ManagedFile[] = [];
  for (const folder of ['assets', 'logos']) {
    let offset = 0;
    // paginate 100 at a time
    for (;;) {
      const { data, error } = await supabase.storage.from('brand-assets').list(folder, { limit: 100, offset });
      if (error || !data || data.length === 0) break;
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
  return out;
}

export const StorageCleanupPanel: React.FC<Props> = ({ records }) => {
  const { brands } = useBrands();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<number | null>(null);
  const [orphans, setOrphans] = useState<ManagedFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyOf = (f: ManagedFile) => (f.ref.backend === 'drive' ? `d:${f.ref.fileId}` : `s:${f.ref.path}`);

  const scan = async () => {
    setScanning(true); setError(null); setSelected(new Set());
    try {
      const [drive, bucket] = await Promise.all([listDriveFiles(), listBucketFiles()]);
      const all = [...drive, ...bucket];
      const logoUrls = Object.values(brands).map((b) => b.logoUrl).filter((u): u is string => Boolean(u));
      const found = findOrphans(all, records, logoUrls);
      setScanned(all.length);
      setOrphans(found);
      setSelected(new Set(found.map(keyOf)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const removeSelected = async () => {
    setDeleting(true);
    const targets = orphans.filter((f) => selected.has(keyOf(f)));
    for (const f of targets) await cascadeFileDelete(f.ref);
    setOrphans((prev) => prev.filter((f) => !selected.has(keyOf(f))));
    setSelected(new Set());
    setDeleting(false);
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
        disabled={scanning}
        className="bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
      >
        {scanning ? 'Scanning…' : 'Scan for orphaned files'}
      </button>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {scanned !== null && !scanning && (
        <p className="font-body-md text-sm text-[#5f5f5b]">
          {scanned} file{scanned === 1 ? '' : 's'} scanned · {orphans.length} orphaned
        </p>
      )}

      {orphans.length > 0 && (
        <>
          <div className="border border-[#e9e9e7] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f4f4f3] text-[#5f5f5b]">
                <tr>
                  <th className="w-8 p-2"></th>
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
                      <td className="p-2 text-[#1b1c1a]">{f.name}</td>
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
            disabled={deleting || selected.size === 0}
            className="bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-60 text-white font-bold text-sm px-4 py-2 rounded transition-colors"
          >
            {deleting ? 'Removing…' : `Move ${selected.size} to Trash / remove`}
          </button>
          <p className="font-body-md text-xs text-[#5f5f5b]">
            Drive files go to Trash (recoverable ~30 days); Supabase files are removed immediately.
          </p>
        </>
      )}
    </div>
  );
};
