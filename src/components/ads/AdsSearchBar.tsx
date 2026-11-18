import React from 'react';
import type { AdFormat, AdKind } from '../../types';
import type { AdsFilters } from '../../utils/adsModel';

interface AdsSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  filters: AdsFilters;
  onFiltersChange: (f: AdsFilters) => void;
  brands: { id: string; name: string }[];
  audiences: string[];
}

const KINDS: { value: AdKind; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'program', label: 'Program' },
];
const FORMATS: { value: AdFormat; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'video', label: 'Video' },
  { value: 'zip', label: 'Zip' },
  { value: 'other', label: 'Other' },
];

const selectClass =
  'min-h-[38px] min-w-0 rounded-lg border border-[#e9e9e7] bg-white px-2.5 text-xs text-[#1b1c1a] focus:outline-none focus:border-[#4f46e5]';

export const AdsSearchBar: React.FC<AdsSearchBarProps> = ({
  query, onQueryChange, filters, onFiltersChange, brands, audiences,
}) => {
  const hasAny = query.trim() !== '' || Object.values(filters).some(Boolean);

  const setFilter = <K extends keyof AdsFilters>(key: K, raw: string) => {
    const next: AdsFilters = { ...filters };
    if (raw) (next as Record<string, string>)[key] = raw;
    else delete next[key];
    onFiltersChange(next);
  };

  const renderFilter = (label: string, value: string | undefined, field: keyof AdsFilters, options: { value: string; label: string }[]) => (
      <label key={label} className="flex flex-col gap-1 min-w-0 text-[11px] font-semibold text-[#5f5f5b]">
        {label}
        <select
          aria-label={label}
          className={selectClass}
          value={value ?? ''}
          onChange={e => setFilter(field, e.target.value)}
        >
          <option value="">All</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
  );

  return (
    <div className="flex flex-col gap-3 bg-white border border-[#efefed] rounded-2xl p-3">
      <div className="relative min-w-0">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5f5b] text-lg pointer-events-none">search</span>
        <input
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search ads by name, course, brand or audience"
          className="w-full min-h-[42px] rounded-xl border border-[#e9e9e7] bg-[#fafafa] pl-10 pr-3 text-sm text-[#0f0f0f] focus:outline-none focus:border-[#4f46e5]"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        {renderFilter('Brand', filters.brandId, 'brandId', brands.map(b => ({ value: b.id, label: b.name })))}
        {renderFilter('Kind', filters.kind, 'kind', KINDS)}
        {renderFilter('Format', filters.format, 'format', FORMATS)}
        {renderFilter('Audience', filters.audience, 'audience', audiences.map(a => ({ value: a, label: a })))}
      </div>
      {hasAny && (
        <button
          type="button"
          onClick={() => { onQueryChange(''); onFiltersChange({}); }}
          className="self-start min-h-[38px] px-3 text-xs font-semibold text-[#4f46e5] hover:bg-[#eef2ff] rounded-lg cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
};
