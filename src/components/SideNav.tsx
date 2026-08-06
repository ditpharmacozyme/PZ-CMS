import React from 'react';
import { BrandId } from '../types';
import { BRANDS } from '../data/brands';

export type NavTab = 'calendar' | 'templates' | 'brand-kit' | 'assets' | 'telemetry' | 'appscript' | 'content-bank';

interface SideNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedBrandFilter: BrandId | 'all';
  onSelectBrandFilter: (brand: BrandId | 'all') => void;
  onOpenNewPostModal: () => void;
  className?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const SideNav: React.FC<SideNavProps> = ({
  currentTab,
  onSelectTab,
  selectedBrandFilter,
  onSelectBrandFilter,
  onOpenNewPostModal,
  className = '',
  isMobileOpen = false,
  onCloseMobile
}) => {
  const brandList = Object.values(BRANDS);

  const navItems: { tab: NavTab; label: string; icon: string }[] = [
    { tab: 'calendar', label: 'Calendar', icon: 'calendar_month' },
    { tab: 'templates', label: 'Templates', icon: 'quiz' },
    { tab: 'content-bank', label: 'Content Bank', icon: 'article' },
    { tab: 'brand-kit', label: 'Brand Kit', icon: 'palette' },
    { tab: 'assets', label: 'Assets', icon: 'layers' },
    { tab: 'telemetry', label: 'Dashboard', icon: 'monitoring' },
    { tab: 'appscript', label: 'Integrations', icon: 'terminal' }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`h-screen w-72 md:w-64 flex flex-col py-4 border-r border-[#bfcab4] bg-[#faf9f5] z-50 transition-transform duration-300 ease-in-out ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0 flex'
            : 'hidden md:flex sticky top-0'
        } ${className}`}
      >
        {/* Brand Header */}
        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Logo mark */}
              <div className="w-10 h-10 rounded bg-white border border-[#bfcab4] p-1 flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden">
                <img src="/logos/PZ_Logo.png" alt="Pharmacozyme" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-display-xl text-[17px] font-bold text-[#1b1c1a] leading-tight tracking-tight">
                  Pharmacozyme
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-label-caps text-[9px] text-[#296c00] tracking-widest uppercase font-bold">Brand-Ops Studio</span>
                  <span className="w-1 h-1 rounded-full bg-[#78d24b] animate-pulse inline-block" />
                </div>
              </div>
            </div>
            {isMobileOpen && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#707a67] hover:text-[#1b1c1a] active:bg-[#efeeea] rounded-full"
                title="Close Drawer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>

          {/* Brand Selector Pill */}
          <div className="mt-3 p-2 bg-[#efeeea] border border-[#bfcab4] rounded">
            <label className="font-label-caps text-[9px] text-[#707a67] block mb-1 uppercase">
              Ecosystem Brand Filter
            </label>
            <select
              value={selectedBrandFilter}
              onChange={(e) => onSelectBrandFilter(e.target.value as BrandId | 'all')}
              className="w-full bg-white border border-[#bfcab4] px-2 py-2 text-xs font-label-caps font-bold text-[#1b1c1a] focus:outline-none focus:border-[#296c00] h-10"
            >
              <option value="all">⚡ All 5 Brands (Overlaid)</option>
              {brandList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.shortCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Primary Brand Navigation Pills */}
        <div className="px-4 mb-4">
          <p className="font-label-caps text-[10px] text-[#707a67] px-2 mb-2 uppercase">
            Brand Workspaces
          </p>
          <div className="space-y-1">
            {brandList.map((brand) => {
              const isSelected = selectedBrandFilter === brand.id;
              return (
                <button
                  key={brand.id}
                  onClick={() => onSelectBrandFilter(brand.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all text-xs font-label-caps min-h-[40px] active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#aceecf] text-[#07513b] border-r-4 border-[#296c00] font-bold shadow-xs'
                      : 'text-[#404a39] hover:bg-[#e9e8e4]'
                  }`}
                >
                  {brand.logoUrl ? (
                    <div className="w-5 h-5 rounded bg-white p-0.5 border border-[#bfcab4]/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ color: brand.primaryColor }}
                    >
                      {brand.icon}
                    </span>
                  )}
                  <span className="truncate">{brand.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Tabs Navigation */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          <p className="font-label-caps text-[10px] text-[#707a67] px-3 mb-2 uppercase">
            Ops Navigation
          </p>
          {navItems.map((item) => {
            const isActive = currentTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => {
                  onSelectTab(item.tab);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left font-label-caps text-xs transition-all min-h-[44px] active:scale-[0.98] ${
                  isActive
                    ? 'nav-item-active text-[#296c00] font-bold'
                    : 'text-[#404a39] hover:bg-[#e9e8e4] border-l-[3px] border-transparent'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl ${
                    isActive ? 'filled' : ''
                  }`}
                  style={{ color: isActive ? '#296c00' : undefined }}
                >
                  {item.icon}
                </span>
                <span className="text-sm md:text-xs flex-1 truncate">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#296c00] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Action & Footer */}
        <div className="px-4 mt-auto pt-4 border-t border-[#bfcab4] space-y-2">
          <button
            onClick={() => {
              onOpenNewPostModal();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full bg-[#296c00] text-white font-label-caps text-xs py-3.5 px-4 rounded shadow-md hover:bg-[#1f5700] active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[48px] font-bold"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>New Post</span>
          </button>
        </div>
      </aside>
    </>
  );
};
