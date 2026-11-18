import { supabase } from '../lib/supabase';
import {
  AdAudience,
  AdCreative,
  AdFormat,
  AdKind,
  AdProgram,
  AdSet,
  AdShareLink,
  AdsSnapshot
} from '../types';

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const nowIso = (): string => new Date().toISOString();

/* Row mappers (public RPC payloads strip created_by/uploaded_by/drive_folder_id) */
export function rowToProgram(row: Row): AdProgram {
  return {
    id: String(row.id),
    name: str(row.name),
    brandId: str(row.brand_id) || 'shared',
    kind: (str(row.kind) || 'course') as AdKind,
    driveFolderId: str(row.drive_folder_id),
    hidden: Boolean(row.hidden),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at) || nowIso(),
    updatedAt: str(row.updated_at) || nowIso()
  };
}

export function programToRow(p: AdProgram): Row {
  return {
    id: p.id,
    name: p.name,
    brand_id: p.brandId,
    kind: p.kind,
    drive_folder_id: p.driveFolderId || '',
    hidden: p.hidden,
    created_by: p.createdBy || '',
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

export function rowToSet(row: Row): AdSet {
  return {
    id: String(row.id),
    programId: row.program_id ? String(row.program_id) : null,
    name: str(row.name),
    audience: str(row.audience),
    driveFolderId: str(row.drive_folder_id),
    hidden: Boolean(row.hidden),
    isSystem: Boolean(row.is_system),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at) || nowIso(),
    updatedAt: str(row.updated_at) || nowIso()
  };
}

export function setToRow(s: AdSet): Row {
  return {
    id: s.id,
    program_id: s.programId,
    name: s.name,
    audience: s.audience || '',
    drive_folder_id: s.driveFolderId || '',
    hidden: s.hidden,
    is_system: s.isSystem,
    created_by: s.createdBy || '',
    created_at: s.createdAt,
    updated_at: s.updatedAt
  };
}

export function rowToCreative(row: Row): AdCreative {
  return {
    id: String(row.id),
    setId: str(row.set_id),
    name: str(row.name),
    format: (str(row.format) || 'image') as AdFormat,
    files: Array.isArray(row.files) ? (row.files as AdCreative['files']) : [],
    sourceUrl: str(row.source_url),
    hidden: Boolean(row.hidden),
    uploadedBy: str(row.uploaded_by),
    createdAt: str(row.created_at) || nowIso(),
    updatedAt: str(row.updated_at) || nowIso()
  };
}

export function creativeToRow(c: AdCreative): Row {
  return {
    id: c.id,
    set_id: c.setId,
    name: c.name,
    format: c.format,
    files: c.files || [],
    source_url: c.sourceUrl || '',
    hidden: c.hidden,
    uploaded_by: c.uploadedBy || '',
    created_at: c.createdAt,
    updated_at: c.updatedAt
  };
}

export function rowToAudience(row: Row): AdAudience {
  return {
    id: String(row.id),
    name: str(row.name),
    sortOrder: Number(row.sort_order ?? 0)
  };
}

export function rowToShareLink(row: Row): AdShareLink {
  return {
    token: String(row.token),
    level: (str(row.level) || 'program') as AdShareLink['level'],
    targetId: str(row.target_id),
    label: str(row.label),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at) || nowIso(),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null
  };
}

export function shareLinkToRow(l: AdShareLink): Row {
  return {
    token: l.token,
    level: l.level,
    target_id: l.targetId,
    label: l.label || '',
    created_by: l.createdBy || '',
    created_at: l.createdAt,
    revoked_at: l.revokedAt
  };
}

const emptySnapshot = (): AdsSnapshot => ({ programs: [], sets: [], creatives: [] });

function payloadToSnapshot(data: unknown): AdsSnapshot {
  if (!data || typeof data !== 'object') return emptySnapshot();
  const d = data as Record<string, unknown>;
  const list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
  return {
    programs: list(d.programs).map(rowToProgram),
    sets: list(d.sets).map(rowToSet),
    creatives: list(d.creatives).map(rowToCreative)
  };
}

