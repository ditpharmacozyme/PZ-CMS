import React, { useState, useRef, useMemo } from 'react';
import { PostTemplate, BrandId, Platform } from '../types';
import { useBrands } from '../context/BrandsContext';
import { uploadImage } from '../utils/uploadImage';
import { copyText } from '../utils/clipboard';
import { useConfirm } from './ui/ConfirmDialog';
import { useTemplateCategories } from '../hooks/useTemplateCategories';
import { applyCategoryRename, applyCategoryDelete, UNCATEGORIZED } from '../utils/templateCategories';

interface TemplateLibraryProps {
  templates: PostTemplate[];
  onUseTemplate: (template: PostTemplate) => void;
  onSaveNewTemplate: (template: PostTemplate) => void;
  onUpdateTemplate: (template: PostTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  selectedBrandFilter: BrandId | 'all';
}

// Icons/labels for the built-in category names. `category` is now a free
// string (users can add their own via Task 10), so this is a lookup with a
// fallback rather than an exhaustive map -- see categoryMeta() below.
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  Clinical: { label: 'Clinical & Case Studies', icon: 'biotech' },
  Interactive: { label: 'Quizzes & Diagnostics', icon: 'quiz' },
  Editorial: { label: 'Protocols & Alerts', icon: 'newspaper' },
  'Patient-Facing': { label: 'Patient Guides', icon: 'health_and_safety' },
  Internal: { label: 'Internal / Team Use', icon: 'lock' }
};

const DEFAULT_CATEGORY_ICON = 'sell';
const categoryMeta = (name: string) => CATEGORY_META[name] ?? { label: name, icon: DEFAULT_CATEGORY_ICON };

// Maps the app-level brand filter (or a modal Brand value) to the scope key
// used by useTemplateCategories / the templateCategories helpers.
const toCatScope = (brand: BrandId | 'all' | 'shared'): BrandId | 'shared' =>
  brand === 'all' ? 'shared' : brand;

