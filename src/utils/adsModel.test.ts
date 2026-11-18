import { describe, it, expect } from 'vitest';
import type { AdProgram, AdSet, AdCreative, AdsSnapshot, TeamMember } from '../types';
import {
  canManageAd,
  detectFormat,
  thumbnailUrl,
  downloadUrl,
  viewUrl,
  isVisibleOnStandingLink,
  scopeFor,
  searchAds,
} from './adsModel';

const prog = (id: string, o: Partial<AdProgram> = {}): AdProgram => ({
  id, name: `Prog ${id}`, brandId: 'b1', kind: 'course', driveFolderId: 'f', hidden: false,
  createdBy: 'u', createdAt: '', updatedAt: '', ...o,
});
const set = (id: string, programId: string | null, o: Partial<AdSet> = {}): AdSet => ({
  id, programId, name: `Set ${id}`, audience: 'Doctors', driveFolderId: 'f', hidden: false,
  isSystem: false, createdBy: 'u', createdAt: '', updatedAt: '', ...o,
});
const cr = (id: string, setId: string, o: Partial<AdCreative> = {}): AdCreative => ({
  id, setId, name: `Creative ${id}`, format: 'image', files: [], sourceUrl: '', hidden: false,
  uploadedBy: 'u', createdAt: '', updatedAt: '', ...o,
});
const ids = (s: AdsSnapshot) => ({
  p: s.programs.map(x => x.id), s: s.sets.map(x => x.id), c: s.creatives.map(x => x.id),
});
const brandName = (id: string) => (id === 'b1' ? 'Alpha' : 'Beta');

describe('detectFormat', () => {
  it('detects formats', () => {
    expect(detectFormat([{ mimeType: 'image/png', name: 'a.png' }])).toBe('image');
    expect(detectFormat([1, 2, 3].map(i => ({ mimeType: 'image/png', name: `${i}.png` })))).toBe('carousel');
    expect(detectFormat([{ mimeType: 'video/mp4', name: 'a.mp4' }])).toBe('video');
    expect(detectFormat([{ mimeType: 'application/octet-stream', name: 'a.zip' }])).toBe('zip');
    expect(detectFormat([{ mimeType: 'application/zip', name: 'a' }])).toBe('zip');
    expect(detectFormat([{ mimeType: 'application/octet-stream', name: 'x.psd' }])).toBe('other');
  });
});

describe('urls', () => {
  it('builds drive urls', () => {
    expect(thumbnailUrl({ driveFileId: 'abc' })).toBe('https://drive.google.com/thumbnail?id=abc&sz=w480');
    expect(thumbnailUrl({ driveFileId: 'abc' }, 100)).toBe('https://drive.google.com/thumbnail?id=abc&sz=w100');
    expect(downloadUrl({ driveFileId: 'abc' })).toBe('https://drive.google.com/uc?export=download&id=abc');
    expect(viewUrl({ driveFileId: 'abc' })).toBe('https://drive.google.com/file/d/abc/view');
  });
});

describe('isVisibleOnStandingLink', () => {
  it('hidden program removes its sets and creatives', () => {
    const r = isVisibleOnStandingLink({
      programs: [prog('p1', { hidden: true }), prog('p2')],
      sets: [set('s1', 'p1'), set('s2', 'p2')],
      creatives: [cr('c1', 's1'), cr('c2', 's2')],
    });
    expect(ids(r)).toEqual({ p: ['p2'], s: ['s2'], c: ['c2'] });
  });
  it('hidden set removes its creatives, not siblings', () => {
    const r = isVisibleOnStandingLink({
      programs: [prog('p1')],
      sets: [set('s1', 'p1', { hidden: true }), set('s2', 'p1')],
      creatives: [cr('c1', 's1'), cr('c2', 's2')],
    });
    expect(ids(r)).toEqual({ p: ['p1'], s: ['s2'], c: ['c2'] });
  });
  it('removes hidden creatives and creatives with a missing set', () => {
    const r = isVisibleOnStandingLink({
      programs: [prog('p1')],
      sets: [set('s1', 'p1')],
      creatives: [cr('c1', 's1', { hidden: true }), cr('c2', 'nope'), cr('c3', 's1')],
    });
    expect(ids(r).c).toEqual(['c3']);
  });
  it('keeps loose sets', () => {
    const r = isVisibleOnStandingLink({
      programs: [], sets: [set('s1', null)], creatives: [cr('c1', 's1')],
    });
    expect(ids(r)).toEqual({ p: [], s: ['s1'], c: ['c1'] });
  });
});

describe('scopeFor', () => {
  const snap: AdsSnapshot = {
    programs: [prog('p1'), prog('p2')],
    sets: [set('s1', 'p1'), set('s2', 'p1'), set('s3', 'p2')],
    creatives: [cr('c1', 's1', { hidden: true }), cr('c2', 's2'), cr('c3', 's3')],
  };
  it('program scope', () => {
    expect(ids(scopeFor(snap, 'program', 'p1'))).toEqual({ p: ['p1'], s: ['s1', 's2'], c: ['c1', 'c2'] });
  });
  it('set scope', () => {
    expect(ids(scopeFor(snap, 'set', 's2'))).toEqual({ p: [], s: ['s2'], c: ['c2'] });
  });
  it('creative scope ignores hidden', () => {
    expect(ids(scopeFor(snap, 'creative', 'c1'))).toEqual({ p: [], s: ['s1'], c: ['c1'] });
  });
});

