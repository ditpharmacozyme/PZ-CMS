import React, { useState, useMemo } from 'react';
import { Tutorial, BrandId, TeamMember } from '../types';
import { useBrands } from '../context/BrandsContext';
import { useConfirm } from './ui/ConfirmDialog';
import { useTutorials } from '../hooks/useTutorials';
import { useTutorialCategories } from '../hooks/useTutorialCategories';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from '../utils/tutorialCategories';
import { TutorialCard } from './tutorials/TutorialCard';
import { TutorialDetailModal } from './tutorials/TutorialDetailModal';
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

  // Modals state
  const [detailTutorial, setDetailTutorial] = useState<Tutorial | null>(null);
  const [editorTutorial, setEditorTutorial] = useState<Tutorial | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Filtered tutorials
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

  // Handlers
  const handleOpenCreate = () => {
    setEditorTutorial(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (t: Tutorial) => {
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
        await updateTutorial({
          ...existing,
          ...data,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      await addTutorial({
        ...data,
        createdBy: activeTeammate?.name || 'Team'
      });
    }
  };

  const handleDeleteTutorial = async (t: Tutorial) => {
    const ok = await confirm({
      title: `Delete tutorial "${t.title}"?`,
      body: 'This will permanently remove the tutorial, video links, attached prompts, and resources.',
      confirmLabel: 'Delete Tutorial',
      tone: 'danger'
    });
    if (!ok) return;

    if (detailTutorial?.id === t.id) {
      setDetailTutorial(null);
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

  const detailIndex = detailTutorial ? filteredTutorials.findIndex((t) => t.id === detailTutorial.id) : -1;
  const hasPrev = detailIndex > 0;
  const hasNext = detailIndex >= 0 && detailIndex < filteredTutorials.length - 1;

  const handleNavigatePrev = () => {
    if (hasPrev) {
      setDetailTutorial(filteredTutorials[detailIndex - 1]);
    }
  };

  const handleNavigateNext = () => {
    if (hasNext) {
      setDetailTutorial(filteredTutorials[detailIndex + 1]);
    }
  };

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

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 bg-white border border-[#e9e9e7] hover:bg-[#f4f4f3] text-[#57574f] rounded-xl font-label-caps text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">tune</span>
            <span>Manage categories</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_box</span>
            <span>+ New Tutorial</span>
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

      {/* ── Grid of Tutorial Cards ── */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTutorials.map((tut) => {
            const brand = tut.brandId !== 'shared' ? brands[tut.brandId] : undefined;
            return (
              <TutorialCard
                key={tut.id}
                tutorial={tut}
                brand={brand}
                onOpenDetail={setDetailTutorial}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTutorial}
              />
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <TutorialDetailModal
        isOpen={!!detailTutorial}
        onClose={() => setDetailTutorial(null)}
        tutorial={detailTutorial}
        brand={detailTutorial && detailTutorial.brandId !== 'shared' ? brands[detailTutorial.brandId] : undefined}
        onEdit={handleOpenEdit}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        currentIndex={detailIndex >= 0 ? detailIndex : 0}
        totalCount={filteredTutorials.length}
      />

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
