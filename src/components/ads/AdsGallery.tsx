import React, { useEffect, useMemo, useState } from 'react';
import type { AdCreative, AdFormat, AdProgram, AdSet, AdsSnapshot } from '../../types';
import { thumbnailUrl } from '../../utils/adsModel';
import { downloadFiles } from './downloadFiles';

export type AdsItemKind = 'program' | 'set' | 'creative';

interface AdsGalleryProps {
  snapshot: AdsSnapshot;
  brandName: (brandId: string) => string;
  selectable: boolean;
  /** True when the snapshot is a search result: shows a flat list instead of the drill-down. */
  searching?: boolean;
  onOpenProgram?: (id: string) => void;
  onOpenSet?: (id: string) => void;
  onOpenCreative?: (id: string) => void;
  renderActions?: (kind: AdsItemKind, id: string) => React.ReactNode;
}

const FORMAT_LABEL: Record<AdFormat, string> = {
  image: 'Image', carousel: 'Carousel', video: 'Video', zip: 'Zip', other: 'File',
};
const FORMAT_ICON: Record<AdFormat, string> = {
  image: 'image', carousel: 'view_carousel', video: 'movie', zip: 'folder_zip', other: 'draft',
};
const HAS_THUMB: AdFormat[] = ['image', 'carousel', 'video'];

const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
const iconBtn =
  'min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border border-[#efefed] bg-white text-[#5f5f5b] hover:text-[#1b1c1a] hover:bg-[#f4f4f3] cursor-pointer';

const Icon: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => (
  <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>
);

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="font-label-caps text-[11px] font-bold tracking-widest text-[#5f5f5b] uppercase mb-2">{children}</h3>
);

