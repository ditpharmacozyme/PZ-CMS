import React, { useState } from 'react';

export type NavTab = 'my-work' | 'calendar' | 'templates' | 'brand-kit' | 'assets' | 'dashboard' | 'integrations' | 'content-bank' | 'research' | 'audit';

interface SideNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenNewPostModal: () => void;
  className?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type NavItem = { tab: NavTab; label: string; icon: string };

// The six primary pages — always visible, one click away regardless of
// which brand is currently selected in TopNav's brand picker.
const NAV_ITEMS: NavItem[] = [
  { tab: 'my-work', label: 'My Work', icon: 'checklist' },
  { tab: 'dashboard', label: 'Dashboard', icon: 'monitoring' },
  { tab: 'calendar', label: 'Calendar', icon: 'calendar_month' },
  { tab: 'templates', label: 'Templates', icon: 'quiz' },
  { tab: 'content-bank', label: 'Content Bank', icon: 'article' },
  { tab: 'research', label: 'Research & Plans', icon: 'lightbulb' }
];

// Secondary pages, tucked behind a collapsed "More" disclosure — two clicks
// (open More, then select) instead of one, in exchange for a shorter primary
// list.
const MORE_ITEMS: NavItem[] = [
  { tab: 'brand-kit', label: 'Brand Kit', icon: 'palette' },
  { tab: 'assets', label: 'Assets', icon: 'layers' },
  { tab: 'audit', label: 'Activity Log', icon: 'shield_person' },
  { tab: 'integrations', label: 'Integrations', icon: 'terminal' }
];

const COLLAPSE_KEY = 'pz_sidenav_collapsed';

