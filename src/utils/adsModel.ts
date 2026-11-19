import type {
  AdFile, AdFormat, AdKind, AdProgram, AdSet, AdShareLink, AdsSnapshot, TeamMember,
} from '../types';

/**
 * Delete permission for an ad item (course / ad set / creative): Admins, the
 * original creator/uploader (matched by name, id or email, same as
 * canManageTutorial) or anyone when the creator is unset (legacy data).
 */
export function canManageAd(
  createdBy: string,
  activeTeammate: TeamMember | null | undefined,
): boolean {
  if (!activeTeammate) return false;
  if (activeTeammate.userRole === 'Admin') return true;
  const creator = (createdBy || '').trim().toLowerCase();
  if (!creator) return true;
  const name = (activeTeammate.name || '').trim().toLowerCase();
  const id = (activeTeammate.id || '').trim().toLowerCase();
  const email = (activeTeammate.email || '').trim().toLowerCase();
  return creator === name || creator === id || (Boolean(email) && creator === email);
}

export function detectFormat(files: Pick<AdFile, 'mimeType' | 'name'>[]): AdFormat {
  if (files.some(f => f.mimeType.startsWith('video/'))) return 'video';
  const images = files.filter(f => f.mimeType.startsWith('image/'));
  if (images.length >= 2) return 'carousel';
  if (images.length === 1 && files.length === 1) return 'image';
  const isZip = (f: Pick<AdFile, 'mimeType' | 'name'>) =>
    f.name.toLowerCase().endsWith('.zip') ||
    f.mimeType === 'application/zip' ||
    f.mimeType === 'application/x-zip-compressed';
  if (files.some(isZip)) return 'zip';
  if (images.length === 1) return 'image';
  return 'other';
}

export const thumbnailUrl = (file: Pick<AdFile, 'driveFileId'>, width = 480): string =>
  `https://drive.google.com/thumbnail?id=${file.driveFileId}&sz=w${width}`;

export const downloadUrl = (file: Pick<AdFile, 'driveFileId'>): string =>
  `https://drive.google.com/uc?export=download&id=${file.driveFileId}`;

export const viewUrl = (file: Pick<AdFile, 'driveFileId'>): string =>
  `https://drive.google.com/file/d/${file.driveFileId}/view`;

/**
 * Ad set dropdown options labelled "Course / Set" (or "No course / Set"), so sets
 * that share a name in different courses can be told apart. Sets without a course
 * come first, then by course name, then by set name.
 */
export function adSetOptions(
  sets: Pick<AdSet, 'id' | 'name' | 'programId'>[],
  programs: Pick<AdProgram, 'id' | 'name'>[]
): { value: string; label: string }[] {
  const courseOf = new Map(programs.map(p => [p.id, p.name]));
  const rows = sets.map(s => {
    const course = s.programId ? courseOf.get(s.programId) : undefined;
    return { id: s.id, set: s.name, course: course ?? null };
  });
  rows.sort((a, b) => {
    if ((a.course === null) !== (b.course === null)) return a.course === null ? -1 : 1;
    const byCourse = (a.course ?? '').localeCompare(b.course ?? '', undefined, { sensitivity: 'base' });
    return byCourse || a.set.localeCompare(b.set, undefined, { sensitivity: 'base' });
  });
  return rows.map(r => ({ value: r.id, label: `${r.course ?? 'No course'} / ${r.set}` }));
}

export function isVisibleOnStandingLink(snap: AdsSnapshot): AdsSnapshot {
  const programs = snap.programs.filter(p => !p.hidden);
  const programIds = new Set(programs.map(p => p.id));
  const sets = snap.sets.filter(
    s => !s.hidden && (s.programId === null || programIds.has(s.programId)),
  );
  const setIds = new Set(sets.map(s => s.id));
  const creatives = snap.creatives.filter(c => !c.hidden && setIds.has(c.setId));
  return { programs, sets, creatives };
}

export function scopeFor(
  snap: AdsSnapshot,
  level: AdShareLink['level'],
  targetId: string,
): AdsSnapshot {
  if (level === 'program') {
    const programs = snap.programs.filter(p => p.id === targetId);
    const sets = snap.sets.filter(s => s.programId === targetId);
    const setIds = new Set(sets.map(s => s.id));
    return { programs, sets, creatives: snap.creatives.filter(c => setIds.has(c.setId)) };
  }
  if (level === 'set') {
    return {
      programs: [],
      sets: snap.sets.filter(s => s.id === targetId),
      creatives: snap.creatives.filter(c => c.setId === targetId),
    };
  }
  const creatives = snap.creatives.filter(c => c.id === targetId);
  const setIds = new Set(creatives.map(c => c.setId));
  return { programs: [], sets: snap.sets.filter(s => setIds.has(s.id)), creatives };
}

export interface AdsFilters {
  brandId?: string;
  kind?: AdKind;
  format?: AdFormat;
  audience?: string;
}

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchAds(
  snap: AdsSnapshot,
  query: string,
  filters: AdsFilters,
  brandName: (id: string) => string,
): AdsSnapshot {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const { brandId, kind, format, audience } = filters;
  if (words.length === 0 && !brandId && !kind && !format && !audience) return snap;

  const programById = new Map(snap.programs.map(p => [p.id, p]));
  const textOk = (hay: string[]) => {
    const h = norm(hay.join(' '));
    return words.every(w => h.includes(w));
  };
  const programOk = (p: { brandId: string; kind: AdKind }) =>
    (!brandId || p.brandId === brandId) && (!kind || p.kind === kind);

  // Whether a set passes the brand/kind/audience filters (not format).
  const setPasses = (s: AdsSnapshot['sets'][number]): boolean => {
    if (audience && s.audience !== audience) return false;
    if (brandId || kind) {
      const p = s.programId ? programById.get(s.programId) : undefined;
      if (!p || !programOk(p)) return false;
    }
    return true;
  };
  const setHay = (s: AdsSnapshot['sets'][number]): string[] => {
    const p = s.programId ? programById.get(s.programId) : undefined;
    return [
      s.name, p?.name ?? '', p?.kind ?? '', s.audience, p ? brandName(p.brandId) : '',
    ];
  };

  const setById = new Map(snap.sets.map(s => [s.id, s]));
  const creatives = snap.creatives.filter(c => {
    const s = setById.get(c.setId);
    if (!s || !setPasses(s)) return false;
    if (format && c.format !== format) return false;
    return textOk([c.name, ...setHay(s)]);
  });
  const creativeSetIds = new Set(creatives.map(c => c.setId));

  const sets = snap.sets.filter(s => {
    if (creativeSetIds.has(s.id)) return true;
    if (format || !setPasses(s)) return false;
    return textOk(setHay(s));
  });
  const setProgramIds = new Set(sets.map(s => s.programId));

  const programs = snap.programs.filter(p => {
    if (setProgramIds.has(p.id)) return true;
    if (audience || format || !programOk(p)) return false;
    return textOk([p.name, p.kind, brandName(p.brandId)]);
  });

  return { programs, sets, creatives };
}
