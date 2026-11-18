import React, { useEffect, useMemo, useState } from 'react';
import type { AdsSnapshot } from '../../types';
import { SEED_BRANDS } from '../../data/brands';
import { fetchPublicLibrary, fetchSharedScope } from '../../utils/adsStorage';
import { searchAds, type AdsFilters } from '../../utils/adsModel';
import type { PublicRoute } from '../../utils/publicRoute';
import { AdsGallery } from './AdsGallery';
import { AdsSearchBar } from './AdsSearchBar';

const brandName = (id: string): string => {
  if (id === 'shared') return 'Shared';
  const seed = (SEED_BRANDS as Record<string, { name: string } | undefined>)[id];
  return seed?.name ?? id;
};

const isEmpty = (s: AdsSnapshot) => !s.programs.length && !s.sets.length && !s.creatives.length;

export const PublicAdsPage: React.FC<{ route: PublicRoute }> = ({ route }) => {
  const [snapshot, setSnapshot] = useState<AdsSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AdsFilters>({});
  const token = route.kind === 'share' ? route.token : '';

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    const load = route.kind === 'share' ? fetchSharedScope(token) : fetchPublicLibrary();
    load.then(s => { if (!cancelled) setSnapshot(s); });
    return () => { cancelled = true; };
  }, [route.kind, token]);

  // A set or creative link has no course on top: show its ads directly (flat list, no folders).
  const flat = !!snapshot && route.kind === 'share' && snapshot.programs.length === 0;

  const brands = useMemo(() => {
    const ids = [...new Set((snapshot?.programs ?? []).map(p => p.brandId))];
    return ids.map(id => ({ id, name: brandName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot]);
  const audiences = useMemo(
    () => [...new Set((snapshot?.sets ?? []).map(s => s.audience).filter(Boolean))].sort(),
    [snapshot],
  );

  const view = useMemo(() => {
    if (!snapshot) return snapshot;
    const base = flat ? { ...snapshot, sets: [] } : snapshot;
    return searchAds(base, query, filters, brandName);
  }, [snapshot, flat, query, filters]);

  const searchActive = query.trim() !== '' || Object.values(filters).some(Boolean);

  let body: React.ReactNode;
  if (!snapshot || !view) {
    body = <p role="status" className="text-sm text-[#5f5f5b] text-center py-12">Loading...</p>;
  } else if (isEmpty(snapshot)) {
    body = (
      <p className="text-sm text-[#5f5f5b] text-center py-12">
        {route.kind === 'share'
          ? "This link isn't available anymore. Ask the team for a new one."
          : 'No ads are available right now.'}
      </p>
    );
  } else {
    body = (
      <>
        <AdsSearchBar
          query={query} onQueryChange={setQuery}
          filters={filters} onFiltersChange={setFilters}
          brands={brands} audiences={audiences}
        />
        <AdsGallery
          snapshot={view}
          brandName={brandName}
          selectable
          searching={searchActive || flat}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1b1c1a]">
      <header className="bg-white border-b border-[#e9e9e7]">
        <div className="max-w-6xl mx-auto px-4 min-h-[56px] flex items-center">
          <h1 className="text-base font-bold text-[#0f0f0f]">Pharmacozyme Ads</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 min-w-0">{body}</main>
    </div>
  );
};
