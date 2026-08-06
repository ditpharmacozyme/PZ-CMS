import React, { useEffect, useState } from 'react';
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

const NAV_ITEMS: { tab: NavTab; label: string; icon: string }[] = [
  { tab: 'telemetry', label: 'Dashboard', icon: 'monitoring' },
  { tab: 'calendar', label: 'Calendar', icon: 'calendar_month' },
  { tab: 'templates', label: 'Templates', icon: 'quiz' },
  { tab: 'content-bank', label: 'Content Bank', icon: 'article' },
  { tab: 'brand-kit', label: 'Brand Kit', icon: 'palette' },
  { tab: 'assets', label: 'Assets', icon: 'layers' }
];

const COLLAPSE_KEY = 'pz_sidenav_collapsed';

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

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Which group's nav items are expanded — follows the active brand filter
  // so the sidebar always shows where you are, but can be toggled shut.
  const [expandedGroup, setExpandedGroup] = useState<BrandId | 'all'>(selectedBrandFilter);

  useEffect(() => {
    setExpandedGroup(selectedBrandFilter);
  }, [selectedBrandFilter]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // localStorage unavailable — collapse state just won't persist
      }
      return next;
    });
  };

  const selectGroup = (group: BrandId | 'all') => {
    onSelectBrandFilter(group);
    setExpandedGroup((prev) => (prev === group ? prev : group));
    if (collapsed) setCollapsed(false);
  };

  const selectNavItem = (group: BrandId | 'all', tab: NavTab) => {
    onSelectBrandFilter(group);
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const groups: { id: BrandId | 'all'; label: string; shortCode: string; icon: string; logoUrl?: string; color?: string }[] = [
    { id: 'all', label: 'All 5 Brands', shortCode: 'ALL', icon: 'hub' },
    ...brandList.map((b) => ({ id: b.id, label: b.name, shortCode: b.shortCode, icon: b.icon, logoUrl: b.logoUrl, color: b.primaryColor }))
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
        className={`h-screen flex flex-col py-4 border-r border-[#bfcab4] bg-[#faf9f5] z-50 transition-all duration-200 ease-in-out ${
          collapsed ? 'md:w-16' : 'w-72 md:w-64'
        } ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 w-72 shadow-2xl translate-x-0 flex'
            : 'hidden md:flex sticky top-0'
        } ${className}`}
      >
        {/* Brand Header */}
        <div className={`mb-5 ${collapsed ? 'px-2' : 'px-5'}`}>
          <div className={`flex items-center mb-2 ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''} min-w-0`}>
              <div className="w-10 h-10 rounded bg-white border border-[#bfcab4] p-1 flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden">
                <img src="/logos/PZ_Logo.png" alt="Pharmacozyme" className="w-full h-full object-contain" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="font-display-xl text-[17px] font-bold text-[#1b1c1a] leading-tight tracking-tight truncate">
                    Pharmacozyme
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-label-caps text-[9px] text-[#296c00] tracking-widest uppercase font-bold">Brand-Ops Studio</span>
                    <span className="w-1 h-1 rounded-full bg-[#78d24b] animate-pulse inline-block" />
                  </div>
                </div>
              )}
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
            {/* Collapse toggle — desktop only, mobile always uses the full drawer */}
            <button
              onClick={toggleCollapsed}
              className={`hidden md:flex p-2 min-w-[36px] min-h-[36px] items-center justify-center text-[#707a67] hover:text-[#1b1c1a] hover:bg-[#efeeea] rounded-full transition-colors ${collapsed ? 'rotate-180' : ''}`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-lg">left_panel_close</span>
            </button>
          </div>
        </div>

        {/* Brand Groups — each expands to its own nav items, so brand switching
            and page navigation happen in one place instead of two separate lists. */}
        <nav className={`flex-1 space-y-1 overflow-y-auto scrollbar-thin ${collapsed ? 'px-2' : 'px-3'}`}>
          {groups.map((group) => {
            const isGroupSelected = selectedBrandFilter === group.id;
            const isExpanded = !collapsed && expandedGroup === group.id;

            return (
              <div key={group.id}>
                <button
                  onClick={() => selectGroup(group.id)}
                  title={collapsed ? group.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all text-xs font-label-caps min-h-[44px] active:scale-[0.98] ${
                    collapsed ? 'justify-center px-0' : ''
                  } ${
                    isGroupSelected
                      ? 'bg-[#aceecf] text-[#07513b] font-bold shadow-xs'
                      : 'text-[#404a39] hover:bg-[#e9e8e4]'
                  }`}
                >
                  {group.logoUrl ? (
                    <div className="w-5 h-5 rounded bg-white p-0.5 border border-[#bfcab4]/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img src={group.logoUrl} alt={group.label} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: group.color }}>
                      {group.icon}
                    </span>
                  )}
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{group.label}</span>
                      <span
                        className={`material-symbols-outlined text-base flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        expand_more
                      </span>
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-[#bfcab4] mt-1 mb-2 space-y-0.5">
                    {NAV_ITEMS.map((item) => {
                      const isActive = currentTab === item.tab && isGroupSelected;
                      return (
                        <button
                          key={item.tab}
                          onClick={() => selectNavItem(group.id, item.tab)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-label-caps text-xs transition-all min-h-[40px] active:scale-[0.98] ${
                            isActive
                              ? 'nav-item-active text-[#296c00] font-bold'
                              : 'text-[#404a39] hover:bg-[#e9e8e4]'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-base ${isActive ? 'filled' : ''}`}
                            style={{ color: isActive ? '#296c00' : undefined }}
                          >
                            {item.icon}
                          </span>
                          <span className="text-sm md:text-xs flex-1 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Action & Footer */}
        <div className={`mt-auto pt-4 border-t border-[#bfcab4] ${collapsed ? 'px-2' : 'px-4'}`}>
          <button
            onClick={() => {
              onOpenNewPostModal();
              if (onCloseMobile) onCloseMobile();
            }}
            title={collapsed ? 'New Post' : undefined}
            className={`w-full bg-[#296c00] text-white font-label-caps text-xs py-3.5 rounded shadow-md hover:bg-[#1f5700] active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[48px] font-bold ${
              collapsed ? 'px-0' : 'px-4'
            }`}
          >
            <span className="material-symbols-outlined text-base">add</span>
            {!collapsed && <span>New Post</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
