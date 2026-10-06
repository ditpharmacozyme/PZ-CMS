import React, { useState, useMemo, useEffect } from 'react';
import { Tutorial, BrandId, TeamMember } from '../types';
import { useBrands } from '../context/BrandsContext';
import { useConfirm } from './ui/ConfirmDialog';
import { useTutorials } from '../hooks/useTutorials';
import { useTutorialCategories } from '../hooks/useTutorialCategories';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from '../utils/tutorialCategories';
import { canManageTutorial } from '../utils/tutorialOwnership';
import { TutorialCard } from './tutorials/TutorialCard';
import { TutorialWatchPage } from './tutorials/TutorialWatchPage';
import { TutorialEditorModal } from './tutorials/TutorialEditorModal';
import { TutorialCategoryModal } from './tutorials/TutorialCategoryModal';

interface TutorialsLibraryProps {
  selectedBrandFilter: BrandId | 'all';
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
  onLogAudit?: (event: any) => void;
}

export const TutorialsLibrary: React.FC<TutorialsLibraryProps> = ({
  selectedBrandFilter,
  activeTeammate
}) => {
  const confirm = useConfirm();
  const { brands } = useBrands();
  const {
    tutorials,
    addTutorial,
    updateTutorial,
    deleteTutorial,
    setTutorialsList
  } = useTutorials();

  const {
    categories,
    addCategory,
    renameCategory,
    deleteCategory,
    reorderCategories
  } = useTutorialCategories();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<BrandId | 'shared' | 'all'>('all');

  // Active YouTube-style watch tutorial state
  const [selectedTutorialId, setSelectedTutorialId] = useState<string | null>(null);

  // Modals state
  const [editorTutorial, setEditorTutorial] = useState<Tutorial | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Sync tutorial selection from URL query param `?tutorial=id`
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tutId = params.get('tutorial');
    if (tutId && tutorials.length > 0) {
      const found = tutorials.find((t) => t.id === tutId);
      if (found) {
        setSelectedTutorialId(found.id);
      }
    }
  }, [tutorials]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tutId = params.get('tutorial');
      setSelectedTutorialId(tutId || null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Filtered tutorials for the library view
  const filteredTutorials = useMemo(() => {
    return tutorials.filter((t) => {
      if (brandFilter !== 'all') {
        if (t.brandId !== brandFilter) return false;
      } else if (selectedBrandFilter !== 'all') {
        if (t.brandId !== 'shared' && t.brandId !== selectedBrandFilter) return false;
      }

      if (activeCategoryFilter !== 'all') {
        if ((t.category || '').toLowerCase() !== activeCategoryFilter.toLowerCase()) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = t.description.toLowerCase().includes(q);
        const tagMatch = t.tags.some((tag) => tag.toLowerCase().includes(q));
        const promptMatch = t.prompts?.some(
          (p) => p.title.toLowerCase().includes(q) || p.promptText.toLowerCase().includes(q)
        );
        const linkMatch = t.links?.some((l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !tagMatch && !promptMatch && !linkMatch) {
          return false;
        }
      }

      return true;
    });
  }, [tutorials, brandFilter, selectedBrandFilter, activeCategoryFilter, searchQuery]);

  // Currently viewed tutorial on the YouTube watch page
  const activeTutorial = useMemo(() => {
    if (!selectedTutorialId) return null;
    return tutorials.find((t) => t.id === selectedTutorialId) || null;
  }, [selectedTutorialId, tutorials]);

  // Handlers for switching views
  const handleOpenTutorialWatch = (t: Tutorial) => {
    setSelectedTutorialId(t.id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tutorial', t.id);
      window.history.pushState({}, '', url.toString());
    } catch {
      // Ignore URL history errors in tests or restricted iframes
    }
  };

  const handleBackToLibrary = () => {
    setSelectedTutorialId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tutorial');
      window.history.pushState({}, '', url.toString());
    } catch {
      // Ignore
    }
  };

  // Handlers for creating/editing
  const handleOpenCreate = () => {
    setEditorTutorial(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (t: Tutorial) => {
    if (!canManageTutorial(t, activeTeammate)) {
      alert('Only the teammate who uploaded this tutorial can edit it.');
      return;
    }
    setEditorTutorial(t);
    setIsEditorOpen(true);
  };

  const handleSaveTutorial = async (
    data: Omit<Tutorial, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string
  ) => {
    if (id) {
      const existing = tutorials.find((t) => t.id === id);
      if (existing) {
        if (!canManageTutorial(existing, activeTeammate)) {
          alert('Only the teammate who uploaded this tutorial can edit it.');
          return;
        }
        await updateTutorial({
          ...existing,
          ...data,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      const created = await addTutorial({
        ...data,
        createdBy: activeTeammate?.name || 'Team'
      });
      // Optionally jump right into the created tutorial
      if (created) {
        handleOpenTutorialWatch(created);
      }
    }
  };

  const handleDeleteTutorial = async (t: Tutorial) => {
    if (!canManageTutorial(t, activeTeammate)) {
      alert('Only the teammate who uploaded this tutorial can delete it.');
      return;
    }

    const ok = await confirm({
      title: `Delete tutorial "${t.title}"?`,
      body: 'This will permanently remove the tutorial, video links, attached prompts, and resources.',
      confirmLabel: 'Delete Tutorial',
      tone: 'danger'
    });
    if (!ok) return;

    if (selectedTutorialId === t.id) {
      handleBackToLibrary();
    }
    await deleteTutorial(t.id);
  };

  // Category cascade handlers
  const handleRenameCategoryWithCascade = async (oldName: string, newName: string): Promise<boolean> => {
    const ok = await renameCategory(oldName, newName);
    if (!ok) return false;

    const updated = applyCategoryRename(tutorials, oldName, newName);
    await setTutorialsList(updated);
    if (activeCategoryFilter.toLowerCase() === oldName.toLowerCase()) {
      setActiveCategoryFilter(newName);
    }
    return true;
  };

  const handleDeleteCategoryWithCascade = async (name: string): Promise<void> => {
    await addCategory(UNCATEGORIZED);
    const updated = applyCategoryDelete(tutorials, name);
    await setTutorialsList(updated);
    await deleteCategory(name);
    if (activeCategoryFilter.toLowerCase() === name.toLowerCase()) {
      setActiveCategoryFilter('all');
    }
  };

  // ── YOUTUBE-STYLE WATCH VIEW ──
  // If a tutorial is selected, transition to the full YouTube-like Watch Page
  if (activeTutorial) {
    const brand = activeTutorial.brandId !== 'shared' ? brands[activeTutorial.brandId] : undefined;

    return (
      <>
        <TutorialWatchPage
          tutorial={activeTutorial}
          allTutorials={filteredTutorials.length > 0 ? filteredTutorials : tutorials}
          brand={brand}
          brands={brands}
          activeTeammate={activeTeammate}
          onBack={handleBackToLibrary}
          onSelectTutorial={handleOpenTutorialWatch}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteTutorial}
        />

        {/* Editor Modal for editing if uploader clicks Edit Video in the watch page */}
        <TutorialEditorModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditorTutorial(null);
          }}
          tutorial={editorTutorial}
          categories={categories}
          defaultBrand={selectedBrandFilter === 'all' ? 'shared' : selectedBrandFilter}
          onSave={handleSaveTutorial}
          onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
        />
      </>
    );
  }

  // ── TUTORIALS LIBRARY GRID VIEW (YouTube Channel / Browse Library) ──
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#efefed]">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4f46e5] text-xl">school</span>
            <span className="font-label-caps text-xs text-[#4f46e5] font-bold tracking-widest">
              Knowledge Hub
            </span>
          </div>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Tutorials & Courses
          </h2>
          <p className="font-body-md text-xs text-[#5f5f5b] mt-0.5">
            Internal video courses, YouTube & Drive tutorials, SOPs, copyable prompts, and reference files.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 bg-white border border-[#e9e9e7] hover:bg-[#f4f4f3] text-[#57574f] rounded-xl font-label-caps text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[42px]"
          >
            <span className="material-symbols-outlined text-sm">tune</span>
            <span className="whitespace-nowrap">Manage categories</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial justify-center bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 font-bold cursor-pointer min-h-[42px]"
          >
            <span className="material-symbols-outlined text-base">add_box</span>
            <span className="whitespace-nowrap">+ New Tutorial</span>
          </button>
        </div>
      </div>

      {/* ── Search & Brand Filter ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#f4f4f3] p-3 rounded-xl border border-[#efefed]">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#5f5f5b]">
            search
          </span>
          <input
            type="text"
            placeholder="Search tutorials, prompts, topics, or links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-[#e9e9e7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4f46e5] text-[#1b1c1a] placeholder-[#5f5f5b]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5f5f5b] hover:text-[#1b1c1a] p-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          )}
        </div>

        {/* Brand Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {([['all', 'All Brands'], ['shared', 'Shared']] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setBrandFilter(val as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer whitespace-nowrap ${
                brandFilter === val
                  ? 'bg-[#4f46e5] text-white shadow-xs'
                  : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0]'
              }`}
            >
              {label}
            </button>
          ))}
          {Object.values(brands).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBrandFilter(b.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer whitespace-nowrap ${
                brandFilter === b.id
                  ? 'bg-[#4f46e5] text-white shadow-xs'
                  : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0]'
              }`}
            >
              {b.shortCode}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category Filter Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategoryFilter('all')}
          className={`px-3.5 py-2 font-label-caps text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeCategoryFilter === 'all'
              ? 'bg-[#1b1c1a] text-white font-bold shadow-md'
              : 'bg-white border border-[#efefed] text-[#57574f] hover:bg-[#f1f1f0]'
          }`}
        >
          <span className="material-symbols-outlined text-sm">grid_view</span>
          <span>All Tutorials</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 tabular-nums">
            {tutorials.length}
          </span>
        </button>

        {categories.map((cat) => {
          const count = tutorials.filter(
            (t) => (t.category || '').toLowerCase() === cat.name.toLowerCase()
          ).length;
          const isActive = activeCategoryFilter.toLowerCase() === cat.name.toLowerCase();

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryFilter(cat.name)}
              className={`px-3.5 py-2 font-label-caps text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-[#1b1c1a] text-white font-bold shadow-md'
                  : 'bg-white border border-[#efefed] text-[#57574f] hover:bg-[#f1f1f0]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">sell</span>
              <span>{cat.name}</span>
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${isActive ? 'bg-white/20' : 'bg-[#efefed] text-[#57574f]'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Results summary ── */}
      {(searchQuery || activeCategoryFilter !== 'all' || brandFilter !== 'all') && (
        <p className="font-body-md text-xs text-[#5f5f5b]">
          Showing <span className="font-bold text-[#1b1c1a]">{filteredTutorials.length}</span> of {tutorials.length} tutorials
        </p>
      )}

      {/* ── Grid of Tutorial Cards (YouTube Browse View) ── */}
      {filteredTutorials.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-[#efefed] text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#eef2ff] text-[#4f46e5] flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">school</span>
          </div>
          <div>
            <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
              No tutorials found
            </h3>
            <p className="font-body-md text-xs text-[#5f5f5b] max-w-sm mt-1">
              {searchQuery || activeCategoryFilter !== 'all' || brandFilter !== 'all'
                ? 'Try adjusting your search, category, or brand filter.'
                : 'Add your first video course, Google Drive tutorial, or internal team SOP.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_box</span>
            <span>+ Add Tutorial</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredTutorials.map((tut) => {
            const brand = tut.brandId !== 'shared' ? brands[tut.brandId] : undefined;
            return (
              <TutorialCard
                key={tut.id}
                tutorial={tut}
                brand={brand}
                activeTeammate={activeTeammate}
                onOpenDetail={handleOpenTutorialWatch}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTutorial}
              />
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <TutorialEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditorTutorial(null);
        }}
        tutorial={editorTutorial}
        categories={categories}
        defaultBrand={selectedBrandFilter === 'all' ? 'shared' : selectedBrandFilter}
        onSave={handleSaveTutorial}
        onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
      />

      {/* Category Manager Modal */}
      <TutorialCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onAddCategory={addCategory}
        onRenameCategory={handleRenameCategoryWithCascade}
        onDeleteCategory={handleDeleteCategoryWithCascade}
        onReorderCategories={reorderCategories}
      />
    </div>
  );
};