/** Folder-style card for a course or an ad set. */
const FolderCard: React.FC<{
  icon: string; title: string; subtitle: string; onOpen: () => void; actions?: React.ReactNode;
}> = ({ icon, title, subtitle, onOpen, actions }) => (
  // flex-wrap: when the title would get narrower than 12rem (phones, two-column
  // tablets) the action row drops onto its own line under the title.
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-white rounded-2xl border border-[#efefed] hover:border-[#c7c5f8] hover:shadow-md transition-all p-2">
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 grow basis-48 min-w-0 min-h-[56px] px-2 text-left cursor-pointer"
    >
      <span className="w-10 h-10 shrink-0 rounded-xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center">
        <Icon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-[#1b1c1a] truncate">{title}</span>
        <span className="block text-xs text-[#5f5f5b] truncate">{subtitle}</span>
      </span>
    </button>
    {actions && <div className="flex items-center justify-end gap-1 ml-auto max-w-full">{actions}</div>}
  </div>
);

const CreativeCard: React.FC<{
  creative: AdCreative;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  actions?: React.ReactNode;
}> = ({ creative, selectable, selected, onToggle, onOpen, actions }) => {
  const [broken, setBroken] = useState(false);
  const first = creative.files[0];
  const firstId = first?.driveFileId;
  useEffect(() => { setBroken(false); }, [firstId]);
  const canSelect = selectable && creative.files.length > 0;
  const showThumb = !!first && HAS_THUMB.includes(creative.format) && !broken;

  return (
    <div
      data-testid="creative-card"
      className={`flex flex-col bg-white rounded-2xl border overflow-hidden transition-all ${selected ? 'border-[#4f46e5] shadow-md' : 'border-[#efefed] hover:border-[#c7c5f8]'}`}
    >
      <div className="relative w-full aspect-video bg-[#f4f4f3] flex items-center justify-center">
        {showThumb ? (
          <img
            src={thumbnailUrl(first)}
            alt={creative.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div data-testid="creative-placeholder" className="flex flex-col items-center gap-1 text-[#5f5f5b] p-3 text-center">
            <Icon name={first ? FORMAT_ICON[creative.format] : 'hide_image'} className="text-4xl text-[#4f46e5]/60" />
            <span className="text-[11px]">{first ? (broken ? 'Preview unavailable' : first.name) : 'No files yet'}</span>
          </div>
        )}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
          {FORMAT_LABEL[creative.format]}
        </span>
        {creative.format === 'carousel' && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
            {creative.files.length} slides
          </span>
        )}
        {canSelect && (
          <label className="absolute top-1 right-1 w-[38px] h-[38px] flex items-center justify-center cursor-pointer">
            <input
              type="checkbox"
              aria-label={`Select ${creative.name}`}
              checked={selected}
              onChange={onToggle}
              className="w-5 h-5 accent-[#4f46e5] cursor-pointer"
            />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 min-w-0">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="grow basis-32 min-w-0 min-h-[38px] text-left text-sm font-bold text-[#1b1c1a] truncate cursor-pointer"
            title={creative.name}
          >
            {creative.name}
          </button>
        ) : (
          <span className="grow basis-32 min-w-0 text-sm font-bold text-[#1b1c1a] truncate" title={creative.name}>
            {creative.name}
          </span>
        )}
        <button
          type="button"
          aria-label={`Download ${creative.name}`}
          title="Download"
          disabled={creative.files.length === 0}
          onClick={() => void downloadFiles(creative.files)}
          className={`${iconBtn} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Icon name="download" className="text-lg" />
        </button>
        {actions}
      </div>
    </div>
  );
};

export const AdsGallery: React.FC<AdsGalleryProps> = ({
  snapshot, brandName, selectable, searching = false,
  onOpenProgram, onOpenSet, onOpenCreative, renderActions,
}) => {
  const [programId, setProgramId] = useState<string | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { programs, sets, creatives } = snapshot;
  const program = programs.find(p => p.id === programId) ?? null;
  const adSet = sets.find(s => s.id === setId) ?? null;

  const setsOf = (pid: string) => sets.filter(s => s.programId === pid);
  const creativesOf = (sid: string) => creatives.filter(c => c.setId === sid);

  const programCard = (p: AdProgram) => {
    const n = setsOf(p.id).length;
    return (
      <FolderCard key={p.id} icon="school" title={p.name}
        subtitle={`${brandName(p.brandId)} · ${n} ad set${n === 1 ? '' : 's'}`}
        onOpen={() => {
          if (!searching) { setProgramId(p.id); setSetId(null); }
          onOpenProgram?.(p.id);
        }}
        actions={renderActions?.('program', p.id)} />
    );
  };
  const setCard = (s: AdSet) => {
    const n = creativesOf(s.id).length;
    return (
      <FolderCard key={s.id} icon="folder" title={s.name}
        subtitle={`${s.audience || 'Any audience'} · ${n} ad${n === 1 ? '' : 's'}`}
        onOpen={() => {
          if (!searching) setSetId(s.id);
          onOpenSet?.(s.id);
        }}
        actions={renderActions?.('set', s.id)} />
    );
  };

  const visibleCreatives: AdCreative[] = useMemo(() => {
    const list = searching ? creatives : adSet ? creativesOf(adSet.id) : [];
    return list.filter(c => c.files.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, creatives, adSet]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const allVisibleSelected =
    visibleCreatives.length > 0 && visibleCreatives.every(c => selected.has(c.id));
  const toggleAll = () =>
    setSelected(prev => {
      const next = new Set(prev);
      visibleCreatives.forEach(c => (allVisibleSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });

  const selectedCount = creatives.filter(c => c.files.length > 0 && selected.has(c.id)).length;
  const downloadSelected = () =>
    void downloadFiles(creatives.filter(c => c.files.length > 0 && selected.has(c.id)).flatMap(c => c.files));

  const creativeGrid = (list: AdCreative[]) => (
    <div className={GRID}>
      {list.map(c => (
        <CreativeCard key={c.id} creative={c} selectable={selectable}
          selected={selected.has(c.id)} onToggle={() => toggle(c.id)}
          onOpen={onOpenCreative ? () => onOpenCreative(c.id) : undefined}
          actions={renderActions?.('creative', c.id)} />
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (searching) {
    if (!programs.length && !sets.length && !creatives.length) {
      body = <p className="text-sm text-[#5f5f5b] text-center py-12">No ads match your search.</p>;
    } else {
      body = (
        <div className="flex flex-col gap-6">
          {programs.length > 0 && <section><Heading>Courses</Heading><div className={GRID}>{programs.map(programCard)}</div></section>}
          {sets.length > 0 && <section><Heading>Ad sets</Heading><div className={GRID}>{sets.map(setCard)}</div></section>}
          {creatives.length > 0 && <section><Heading>Ads</Heading>{creativeGrid(creatives)}</section>}
        </div>
      );
    }
  } else if (adSet) {
    const list = creativesOf(adSet.id);
    body = list.length
      ? creativeGrid(list)
      : <p className="text-sm text-[#5f5f5b] text-center py-12">No ads in this set yet.</p>;
  } else if (program) {
    const list = setsOf(program.id);
    body = list.length
      ? <div className={GRID}>{list.map(setCard)}</div>
      : <p className="text-sm text-[#5f5f5b] text-center py-12">No ad sets in this course yet.</p>;
  } else {
    const loose = sets.filter(s => s.programId === null);
    body = programs.length || loose.length
      ? <div className={GRID}>{programs.map(programCard)}{loose.map(setCard)}</div>
      : <p className="text-sm text-[#5f5f5b] text-center py-12">No ads yet.</p>;
  }

  const crumb = 'min-h-[38px] px-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-[#f4f4f3]';

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {!searching && (program || adSet) && (
        <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-[#5f5f5b]">
          <button type="button" className={crumb} onClick={() => { setProgramId(null); setSetId(null); }}>All ads</button>
          {program && (
            <>
              <Icon name="chevron_right" className="text-base" />
              {adSet
                ? <button type="button" className={crumb} onClick={() => setSetId(null)}>{program.name}</button>
                : <span aria-current="page" className="px-2 text-xs font-bold text-[#0f0f0f]">{program.name}</span>}
            </>
          )}
          {adSet && (
            <>
              <Icon name="chevron_right" className="text-base" />
              <span aria-current="page" className="px-2 text-xs font-bold text-[#0f0f0f]">{adSet.name}</span>
            </>
          )}
        </nav>
      )}

      {selectable && visibleCreatives.length > 0 && (
        <label className="flex items-center gap-2 min-h-[38px] text-xs font-semibold text-[#5f5f5b] cursor-pointer w-fit">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="w-4 h-4 accent-[#4f46e5]" />
          Select all
        </label>
      )}

      {body}

      {selectedCount > 0 && (
        <div className="sticky bottom-3 flex justify-center z-10 pt-2">
          <button
            type="button"
            onClick={downloadSelected}
            title="Your browser may ask to allow multiple downloads. Large videos open in a new tab."
            className="min-h-[44px] px-5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Icon name="download" className="text-base" />
            Download {selectedCount} selected
          </button>
        </div>
      )}
    </div>
  );
};