describe('searchAds', () => {
  const snap: AdsSnapshot = {
    programs: [prog('p1', { name: 'Cardiology', brandId: 'b1', kind: 'course' }),
      prog('p2', { name: 'Oncology', brandId: 'b2', kind: 'webinar' })],
    sets: [
      set('s1', 'p1', { name: 'Spring', audience: 'Nurses' }),
      set('s2', 'p1', { name: 'Autumn', audience: 'Doctors' }),
      set('s3', 'p2', { name: 'Launch', audience: 'Doctors' }),
      set('s4', null, { name: 'Unsorted', audience: 'Nurses', isSystem: true }),
    ],
    creatives: [
      cr('c1', 's1', { name: 'Banner', format: 'image' }),
      cr('c2', 's2', { name: 'Clip', format: 'video' }),
      cr('c3', 's3', { name: 'Banner two', format: 'image' }),
      cr('c4', 's4', { name: 'Loose banner', format: 'image' }),
    ],
  };
  it('no query/filters returns input unchanged', () => {
    expect(searchAds(snap, '   ', {}, brandName)).toBe(snap);
  });
  it('is case and diacritic insensitive', () => {
    const a = ids(searchAds(snap, 'nurses', {}, brandName));
    expect(ids(searchAds(snap, 'Nurses', {}, brandName))).toEqual(a);
    expect(ids(searchAds(snap, 'núrses', {}, brandName))).toEqual(a);
    expect(a.c).toEqual(['c1', 'c4']);
    expect(a.s).toEqual(['s1', 's4']);
    expect(a.p).toEqual(['p1']);
  });
  it('requires every word', () => {
    const r = ids(searchAds(snap, 'banner nurses', {}, brandName));
    expect(r.c).toEqual(['c1', 'c4']);
    expect(ids(searchAds(snap, 'banner autumn', {}, brandName)).c).toEqual([]);
  });
  it('matches brand name and kind via haystack', () => {
    expect(ids(searchAds(snap, 'beta webinar', {}, brandName)).c).toEqual(['c3']);
  });
  it('audience filter excludes other audiences', () => {
    const r = ids(searchAds(snap, '', { audience: 'Doctors' }, brandName));
    expect(r.s).toEqual(['s2', 's3']);
    expect(r.c).toEqual(['c2', 'c3']);
  });
  it('format filter narrows creatives and parents', () => {
    const r = ids(searchAds(snap, '', { format: 'video' }, brandName));
    expect(r).toEqual({ p: ['p1'], s: ['s2'], c: ['c2'] });
  });
  it('brand/kind filters exclude loose sets and their creatives', () => {
    const r = ids(searchAds(snap, '', { brandId: 'b1' }, brandName));
    expect(r.p).toEqual(['p1']);
    expect(r.s).toEqual(['s1', 's2']);
    expect(r.c).toEqual(['c1', 'c2']);
    expect(ids(searchAds(snap, '', { kind: 'webinar' }, brandName)).s).toEqual(['s3']);
  });
  it('loose sets behave normally with format/audience filters only', () => {
    const r = ids(searchAds(snap, '', { audience: 'Nurses' }, brandName));
    expect(r.s).toEqual(['s1', 's4']);
    expect(r.c).toEqual(['c1', 'c4']);
  });
  it('program returned when only a child matches', () => {
    const r = ids(searchAds(snap, 'clip', {}, brandName));
    expect(r).toEqual({ p: ['p1'], s: ['s2'], c: ['c2'] });
  });
  it('no match returns empty arrays', () => {
    expect(ids(searchAds(snap, 'zzzz', {}, brandName))).toEqual({ p: [], s: [], c: [] });
  });
});

describe('canManageAd', () => {
  const tm = (over: Partial<TeamMember> = {}): TeamMember => ({
    id: 'u1', name: 'Sarah Connor', role: 'Designer', userRole: 'Editor',
    email: 'sarah@example.com', avatarInitials: 'SC', color: '#4f46e5', ...over,
  });
  it('is false without a teammate', () => {
    expect(canManageAd('Sarah Connor', null)).toBe(false);
    expect(canManageAd('', undefined)).toBe(false);
  });
  it('allows Admins on anything', () => {
    expect(canManageAd('Someone Else', tm({ userRole: 'Admin' }))).toBe(true);
  });
  it('matches the creator by name, id or email, case-insensitively', () => {
    expect(canManageAd('sarah connor', tm())).toBe(true);
    expect(canManageAd('U1', tm())).toBe(true);
    expect(canManageAd('SARAH@example.com', tm())).toBe(true);
  });
  it('denies other creators and allows legacy (empty) creators', () => {
    expect(canManageAd('John Doe', tm())).toBe(false);
    expect(canManageAd('  ', tm())).toBe(true);
  });
});