/* Authenticated reads */
export async function fetchAdsSnapshot(): Promise<AdsSnapshot | null> {
  if (!supabase) return null;
  const [p, s, c] = await Promise.all([
    supabase.from('ad_programs').select('*').order('created_at', { ascending: true }),
    supabase.from('ad_sets').select('*').order('created_at', { ascending: true }),
    supabase.from('ad_creatives').select('*').order('created_at', { ascending: false })
  ]);
  const err = p.error || s.error || c.error;
  if (err) {
    console.error('[Supabase] fetchAdsSnapshot failed:', err.message);
    return null;
  }
  return {
    programs: (p.data || []).map((r) => rowToProgram(r as Row)),
    sets: (s.data || []).map((r) => rowToSet(r as Row)),
    creatives: (c.data || []).map((r) => rowToCreative(r as Row))
  };
}

export async function fetchAdAudiences(): Promise<AdAudience[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('ad_audiences')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[Supabase] fetchAdAudiences failed:', error.message);
    return null;
  }
  return (data || []).map((r) => rowToAudience(r as Row));
}

export async function fetchShareLinks(): Promise<AdShareLink[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('ad_share_links')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Supabase] fetchShareLinks failed:', error.message);
    return null;
  }
  return (data || []).map((r) => rowToShareLink(r as Row));
}

/* Writes */
async function upsertRow(table: string, row: Row, label: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(table).upsert(row);
  if (error) console.error(`[Supabase] ${label} failed:`, error.message);
}

async function deleteRow(table: string, id: string, label: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`[Supabase] ${label} failed:`, error.message);
}

export const upsertRemoteProgram = (p: AdProgram): Promise<void> =>
  upsertRow('ad_programs', programToRow(p), 'upsertRemoteProgram');
export const upsertRemoteSet = (s: AdSet): Promise<void> =>
  upsertRow('ad_sets', setToRow(s), 'upsertRemoteSet');
export const upsertRemoteCreative = (c: AdCreative): Promise<void> =>
  upsertRow('ad_creatives', creativeToRow(c), 'upsertRemoteCreative');
export const upsertRemoteShareLink = (l: AdShareLink): Promise<void> =>
  upsertRow('ad_share_links', shareLinkToRow(l), 'upsertRemoteShareLink');
export const upsertRemoteAudience = (a: AdAudience): Promise<void> =>
  upsertRow('ad_audiences', { id: a.id, name: a.name, sort_order: a.sortOrder }, 'upsertRemoteAudience');

export const deleteRemoteProgram = (id: string): Promise<void> =>
  deleteRow('ad_programs', id, 'deleteRemoteProgram');
export const deleteRemoteSet = (id: string): Promise<void> =>
  deleteRow('ad_sets', id, 'deleteRemoteSet');
export const deleteRemoteCreative = (id: string): Promise<void> =>
  deleteRow('ad_creatives', id, 'deleteRemoteCreative');
export const deleteRemoteAudience = (id: string): Promise<void> =>
  deleteRow('ad_audiences', id, 'deleteRemoteAudience');

/* Realtime: one channel over all five tables */
export function subscribeAdsChanges(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  let channel = client.channel('ads-library-changes');
  for (const table of ['ad_programs', 'ad_sets', 'ad_creatives', 'ad_audiences', 'ad_share_links']) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange());
  }
  channel.subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/* Public (anon) RPC wrappers: never throw */
export async function fetchPublicLibrary(): Promise<AdsSnapshot> {
  if (!supabase) return emptySnapshot();
  try {
    const { data, error } = await supabase.rpc('ads_public_library');
    if (error) {
      console.error('[Supabase] fetchPublicLibrary failed:', error.message);
      return emptySnapshot();
    }
    return payloadToSnapshot(data);
  } catch (err) {
    console.error('[Supabase] fetchPublicLibrary threw:', err);
    return emptySnapshot();
  }
}

export async function fetchSharedScope(token: string): Promise<AdsSnapshot> {
  if (!supabase) return emptySnapshot();
  try {
    const { data, error } = await supabase.rpc('ads_shared_scope', { p_token: token });
    if (error) {
      console.error('[Supabase] fetchSharedScope failed:', error.message);
      return emptySnapshot();
    }
    return payloadToSnapshot(data);
  } catch (err) {
    console.error('[Supabase] fetchSharedScope threw:', err);
    return emptySnapshot();
  }
}
