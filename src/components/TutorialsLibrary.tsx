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
      // 1. Global Brand filter or local brand filter
      if (brandFilter !== 'all') {
        if (t.brandId !== brandFilter) return false;
      } else if (selectedBrandFilter !== 'all') {
        // Respect top nav selected brand
        if (t.brandId !== 'shared' && t.brandId !== selectedBrandFilter) return false;
      }

      // 2. Category filter
      if (activeCategoryFilter !== 'all') {
        if ((t.category || '').toLowerCase() !== activeCategoryFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Search query
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

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-2xl text-indigo-500">school</span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tutorials & Courses
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Internal video courses, YouTube & Drive tutorials, SOPs, copyable prompts, and reference files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700/60"
          >
            <span className="material-symbols-outlined text-sm">settings</span>
            <span>Manage Categories</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm shadow-indigo-600/30"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>New Tutorial</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search tutorials, prompts, topics, or links..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>

          {/* Brand Scope Filter Select */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-400 font-medium">Brand:</span>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Brands</option>
              <option value="shared">Shared Only</option>
              {Object.values(brands).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800/80 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeCategoryFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Categories</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {tutorials.length}
            </span>
          </button>

          {categories.map((cat) => {
            const count = tutorials.filter(
              (t) => (t.category || '').toLowerCase() === cat.name.toLowerCase()
            ).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeCategoryFilter.toLowerCase() === cat.name.toLowerCase()
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.name}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700/80">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Tutorial Cards */}
      {filteredTutorials.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">school</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No tutorials found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            {searchQuery || activeCategoryFilter !== 'all' || brandFilter !== 'all'
              ? 'Try adjusting your search keywords, category, or brand filter.'
              : 'Add your first video course, Google Drive tutorial, or internal team SOP.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Add Tutorial</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Detail Modal with in-app video player */}
      <TutorialDetailModal
        isOpen={!!detailTutorial}
        onClose={() => setDetailTutorial(null)}
        tutorial={detailTutorial}
        brand={detailTutorial && detailTutorial.brandId !== 'shared' ? brands[detailTutorial.brandId] : undefined}
        onEdit={handleOpenEdit}
      />

      {/* Editor Modal for create / edit */}
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
