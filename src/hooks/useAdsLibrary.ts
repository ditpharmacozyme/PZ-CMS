import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdAudience, AdCreative, AdFile, AdKind, AdProgram, AdSet, AdShareLink } from '../types';
import {
  fetchAdsSnapshot,
  fetchAdAudiences,
  fetchShareLinks,
  upsertRemoteProgram,
  upsertRemoteSet,
  upsertRemoteCreative,
  upsertRemoteShareLink,
  upsertRemoteAudience,
  deleteRemoteProgram,
  deleteRemoteSet,
  deleteRemoteCreative,
  deleteRemoteAudience,
  subscribeAdsChanges,
} from '../utils/adsStorage';
import { ensureFolder, renameFolder, moveFolder, moveFile, trashFile, trashFolder } from '../utils/adsDrive';
import { detectFormat } from '../utils/adsModel';

export const UNSORTED_ID = 'ads-unsorted';
const UNSORTED_ERROR = "Unsorted can't be changed";

export interface DeleteResult {
  /** false -> DB rows were removed but a Drive operation failed. */
  driveOk: boolean;
}
export type DeleteMode = 'delete-all' | 'move-to-unsorted';

interface Data {
  programs: AdProgram[];
  sets: AdSet[];
  creatives: AdCreative[];
  audiences: AdAudience[];
  shareLinks: AdShareLink[];
}

/** Realtime events arrive in bursts (one per row written); refresh once they settle. */
export const REFRESH_DEBOUNCE_MS = 300;

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date().toISOString();