const PLATFORM_ICONS: Record<string, string> = {
  instagram: 'photo_camera',
  linkedin: 'work',
  twitter: 'tag',
  web: 'language',
  email: 'mail'
};

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  templates,
  onUseTemplate,
  onSaveNewTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  selectedBrandFilter
}) => {
  const confirm = useConfirm();
  const { brands } = useBrands();
  const { categoriesFor, addCategory, renameCategory, deleteCategory, reorderCategories } = useTemplateCategories();
  // Category scope for the browse chips + "Manage categories" panel: the
  // app-selected brand, or 'shared' when the app filter is "all".
  const catScope = toCatScope(selectedBrandFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [activeBrandFilter, setActiveBrandFilter] = useState<BrandId | 'all' | 'shared'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [newDesc, setNewDesc] = useState('');
  const [newBrandId, setNewBrandId] = useState<BrandId | 'shared'>('shared');
  const [newCategory, setNewCategory] = useState<string>('Clinical');
  const [newPlatform, setNewPlatform] = useState<Platform>('instagram');
  const [newCaption, setNewCaption] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Caption / Tags / Image (plus Description & Platform) live behind this
  // disclosure -- only Name, Brand, Category are always visible.
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Inline feedback for the thumbnail "Copy link" action -- spec §3 Phase D
  // wanted a toast, but this component receives no `showToast` prop, so the
  // button label flips to "Copied" for ~1.5s instead of the copy being silent.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopyLink = async (template: PostTemplate) => {
    const ok = await copyText(template.imagePreview!);
    if (ok) {
      setCopiedId(template.id);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === template.id ? null : cur));
      }, 1500);
    }
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadImage(file);
      setNewImagePreview(url);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // ── Category management (scoped to `catScope`) ──
  // Rename/delete also cascade onto live templates via the Task 8 helpers;
  // only the templates whose `category` actually changed get pushed back up.
  const handleRename = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    await renameCategory(catScope, oldName, trimmed);
    applyCategoryRename(templates, catScope, oldName, trimmed)
      .filter((t, i) => t !== templates[i])
      .forEach(onUpdateTemplate);
  };

  const handleDelete = async (name: string) => {
    const ok = await confirm({
      title: `Delete category "${name}"?`,
      body: `Templates in it move to "${UNCATEGORIZED}".`,
      confirmLabel: 'Delete',
      tone: 'danger'
    });
    if (!ok) return;
    applyCategoryDelete(templates, catScope, name)
      .filter((t, i) => t !== templates[i])
      .forEach(onUpdateTemplate);
    await deleteCategory(catScope, name);
  };

  // Up/down reorder: build the new id order for this scope and hand the id
  // array to reorderCategories (it maps ids -> sortOrder).
  const handleReorder = (id: string, direction: -1 | 1) => {
    const ids = scopedCategories.map((c) => c.id);
    const idx = ids.indexOf(id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    void reorderCategories(catScope, ids);
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await addCategory(catScope, name);
    setNewCategoryName('');
  };

  const catScopeLabel = catScope === 'shared'
    ? 'Shared Ecosystem'
    : brands[catScope]?.name ?? catScope;

  // Category <select> options for the create/edit modal, scoped to the
  // modal's own Brand field (independent of the browse-filter scope).
  const modalCategoryOptions = categoriesFor(newBrandId);

  // Filter Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Global app brand filter
      if (selectedBrandFilter !== 'all' && tpl.brandId !== 'shared' && tpl.brandId !== selectedBrandFilter) {
        return false;
      }
      // Local brand filter
      if (activeBrandFilter !== 'all' && tpl.brandId !== activeBrandFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== 'all') {
        const catMatch = tpl.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
          (categoryFilter === 'Carousels' && (tpl.title.toLowerCase().includes('carousel') || tpl.description.toLowerCase().includes('carousel')));
        if (!catMatch) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = tpl.title.toLowerCase().includes(q);
        const descMatch = tpl.description.toLowerCase().includes(q);
        const captionMatch = (tpl.defaultCaption || '').toLowerCase().includes(q);
        const tagMatch = (tpl.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!titleMatch && !descMatch && !captionMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [templates, selectedBrandFilter, activeBrandFilter, categoryFilter, searchQuery]);

  // Browse-filter chips for the current scope: 'all', then the managed
  // categories for `catScope` (from useTemplateCategories), then any orphan
  // `category` value present on live templates in this scope that has no
  // managed entry yet (user-defined / legacy values, or -- until migrations
  // 0019-0021 land -- every value, since the managed list starts empty).
  const scopedCategories = categoriesFor(catScope);
  const categoryChips = useMemo(() => {
    const managedNames = scopedCategories.map((c) => c.name);
    const isManaged = (name: string) =>
      managedNames.some((n) => n.toLowerCase() === name.toLowerCase());
    const orphanNames = Array.from(
      new Set(
        templates
          .filter((tpl) => tpl.brandId === catScope)
          .map((tpl) => tpl.category)
          .filter((c): c is string => Boolean(c) && !isManaged(c))
      )
    );
    return [
      { id: 'all', label: 'All Templates', icon: 'grid_view' },
      ...managedNames.map((name) => ({ id: name, label: categoryMeta(name).label, icon: categoryMeta(name).icon })),
      ...orphanNames.map((name) => ({ id: name, label: categoryMeta(name).label, icon: categoryMeta(name).icon }))
    ];
  }, [templates, catScope, scopedCategories]);

  const handleCreateTemplate = () => {
    if (!newTitle.trim()) {
      // Used to silently do nothing — now it says why and focuses the field.
      setTitleError('Give this template a name so the team can find it.');
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(null);
    const tagArray = newTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const tpl: PostTemplate = {
      id: `tpl-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom template.',
      brandId: newBrandId,
      category: newCategory,
      platform: newPlatform,
      specType: 'feed-post',
      defaultCaption: newCaption.trim(),
      tags: tagArray.length > 0 ? tagArray : [newCategory],
      imagePreview: newImagePreview.trim(),
      usesCount: 0
    };
    onSaveNewTemplate(tpl);
    setShowCreateTemplateModal(false);
    resetForm();
  };

  const handleOpenEditModal = (tpl: PostTemplate) => {
    setEditingTemplate(tpl);
    setTitleError(null);
    setNewTitle(tpl.title);
    setNewDesc(tpl.description);
    setNewBrandId(tpl.brandId);
    setNewCategory(tpl.category);
    setNewPlatform(tpl.platform);
    setNewCaption(tpl.defaultCaption || '');
    setNewImagePreview(tpl.imagePreview || '');
    setNewTags((tpl.tags || []).join(', '));
    // Open with "More options" already expanded when there's existing
    // caption/tags/image content to see, so editing doesn't hide data.
    setShowMoreOptions(Boolean(tpl.defaultCaption?.trim() || (tpl.tags && tpl.tags.length > 0) || tpl.imagePreview?.trim()));
  };

  const handleDuplicateTemplate = (tpl: PostTemplate) => {
    const dup: PostTemplate = {
      ...tpl,
      id: `tpl-${Date.now()}`,
      title: `${tpl.title} (Copy)`,
      usesCount: 0
    };
    onSaveNewTemplate(dup);
  };

  const handleSaveEditedTemplate = () => {
    if (!editingTemplate) return;
    if (!newTitle.trim()) {
      setTitleError('Give this template a name so the team can find it.');
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(null);
    const tagArray = newTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const updated: PostTemplate = {
      ...editingTemplate,
      title: newTitle.trim(),
      description: newDesc.trim() || editingTemplate.description,
      brandId: newBrandId,
      category: newCategory,
      platform: newPlatform,
      defaultCaption: newCaption.trim(),
      tags: tagArray.length > 0 ? tagArray : editingTemplate.tags,
      imagePreview: newImagePreview.trim() || editingTemplate.imagePreview
    };
    onUpdateTemplate(updated);
    setEditingTemplate(null);
    resetForm();
  };

  const resetForm = () => {
    setNewTitle('');
    setTitleError(null);
    setNewDesc('');
    setNewCaption('');
    setNewImagePreview('');
    setNewTags('');
    setNewBrandId('shared');
    setNewCategory('Clinical');
    setNewPlatform('instagram');
    setUploadError(null);
    setShowMoreOptions(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#efefed]">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4f46e5] text-xl">quiz</span>
            <span className="font-label-caps text-xs text-[#4f46e5] font-bold tracking-widest">
              Standardized Blueprint Hub
            </span>
          </div>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Template Library
          </h2>
          <p className="font-body-md text-xs text-[#5f5f5b] mt-0.5">
            Pre-structured formats, copy formulas, and layouts for high-performing pharmaceutical and educational posts.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateTemplateModal(true);
          }}
          className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 font-bold cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_box</span>
          <span>+ Create New Template</span>
        </button>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#f4f4f3] p-3 rounded-xl border border-[#efefed]">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#5f5f5b]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by title, description, hashtag..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#e9e9e7] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4f46e5] text-[#1b1c1a] placeholder-[#5f5f5b]"
          />
        </div>

        {/* Brand Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <button
            onClick={() => setActiveBrandFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeBrandFilter === 'all'
                ? 'bg-[#4f46e5] text-white shadow-xs'
                : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0]'
            }`}
          >
            All Brands
          </button>
          <button
            onClick={() => setActiveBrandFilter('shared')}
            className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeBrandFilter === 'shared'
                ? 'bg-[#4f46e5] text-white shadow-xs'
                : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0]'
            }`}
          >
            Shared Ecosystem
          </button>
          {Object.entries(brands).map(([id, b]) => (
            <button
              key={id}
              onClick={() => setActiveBrandFilter(id as BrandId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-caps font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeBrandFilter === id
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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none flex-1 min-w-0">
          {categoryChips.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3.5 py-2 font-label-caps text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-[#1b1c1a] text-white font-bold shadow-md'
                  : 'bg-white border border-[#efefed] text-[#57574f] hover:bg-[#f1f1f0]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowManageCategories((v) => !v)}
          className={`px-3 py-2 font-label-caps text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
            showManageCategories
              ? 'bg-[#4f46e5] text-white shadow-xs'
              : 'bg-white border border-[#e9e9e7] text-[#57574f] hover:bg-[#f1f1f0]'
          }`}
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          <span>Manage categories</span>
        </button>
      </div>

      {/* ── Manage Categories Panel (scoped to catScope) ── */}
      {showManageCategories && (
        <div className="bg-white border border-[#efefed] rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline-md text-sm font-bold text-[#1b1c1a]">Manage Categories</h3>
              <p className="font-body-md text-[11px] text-[#5f5f5b]">
                Scope: <span className="font-bold">{catScopeLabel}</span>
                {selectedBrandFilter === 'all' && ' (switch the app brand filter to manage a specific brand)'}
              </p>
            </div>
            <button
              onClick={() => setShowManageCategories(false)}
              className="p-1.5 text-[#5f5f5b] hover:text-[#1b1c1a] cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          {scopedCategories.length === 0 ? (
            <p className="font-body-md text-xs text-[#5f5f5b] py-1">
              No categories for this scope yet. Add one below.
            </p>
          ) : (
            <ul className="space-y-2">
              {scopedCategories.map((cat, idx) => (
                <li key={cat.id} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#5f5f5b] shrink-0">
                    {categoryMeta(cat.name).icon}
                  </span>
                  <input
                    defaultValue={cat.name}
                    onBlur={(e) => { void handleRename(cat.name, e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { e.currentTarget.value = cat.name; e.currentTarget.blur(); }
                    }}
                    className="flex-1 min-w-0 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-bold text-[#1b1c1a] focus:outline-none focus:border-[#4f46e5]"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReorder(cat.id, -1)}
                      disabled={idx === 0}
                      className="p-1.5 text-[#5f5f5b] hover:bg-[#f1f1f0] rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(cat.id, 1)}
                      disabled={idx === scopedCategories.length - 1}
                      className="p-1.5 text-[#5f5f5b] hover:bg-[#f1f1f0] rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleDelete(cat.name); }}
                      className="p-1.5 bg-[#fcebeb] hover:bg-[#dc2626] text-[#dc2626] hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title="Delete category"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-3 border-t border-[#efefed]">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddCategory(); } }}
              placeholder="New category name"
              className="flex-1 min-w-0 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs text-[#1b1c1a] focus:outline-none focus:border-[#4f46e5]"
            />
            <button
              type="button"
              onClick={() => { void handleAddCategory(); }}
              disabled={!newCategoryName.trim()}
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Add category</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Template Cards Grid ── */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white border border-[#efefed] rounded-2xl p-12 text-center text-[#5f5f5b] space-y-3">
          <span className="material-symbols-outlined text-4xl text-[#e9e9e7]">layers_clear</span>
          <h3 className="font-display-xl text-base font-bold text-[#1b1c1a]">No templates found</h3>
          <p className="text-xs max-w-sm mx-auto">
            Try adjusting your search query, category filter, or create a brand-new template blueprint.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const brand = template.brandId !== 'shared' ? brands[template.brandId] : null;
            const platformIcon = PLATFORM_ICONS[template.platform] || 'photo_camera';

            return (
              <div
                key={template.id}
                className="bg-white border border-[#efefed] rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-[#e9e9e7] transition-all flex flex-col justify-between group"
              >
                {/* Visual Header / Thumbnail */}
                <div className="h-44 w-full bg-[#f4f4f3] border-b border-[#efefed] relative overflow-hidden flex items-center justify-center">
                  {template.imagePreview ? (
                    <img
                      src={template.imagePreview}
                      alt={template.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-4 text-[#e9e9e7] space-y-1">
                      <span className="material-symbols-outlined text-4xl">auto_stories</span>
                      <p className="font-label-caps text-[9px] font-bold tracking-wider">
                        {template.category} Template
                      </p>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="bg-[#1b1c1a]/90 text-white font-label-caps text-[9px] px-2 py-0.5 rounded-full font-bold backdrop-blur-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">{platformIcon}</span>
                      <span>{template.category}</span>
                    </span>
                  </div>

                  <span
                    className="absolute top-3 right-3 text-white font-label-caps text-[9px] px-2.5 py-0.5 rounded-full font-bold shadow-xs"
                    style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
                  >
                    {brand ? brand.name : 'Shared Ecosystem'}
                  </span>

                  {template.usesCount > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white font-code-sm text-[9px] px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px] text-[#86efac]">trending_up</span>
                      <span>{template.usesCount} uses</span>
                    </div>
                  )}

                  {template.imagePreview && (
                    <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-100 pointer-events-auto transition-opacity md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:focus-within:opacity-100 md:focus-within:pointer-events-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(template.imagePreview, '_blank', 'noopener');
                        }}
                        className="bg-white/95 border border-[#e9e9e7] text-[#1b1c1a] text-[10px] font-label-caps rounded px-2 py-1.5 md:py-1 flex items-center gap-1 shadow-xs hover:bg-white focus-visible:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        <span>Open image</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyLink(template);
                        }}
                        className="bg-white/95 border border-[#e9e9e7] text-[#1b1c1a] text-[10px] font-label-caps rounded px-2 py-1.5 md:py-1 flex items-center gap-1 shadow-xs hover:bg-white focus-visible:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {copiedId === template.id ? 'check' : 'link'}
                        </span>
                        <span>{copiedId === template.id ? 'Copied' : 'Copy link'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-headline-md text-base font-bold text-[#1b1c1a] group-hover:text-[#4f46e5] transition-colors leading-snug">
                      {template.title}
                    </h3>
                    <p className="font-body-md text-xs text-[#5f5f5b] line-clamp-2 mt-1 leading-relaxed">
                      {template.description}
                    </p>
                  </div>

                  {/* Caption Preview */}
                  {template.defaultCaption && (
                    <div className="p-3 bg-[#f4f4f3] border border-[#efefed] rounded-xl text-[11px] font-body-md text-[#57574f] italic line-clamp-2">
                      "{template.defaultCaption}"
                    </div>
                  )}

                  {/* Tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="font-label-caps text-[9px] bg-[#f1f1f0] px-2 py-0.5 rounded-md text-[#5f5f5b] font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-[#efefed] space-y-2">
                    <button
                      onClick={() => onUseTemplate(template)}
                      className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs font-bold py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">post_add</span>
                      <span>Use Blueprint for New Post</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDuplicateTemplate(template)}
                        className="flex-1 bg-[#f4f4f3] hover:bg-[#f1f1f0] border border-[#efefed] text-[#1b1c1a] font-label-caps text-[11px] font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Duplicate template"
                      >
                        <span className="material-symbols-outlined text-xs">content_copy</span>
                        <span>Copy</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(template)}
                        className="flex-1 bg-[#f4f4f3] hover:bg-[#f1f1f0] border border-[#efefed] text-[#1b1c1a] font-label-caps text-[11px] font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirm({ title: `Delete template "${template.title}"?`, confirmLabel: 'Delete', tone: 'danger' })) {
                            onDeleteTemplate(template.id);
                          }
                        }}
                        className="p-1.5 bg-[#fcebeb] hover:bg-[#dc2626] text-[#dc2626] hover:text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title="Delete template"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Template Modal ── */}
      {(showCreateTemplateModal || editingTemplate) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-[#e9e9e7] max-w-xl w-full p-6 rounded-2xl shadow-2xl relative space-y-4 my-8 animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#efefed]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4f46e5]">
                  {editingTemplate ? 'edit_note' : 'add_box'}
                </span>
                <h2 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                  {editingTemplate ? 'Edit Reusable Post Template' : 'Create New Reusable Template'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="p-1.5 text-[#5f5f5b] hover:text-[#1b1c1a] cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-body-md">
              <div>
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                  Template Name *
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => { setNewTitle(e.target.value); if (titleError) setTitleError(null); }}
                  placeholder="e.g. Clinical Study Carousel Blueprint"
                  aria-invalid={Boolean(titleError)}
                  className={`w-full bg-[#f4f4f3] border rounded-lg p-2 text-xs font-bold text-[#1b1c1a] focus:outline-none ${
                    titleError ? 'border-[#dc2626] focus:border-[#dc2626]' : 'border-[#e9e9e7] focus:border-[#4f46e5]'
                  }`}
                />
                {titleError && (
                  <p role="alert" className="text-[10px] text-[#dc2626] mt-1">{titleError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                    Brand
                  </label>
                  <select
                    value={newBrandId}
                    onChange={(e) => {
                      const nextBrand = e.target.value as BrandId | 'shared';
                      setNewBrandId(nextBrand);
                      // Keep Category valid for the new brand's scope.
                      const nextList = categoriesFor(nextBrand);
                      if (!nextList.some((c) => c.name === newCategory)) {
                        setNewCategory(nextList[0]?.name ?? '');
                      }
                    }}
                    className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-label-caps font-bold"
                  >
                    <option value="shared">Shared (All Brands)</option>
                    {Object.entries(brands).map(([id, b]) => (
                      <option key={id} value={id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-label-caps font-bold"
                  >
                    {modalCategoryOptions.length === 0 && !newCategory && (
                      <option value="">Uncategorized</option>
                    )}
                    {modalCategoryOptions.map((c) => (
                      <option key={c.id} value={c.name}>{categoryMeta(c.name).label}</option>
                    ))}
                    {newCategory && !modalCategoryOptions.some((c) => c.name === newCategory) && (
                      <option value={newCategory}>{categoryMeta(newCategory).label}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Image (upload-first: visible without expanding "More options") */}
              <div>
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                  Image
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newImagePreview}
                    onChange={(e) => setNewImagePreview(e.target.value)}
                    placeholder="https://... or upload below"
                    className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs text-[#1b1c1a] focus:outline-none"
                  />
                  <label className="bg-[#f1f1f0] border border-[#e9e9e7] text-[#4f46e5] px-3 py-2 rounded-lg font-label-caps text-xs font-bold hover:bg-[#4f46e5] hover:text-white transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap">
                    <span className="material-symbols-outlined text-sm">upload</span>
                    <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                    <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                  </label>
                </div>
                {uploadError && <p className="text-[10px] text-[#dc2626] mt-1">{uploadError}</p>}
                {newImagePreview && (
                  <img src={newImagePreview} alt="" className="h-24 w-full object-cover rounded-lg border border-[#e9e9e7] mt-2" />
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMoreOptions((v) => !v)}
                className="flex items-center gap-1.5 text-[#4f46e5] font-label-caps text-[10px] font-bold cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {showMoreOptions ? 'expand_less' : 'expand_more'}
                </span>
                <span>{showMoreOptions ? 'Hide more options' : 'More options (description, platform, caption, tags)'}</span>
              </button>

              {showMoreOptions && (
                <div className="space-y-3.5 pt-1">
                  <div>
                    <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                      Description / Purpose
                    </label>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="e.g. 5-slide carousel breaking down mechanism of action with diagnostic callout."
                      className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs text-[#1b1c1a] focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>

                  <div>
                    <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                      Platform
                    </label>
                    <select
                      value={newPlatform}
                      onChange={(e) => setNewPlatform(e.target.value as Platform)}
                      className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs font-label-caps font-bold"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="twitter">Twitter / X</option>
                      <option value="web">Website / Blog</option>
                      <option value="email">Email Broadcast</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                      Caption
                    </label>
                    <textarea
                      rows={4}
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                      placeholder="[HOOK]: Did you know that...? &#10;&#10;[CLINICAL INSIGHT]: &#10;1. Point A &#10;2. Point B &#10;&#10;[CTA]: Save this guide for your clinical rounds."
                      className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2.5 text-xs font-body-md text-[#1b1c1a] focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>

                  <div>
                    <label className="font-label-caps text-[10px] text-[#5f5f5b] block font-bold mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="Pharmacology, StudyGuide, MedicalEducation, BioTech"
                      className="w-full bg-[#f4f4f3] border border-[#e9e9e7] rounded-lg p-2 text-xs text-[#1b1c1a] focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#efefed]">
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 font-label-caps text-xs font-bold text-[#5f5f5b] hover:bg-[#f1f1f0] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={editingTemplate ? handleSaveEditedTemplate : handleCreateTemplate}
                className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-label-caps text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
