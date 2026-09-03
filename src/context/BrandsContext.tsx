import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrandConfig, BrandId } from '../types';
import {
  getStoredBrands, saveStoredBrands, fetchRemoteBrands, upsertRemoteBrand, subscribeRemoteBrands,
} from '../utils/storage';

interface BrandsContextValue {
  brands: Record<BrandId, BrandConfig>;
  getBrand: (id: BrandId | 'all' | 'shared') => BrandConfig;
  updateBrand: (id: BrandId, patch: Partial<BrandConfig>) => Promise<void>;
}

const BrandsContext = createContext<BrandsContextValue | null>(null);

export const BrandsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brands, setBrands] = useState<Record<BrandId, BrandConfig>>(() => getStoredBrands());

  useEffect(() => {
    fetchRemoteBrands().then((remote) => {
      if (remote && remote.length) {
        setBrands((prev) => {
          const next = { ...prev };
          for (const b of remote) next[b.id] = b;
          return next;
        });
      }
    });
    const unsub = subscribeRemoteBrands((remote) => {
      setBrands((prev) => {
        const next = { ...prev };
        for (const b of remote) next[b.id] = b;
        return next;
      });
    });
    return () => unsub();
  }, []);

  useEffect(() => { saveStoredBrands(brands); }, [brands]);

  const brandsRef = useRef(brands);
  useEffect(() => { brandsRef.current = brands; }, [brands]);

  const getBrand = useCallback(
    (id: BrandId | 'all' | 'shared') =>
      (id === 'all' || id === 'shared' ? brands.pharmacozyme : brands[id] ?? brands.pharmacozyme),
    [brands],
  );

  const updateBrand = useCallback(async (id: BrandId, patch: Partial<BrandConfig>) => {
    const updated = { ...brandsRef.current[id], ...patch };
    setBrands((prev) => ({ ...prev, [id]: updated }));
    await upsertRemoteBrand(updated);
  }, []);

  const value = useMemo(() => ({ brands, getBrand, updateBrand }), [brands, getBrand, updateBrand]);
  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>;
};

export function useBrands(): BrandsContextValue {
  const ctx = useContext(BrandsContext);
  if (!ctx) throw new Error('useBrands must be used within a BrandsProvider');
  return ctx;
}
