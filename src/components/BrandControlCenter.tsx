import React, { useState } from 'react';
import { BrandId } from '../types';
import { BRANDS } from '../data/brands';

interface BrandControlCenterProps {
  selectedBrandFilter: BrandId | 'all';
  onSelectBrandFilter: (brand: BrandId | 'all') => void;
}

export const BrandControlCenter: React.FC<BrandControlCenterProps> = ({
  selectedBrandFilter,
  onSelectBrandFilter
}) => {
  const [activeBrandId, setActiveBrandId] = useState<BrandId>(
    selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter
  );
  const [specGridActive, setSpecGridActive] = useState<boolean>(true);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const brand = BRANDS[activeBrandId];

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  return (
    <div className={`p-4 md:p-8 space-y-8 max-w-7xl mx-auto ${specGridActive ? 'spec-grid' : ''}`}>
      {/* Header & Spec Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bfcab4] bg-white/80 p-4 rounded backdrop-blur-xs">
        <div>
          <span className="font-label-caps text-xs text-[#296951] font-bold uppercase tracking-widest">
            Visual Identity
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Brand Kit
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Spec Grid Toggle */}
          <button
            onClick={() => setSpecGridActive(!specGridActive)}
            className={`px-3 py-1.5 font-label-caps text-xs rounded border transition-all flex items-center gap-2 ${
              specGridActive
                ? 'bg-[#296c00] text-white border-[#296c00] font-bold'
                : 'bg-white text-[#707a67] border-[#bfcab4]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">grid_3x3</span>
            <span>Spec Grid: {specGridActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Brand Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Object.values(BRANDS).map((b) => {
          const isActive = activeBrandId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => {
                setActiveBrandId(b.id);
                onSelectBrandFilter(b.id);
              }}
              style={{
                borderColor: isActive ? b.primaryColor : '#bfcab4',
                color: isActive ? b.primaryColor : '#404a39'
              }}
              className={`px-4 py-2 font-label-caps text-xs rounded border font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive ? 'bg-white shadow-xs scale-105' : 'bg-[#faf9f5] hover:bg-white'
              }`}
            >
              {b.logoUrl ? (
                <div className="w-5 h-5 rounded bg-white p-0.5 border border-[#bfcab4]/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <img src={b.logoUrl} alt={b.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <span className="material-symbols-outlined text-base" style={{ color: b.primaryColor }}>
                  {b.icon}
                </span>
              )}
              <span>{b.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Brand Overview Card */}
      <div className="bg-white border border-[#bfcab4] p-6 rounded shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bfcab4]">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded bg-white p-2 border border-[#bfcab4] flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden"
            >
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-3xl" style={{ color: brand.primaryColor }}>{brand.icon}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display-xl text-2xl font-bold text-[#1b1c1a]">{brand.name}</h3>
                <span className="font-code-sm text-xs bg-[#efeeea] px-2 py-0.5 rounded text-[#707a67]">
                  {brand.shortCode}
                </span>
              </div>
              <p className="font-body-md text-sm text-[#296951] font-bold mt-0.5">{brand.tagline}</p>
            </div>
          </div>
        </div>

        {/* Color Palette Dials Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-label-caps text-xs font-bold text-[#296c00] uppercase">
              1. Color Palette & Hex Dials
            </h4>
            {copiedHex && (
              <span className="font-label-caps text-xs font-bold text-[#296c00] animate-pulse">
                Copied {copiedHex} to clipboard!
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Primary Brand', hex: brand.primaryColor },
              { label: 'Secondary Tint', hex: brand.secondaryColor },
              { label: 'Deep Accent', hex: brand.accentColor },
              { label: 'Surface Warm', hex: brand.surfaceColor }
            ].map((col, i) => (
              <div
                key={i}
                onClick={() => handleCopy(col.hex)}
                className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded cursor-pointer hover:border-[#296c00] transition-all group"
              >
                <div
                  className="h-16 w-full rounded border border-[#bfcab4] mb-2 shadow-inner group-hover:scale-102 transition-transform"
                  style={{ backgroundColor: col.hex }}
                />
                <span className="font-label-caps text-[10px] text-[#707a67] block uppercase">
                  {col.label}
                </span>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-code-sm text-xs font-bold text-[#1b1c1a]">{col.hex}</span>
                  <span className="material-symbols-outlined text-xs text-[#707a67] group-hover:text-[#296c00]">
                    content_copy
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography Scale Section */}
        <div className="space-y-3 pt-4 border-t border-[#bfcab4]">
          <h4 className="font-label-caps text-xs font-bold text-[#296c00] uppercase">
            2. Typography Specimen Scale
          </h4>

          <div className="space-y-4 bg-[#faf9f5] p-5 border border-[#bfcab4] rounded">
            <div>
              <span className="font-label-caps text-[10px] text-[#707a67] uppercase block mb-1">
                Display XL (Space Grotesk 700)
              </span>
              <p className="font-display-xl text-3xl font-bold text-[#1b1c1a]">
                Precision Enzymatic Therapeutics
              </p>
            </div>

            <div>
              <span className="font-label-caps text-[10px] text-[#707a67] uppercase block mb-1">
                Technical Labels (Space Mono 700 Caps)
              </span>
              <p className="font-label-caps text-sm text-[#296951] font-bold tracking-wider uppercase">
                PHASE_4_SYNTHESIS_TELEMETRY // BATCH_442
              </p>
            </div>

            <div>
              <span className="font-label-caps text-[10px] text-[#707a67] uppercase block mb-1">
                Body Copy (Nunito Sans 400)
              </span>
              <p className="font-body-md text-sm text-[#404a39] max-w-2xl">
                {brand.description}
              </p>
            </div>
          </div>
        </div>

        {/* Voice & Tone Rules */}
        <div className="space-y-3 pt-4 border-t border-[#bfcab4]">
          <h4 className="font-label-caps text-xs font-bold text-[#296c00] uppercase">
            3. Editorial Voice & Guardrails
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {brand.voiceRules.map((rule, idx) => (
              <div key={idx} className="p-4 bg-[#faf9f5] border border-[#bfcab4] rounded">
                <span className="font-label-caps text-[10px] text-[#296c00] font-bold block mb-1">
                  RULE 0{idx + 1}
                </span>
                <p className="font-body-md text-xs text-[#1b1c1a]">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