export const SideNav: React.FC<SideNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewPostModal,
  className = '',
  isMobileOpen = false,
  onCloseMobile
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // "More" section — starts open if the current page lives inside it (so a
  // reload landing on e.g. Brand Kit doesn't leave the whole sidebar with no
  // active-state indicator at all), collapsed otherwise. Independent of the
  // desktop icon-only collapse above (that one hides labels app-wide; this
  // one just tucks away four secondary pages).
  const [moreOpen, setMoreOpen] = useState(() => MORE_ITEMS.some((i) => i.tab === currentTab));

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

  const toggleMore = () => {
    if (collapsed) {
      // Icon-only mode never shows expanded sub-items (same rule the old
      // brand-group expansion followed) — so clicking "More" while
      // collapsed un-collapses the sidebar first, otherwise the click
      // would appear to do nothing. In-memory only — deliberately does NOT
      // touch COLLAPSE_KEY, so a single "More" tap can't permanently clear
      // the user's saved desktop collapse preference (this reverts on
      // reload, same as the old brand-group expansion behavior did).
      setCollapsed(false);
      setMoreOpen(true);
    } else {
      setMoreOpen((prev) => !prev);
    }
  };

  const selectNavItem = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const renderNavButton = (item: NavItem) => {
    const isActive = currentTab === item.tab;
    return (
      <button
        key={item.tab}
        onClick={() => selectNavItem(item.tab)}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all text-xs font-label-caps min-h-[44px] active:scale-[0.98] ${
          collapsed ? 'justify-center px-0' : ''
        } ${
          isActive
            ? 'bg-[#eef2ff] text-[#4338ca] font-bold shadow-xs'
            : 'text-[#57574f] hover:bg-[#e9e8e4]'
        }`}
      >
        <span
          className={`material-symbols-outlined text-lg flex-shrink-0 ${isActive ? 'filled' : ''}`}
          style={{ color: isActive ? '#4338ca' : undefined }}
        >
          {item.icon}
        </span>
        {!collapsed && <span className="text-sm md:text-xs flex-1 truncate">{item.label}</span>}
      </button>
    );
  };

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
        className={`h-screen flex flex-col py-4 border-r border-[#e9e9e7] bg-[#f4f4f3] z-50 transition-all duration-200 ease-in-out ${
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
              <div className="w-10 h-10 rounded bg-white border border-[#e9e9e7] p-1 flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden">
                <img src="/logos/PZ_Logo.png" alt="Pharmacozyme" className="w-full h-full object-contain" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="font-display-xl text-[17px] font-bold text-[#1b1c1a] leading-tight tracking-tight truncate">
                    Pharmacozyme
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-label-caps text-[9px] text-[#4f46e5] tracking-widest uppercase font-bold">Brand-Ops Studio</span>
                    <span className="w-1 h-1 rounded-full bg-[#15803d] animate-pulse inline-block" />
                  </div>
                </div>
              )}
            </div>
            {isMobileOpen && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#5f5f5b] hover:text-[#1b1c1a] active:bg-[#f1f1f0] rounded-full"
                title="Close Drawer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
            {/* Collapse toggle — desktop only, mobile always uses the full drawer */}
            <button
              onClick={toggleCollapsed}
              className={`hidden md:flex p-2 min-w-[36px] min-h-[36px] items-center justify-center text-[#5f5f5b] hover:text-[#1b1c1a] hover:bg-[#f1f1f0] rounded-full transition-colors ${collapsed ? 'rotate-180' : ''}`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-lg">left_panel_close</span>
            </button>
          </div>
        </div>

        {/* Flat page list — brand selection lives in TopNav now, entirely
            independent of which page is open. */}
        <nav className={`flex-1 space-y-1 overflow-y-auto scrollbar-thin ${collapsed ? 'px-2' : 'px-3'}`}>
          {NAV_ITEMS.map(renderNavButton)}

          <div>
            {(() => {
              // "Your active page lives inside a collapsed More section" —
              // the More button itself needs to signal this, since none of
              // the primary items nor the (hidden) More items can.
              const activeInMore = !moreOpen && MORE_ITEMS.some((i) => i.tab === currentTab);
              return (
                <button
                  onClick={toggleMore}
                  title={collapsed ? 'More' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all text-xs font-label-caps min-h-[44px] active:scale-[0.98] ${
                    collapsed ? 'justify-center px-0' : ''
                  } ${
                    activeInMore
                      ? 'bg-[#eef2ff] text-[#4338ca] font-bold shadow-xs'
                      : 'text-[#57574f] hover:bg-[#e9e8e4]'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-lg flex-shrink-0 ${activeInMore ? 'filled' : ''}`}
                    style={{ color: activeInMore ? '#4338ca' : undefined }}
                  >
                    more_horiz
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">More</span>
                      <span
                        className={`material-symbols-outlined text-base flex-shrink-0 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                      >
                        expand_more
                      </span>
                    </>
                  )}
                </button>
              );
            })()}

            {!collapsed && moreOpen && (
              <div className="ml-4 pl-3 border-l-2 border-[#e9e9e7] mt-1 mb-2 space-y-0.5">
                {MORE_ITEMS.map((item) => {
                  const isActive = currentTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => selectNavItem(item.tab)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-label-caps text-xs transition-all min-h-[40px] active:scale-[0.98] ${
                        isActive
                          ? 'nav-item-active text-[#4f46e5] font-bold'
                          : 'text-[#57574f] hover:bg-[#e9e8e4]'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-base ${isActive ? 'filled' : ''}`}
                        style={{ color: isActive ? '#4f46e5' : undefined }}
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
        </nav>

        {/* Action & Footer */}
        <div className={`mt-auto pt-4 border-t border-[#e9e9e7] ${collapsed ? 'px-2' : 'px-4'}`}>
          <button
            onClick={() => {
              onOpenNewPostModal();
              if (onCloseMobile) onCloseMobile();
            }}
            title={collapsed ? 'New Post' : undefined}
            className={`w-full bg-[#4f46e5] text-white font-label-caps text-xs py-3.5 rounded shadow-md hover:bg-[#4338ca] active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[48px] font-bold ${
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