export function useAdsLibrary(activeUserName: string) {
  const [data, setData] = useState<Data>({ programs: [], sets: [], creatives: [], audiences: [], shareLinks: [] });
  const [loading, setLoading] = useState(true);
  // Mutations read the latest data synchronously through the ref.
  const ref = useRef<Data>(data);
  const folderJobs = useRef<Map<string, Promise<string>>>(new Map());
  // Stale-refresh guards: a refresh only applies if no newer refresh started and
  // no local write landed while it was in flight.
  const refreshSeq = useRef(0);
  const writeSeq = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((patch: Partial<Data>) => {
    ref.current = { ...ref.current, ...patch };
    setData(ref.current);
  }, []);

  /** Local mutation result: applied now, and invalidates any refresh in flight. */
  const commit = useCallback((patch: Partial<Data>) => {
    writeSeq.current++;
    apply(patch);
  }, [apply]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void refreshRef.current();
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  const refresh = useCallback(async () => {
    const mine = ++refreshSeq.current;
    const writesAtStart = writeSeq.current;
    const [snap, audiences, links] = await Promise.all([
      fetchAdsSnapshot().catch(() => null),
      fetchAdAudiences().catch(() => null),
      fetchShareLinks().catch(() => null),
    ]);
    if (mine !== refreshSeq.current) return; // a newer refresh will apply
    if (writeSeq.current !== writesAtStart) {
      // Fetched before a local write landed: it may be missing it. Fetch again.
      scheduleRefresh();
      return;
    }
    const patch: Partial<Data> = {};
    if (snap) {
      patch.programs = snap.programs;
      patch.sets = snap.sets;
      patch.creatives = snap.creatives;
    }
    if (audiences) patch.audiences = audiences;
    if (links) patch.shareLinks = links;
    apply(patch);
    setLoading(false);
  }, [apply, scheduleRefresh]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    void refresh();
    const unsub = subscribeAdsChanges(scheduleRefresh);
    return () => {
      unsub();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    };
  }, [refresh, scheduleRefresh]);

  const getProgram = (id: string) => ref.current.programs.find((p) => p.id === id);
  const getSet = (id: string) => ref.current.sets.find((s) => s.id === id);
  const getCreative = (id: string) => ref.current.creatives.find((c) => c.id === id);

  const saveProgram = useCallback(
    async (p: AdProgram) => {
      await upsertRemoteProgram(p);
      const exists = ref.current.programs.some((x) => x.id === p.id);
      commit({ programs: exists ? ref.current.programs.map((x) => (x.id === p.id ? p : x)) : [...ref.current.programs, p] });
    },
    [commit]
  );
  const saveSet = useCallback(
    async (s: AdSet) => {
      await upsertRemoteSet(s);
      const exists = ref.current.sets.some((x) => x.id === s.id);
      commit({ sets: exists ? ref.current.sets.map((x) => (x.id === s.id ? s : x)) : [...ref.current.sets, s] });
    },
    [commit]
  );
  const saveCreative = useCallback(
    async (c: AdCreative) => {
      await upsertRemoteCreative(c);
      const exists = ref.current.creatives.some((x) => x.id === c.id);
      commit({ creatives: exists ? ref.current.creatives.map((x) => (x.id === c.id ? c : x)) : [...ref.current.creatives, c] });
    },
    [commit]
  );

  /** Parent folder for an ad set's folder: its program's folder, or undefined (= Ads Library root). */
  const parentFolderFor = (programId: string | null): string | undefined => {
    if (!programId) return undefined;
    return getProgram(programId)?.driveFolderId || undefined;
  };

  const ensureSetFolder = useCallback(
    (setId: string): Promise<string> => {
      const existing = getSet(setId);
      if (!existing) return Promise.reject(new Error('Ad set not found'));
      if (existing.driveFolderId) return Promise.resolve(existing.driveFolderId);
      const inflight = folderJobs.current.get(setId);
      if (inflight) return inflight;
      const job = (async () => {
        const folderId = await (() => { const par = parentFolderFor(existing.programId); return par ? ensureFolder(existing.name, par) : ensureFolder(existing.name); })();
        const latest = getSet(setId) ?? existing;
        await saveSet({ ...latest, driveFolderId: folderId, updatedAt: nowIso() });
        return folderId;
      })().finally(() => {
        folderJobs.current.delete(setId);
      });
      folderJobs.current.set(setId, job);
      return job;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveSet]
  );

  // ---- Programs ----
  const createProgram = useCallback(
    async (input: { name: string; brandId: string; kind: AdKind }): Promise<AdProgram> => {
      const folderId = await ensureFolder(input.name);
      const now = nowIso();
      const program: AdProgram = {
        id: newId('ad-program'),
        name: input.name,
        brandId: input.brandId,
        kind: input.kind,
        driveFolderId: folderId,
        hidden: false,
        createdBy: activeUserName,
        createdAt: now,
        updatedAt: now,
      };
      await saveProgram(program);
      return program;
    },
    [activeUserName, saveProgram]
  );

  const updateProgram = useCallback(
    async (id: string, patch: Partial<Pick<AdProgram, 'name' | 'brandId' | 'kind' | 'hidden'>>): Promise<void> => {
      const p = getProgram(id);
      if (!p) throw new Error('Program not found');
      if (patch.name !== undefined && patch.name !== p.name && p.driveFolderId) {
        await renameFolder(p.driveFolderId, patch.name);
      }
      await saveProgram({ ...p, ...patch, updatedAt: nowIso() });
    },
    [saveProgram]
  );

  // ---- Sets ----
  const createSet = useCallback(
    async (input: { name: string; programId: string | null; audience: string }): Promise<AdSet> => {
      const folderId = await ensureFolder(input.name, parentFolderFor(input.programId));
      const now = nowIso();
      const set: AdSet = {
        id: newId('ad-set'),
        programId: input.programId,
        name: input.name,
        audience: input.audience,
        driveFolderId: folderId,
        hidden: false,
        isSystem: false,
        createdBy: activeUserName,
        createdAt: now,
        updatedAt: now,
      };
      await saveSet(set);
      return set;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeUserName, saveSet]
  );

  const updateSet = useCallback(
    async (id: string, patch: Partial<Pick<AdSet, 'name' | 'audience' | 'hidden'>>): Promise<void> => {
      const s = getSet(id);
      if (!s) throw new Error('Ad set not found');
      if (id === UNSORTED_ID && patch.name !== undefined && patch.name !== s.name) {
        throw new Error(UNSORTED_ERROR);
      }
      if (patch.name !== undefined && patch.name !== s.name && s.driveFolderId) {
        await renameFolder(s.driveFolderId, patch.name);
      }
      await saveSet({ ...s, ...patch, updatedAt: nowIso() });
    },
    [saveSet]
  );

  const moveSet = useCallback(
    async (id: string, programId: string | null): Promise<void> => {
      if (id === UNSORTED_ID) throw new Error(UNSORTED_ERROR);
      const s = getSet(id);
      if (!s) throw new Error('Ad set not found');
      if (s.programId === programId) return;
      let parent: string | undefined;
      if (programId) {
        parent = getProgram(programId)?.driveFolderId;
        if (!parent) throw new Error("Target program has no Drive folder yet; can't move the ad set into it");
      }
      // Drive first (omitted parent = Ads Library root), then the DB row.
      // A set without a folder yet has nothing to move; its folder is created
      // lazily under the new parent by ensureSetFolder.
      const moved = !!s.driveFolderId;
      if (moved) await moveFolder(s.driveFolderId, parent);
      try {
        await saveSet({ ...s, programId, updatedAt: nowIso() });
      } catch (err) {
        if (moved) {
          const back = parentFolderFor(s.programId);
          await moveFolder(s.driveFolderId, back).catch(() => undefined);
        }
        throw err;
      }
    },
    [saveSet]
  );

  // ---- Delete helpers ----
  /** Moves every file of the given creatives to the Unsorted folder and re-parents them. */
  const moveCreativesToUnsorted = useCallback(
    async (creatives: AdCreative[]): Promise<void> => {
      if (!creatives.length) return;
      const folderId = await ensureSetFolder(UNSORTED_ID);
      for (const c of creatives) {
        for (const f of c.files) await moveFile(f.driveFileId, folderId);
      }
      for (const c of creatives) {
        await saveCreative({ ...c, setId: UNSORTED_ID, updatedAt: nowIso() });
      }
    },
    [ensureSetFolder, saveCreative]
  );

  const bestEffortTrashFolder = async (folderId: string): Promise<boolean> => {
    if (!folderId) return true;
    try {
      await trashFolder(folderId);
      return true;
    } catch {
      return false;
    }
  };

  const removeSetRows = useCallback(
    async (setIds: string[], deleteCreatives: boolean) => {
      const idSet = new Set(setIds);
      if (deleteCreatives) {
        const gone = ref.current.creatives.filter((c) => idSet.has(c.setId));
        for (const c of gone) await deleteRemoteCreative(c.id);
        commit({ creatives: ref.current.creatives.filter((c) => !idSet.has(c.setId)) });
      }
      for (const id of setIds) await deleteRemoteSet(id);
      commit({ sets: ref.current.sets.filter((s) => !idSet.has(s.id)) });
    },
    [commit]
  );

  const deleteProgram = useCallback(
    async (id: string, mode: DeleteMode): Promise<DeleteResult> => {
      const p = getProgram(id);
      if (!p) throw new Error('Program not found');
      const setIds = ref.current.sets.filter((s) => s.programId === id).map((s) => s.id);
      if (mode === 'move-to-unsorted') {
        await moveCreativesToUnsorted(ref.current.creatives.filter((c) => setIds.includes(c.setId)));
      }
      await removeSetRows(setIds, mode === 'delete-all');
      await deleteRemoteProgram(id);
      commit({ programs: ref.current.programs.filter((x) => x.id !== id) });
      return { driveOk: await bestEffortTrashFolder(p.driveFolderId) };
    },
    [commit, moveCreativesToUnsorted, removeSetRows]
  );

  const deleteSet = useCallback(
    async (id: string, mode: DeleteMode): Promise<DeleteResult> => {
      if (id === UNSORTED_ID) throw new Error(UNSORTED_ERROR);
      const s = getSet(id);
      if (!s) throw new Error('Ad set not found');
      if (mode === 'move-to-unsorted') {
        await moveCreativesToUnsorted(ref.current.creatives.filter((c) => c.setId === id));
      }
      await removeSetRows([id], mode === 'delete-all');
      return { driveOk: await bestEffortTrashFolder(s.driveFolderId) };
    },
    [moveCreativesToUnsorted, removeSetRows]
  );

  // ---- Creatives ----
  const addCreative = useCallback(
    async (input: { setId: string; name: string; files: AdFile[]; sourceUrl?: string }): Promise<AdCreative> => {
      const now = nowIso();
      const creative: AdCreative = {
        id: newId('ad-creative'),
        setId: input.setId,
        name: input.name,
        format: detectFormat(input.files),
        files: input.files,
        sourceUrl: input.sourceUrl ?? '',
        hidden: false,
        uploadedBy: activeUserName,
        createdAt: now,
        updatedAt: now,
      };
      await saveCreative(creative);
      return creative;
    },
    [activeUserName, saveCreative]
  );

  const updateCreative = useCallback(
    async (id: string, patch: Partial<Pick<AdCreative, 'name' | 'sourceUrl' | 'hidden'>>): Promise<void> => {
      const c = getCreative(id);
      if (!c) throw new Error('Creative not found');
      await saveCreative({ ...c, ...patch, updatedAt: nowIso() });
    },
    [saveCreative]
  );

  const moveCreative = useCallback(
    async (id: string, setId: string): Promise<void> => {
      const c = getCreative(id);
      if (!c) throw new Error('Creative not found');
      if (c.setId === setId) return;
      const folderId = await ensureSetFolder(setId);
      for (const f of c.files) await moveFile(f.driveFileId, folderId);
      await saveCreative({ ...c, setId, updatedAt: nowIso() });
    },
    [ensureSetFolder, saveCreative]
  );

  const deleteCreative = useCallback(
    async (id: string): Promise<DeleteResult> => {
      const c = getCreative(id);
      if (!c) throw new Error('Creative not found');
      await deleteRemoteCreative(id);
      commit({ creatives: ref.current.creatives.filter((x) => x.id !== id) });
      const results = await Promise.allSettled(c.files.map((f) => trashFile(f.driveFileId)));
      return { driveOk: results.every((r) => r.status === 'fulfilled') };
    },
    [commit]
  );

  // ---- Share links ----
  const createShareLink = useCallback(
    async (level: AdShareLink['level'], targetId: string, label: string): Promise<AdShareLink> => {
      const link: AdShareLink = {
        token: crypto.randomUUID().replace(/-/g, ''),
        level,
        targetId,
        label,
        createdBy: activeUserName,
        createdAt: nowIso(),
        revokedAt: null,
      };
      await upsertRemoteShareLink(link);
      commit({ shareLinks: [link, ...ref.current.shareLinks] });
      return link;
    },
    [activeUserName, commit]
  );

  const revokeShareLink = useCallback(
    async (token: string): Promise<void> => {
      const l = ref.current.shareLinks.find((x) => x.token === token);
      if (!l) return;
      const revoked = { ...l, revokedAt: nowIso() };
      await upsertRemoteShareLink(revoked);
      commit({ shareLinks: ref.current.shareLinks.map((x) => (x.token === token ? revoked : x)) });
    },
    [commit]
  );

  // ---- Audiences ----
  const addAudience = useCallback(
    async (name: string): Promise<void> => {
      const sortOrder = ref.current.audiences.reduce((m, a) => Math.max(m, a.sortOrder), 0) + 1;
      const audience: AdAudience = { id: crypto.randomUUID(), name, sortOrder };
      await upsertRemoteAudience(audience);
      commit({ audiences: [...ref.current.audiences, audience] });
    },
    [commit]
  );

  const removeAudience = useCallback(
    async (id: string): Promise<void> => {
      await deleteRemoteAudience(id);
      commit({ audiences: ref.current.audiences.filter((a) => a.id !== id) });
    },
    [commit]
  );

  const countCreativesUnder = useCallback(
    (kind: 'program' | 'set', id: string): number => {
      if (kind === 'set') return data.creatives.filter((c) => c.setId === id).length;
      const setIds = new Set(data.sets.filter((s) => s.programId === id).map((s) => s.id));
      return data.creatives.filter((c) => setIds.has(c.setId)).length;
    },
    [data.creatives, data.sets]
  );

  return useMemo(
    () => ({
      programs: data.programs,
      sets: data.sets,
      creatives: data.creatives,
      audiences: data.audiences,
      shareLinks: data.shareLinks,
      loading,
      createProgram,
      updateProgram,
      deleteProgram,
      createSet,
      updateSet,
      moveSet,
      deleteSet,
      addCreative,
      updateCreative,
      moveCreative,
      deleteCreative,
      createShareLink,
      revokeShareLink,
      addAudience,
      removeAudience,
      ensureSetFolder,
      countCreativesUnder,
    }),
    [
      data, loading, createProgram, updateProgram, deleteProgram, createSet, updateSet, moveSet, deleteSet,
      addCreative, updateCreative, moveCreative, deleteCreative, createShareLink, revokeShareLink,
      addAudience, removeAudience, ensureSetFolder, countCreativesUnder,
    ]
  );
}
