import React, { useState, useRef } from 'react';
import { PostTemplate, BrandId, Platform } from '../types';
import { BRANDS } from '../data/brands';
import { uploadImage } from '../utils/uploadImage';

interface TemplateLibraryProps {
  templates: PostTemplate[];
  onUseTemplate: (template: PostTemplate) => void;
  onSaveNewTemplate: (template: PostTemplate) => void;
  onUpdateTemplate: (template: PostTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  selectedBrandFilter: BrandId | 'all';
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  templates,
  onUseTemplate,
  onSaveNewTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  selectedBrandFilter
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PostTemplate | null>(null);

  // New Template Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBrandId, setNewBrandId] = useState<BrandId | 'shared'>('shared');
  const [newCategory, setNewCategory] = useState<PostTemplate['category']>('Clinical');
  const [newPlatform, setNewPlatform] = useState<Platform>('instagram');
  const [newCaption, setNewCaption] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const filteredTemplates = templates.filter((tpl) => {
    if (selectedBrandFilter !== 'all' && tpl.brandId !== 'shared' && tpl.brandId !== selectedBrandFilter) {
      return false;
    }
    if (categoryFilter !== 'all' && tpl.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  const handleCreateTemplate = () => {
    if (!newTitle.trim()) return;
    const tpl: PostTemplate = {
      id: `tpl-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom template.',
      brandId: newBrandId,
      category: newCategory,
      platform: newPlatform,
      specType: 'feed-post',
      defaultCaption: newCaption.trim(),
      tags: [newCategory],
      imagePreview: newImagePreview.trim(),
      usesCount: 1
    };
    onSaveNewTemplate(tpl);
    setShowCreateTemplateModal(false);
    resetForm();
  };

  const handleOpenEditModal = (tpl: PostTemplate) => {
    setEditingTemplate(tpl);
    setNewTitle(tpl.title);
    setNewDesc(tpl.description);
    setNewBrandId(tpl.brandId);
    setNewCategory(tpl.category);
    setNewPlatform(tpl.platform);
    setNewCaption(tpl.defaultCaption);
    setNewImagePreview(tpl.imagePreview);
  };

  const handleSaveEditedTemplate = () => {
    if (!editingTemplate || !newTitle.trim()) return;
    const updated: PostTemplate = {
      ...editingTemplate,
      title: newTitle.trim(),
      description: newDesc.trim() || editingTemplate.description,
      brandId: newBrandId,
      category: newCategory,
      platform: newPlatform,
      defaultCaption: newCaption.trim(),
      imagePreview: newImagePreview.trim() || editingTemplate.imagePreview
    };
    onUpdateTemplate(updated);
    setEditingTemplate(null);
    resetForm();
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewCaption('');
    setNewImagePreview('');
    setNewBrandId('shared');
    setNewCategory('Clinical');
    setNewPlatform('instagram');
    setUploadError(null);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bfcab4]">
        <div>
          <span className="font-label-caps text-xs text-[#296951] uppercase font-bold tracking-widest">
            Reusable formats
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Templates
          </h2>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowCreateTemplateModal(true);
          }}
          className="bg-[#296c00] text-white font-label-caps text-xs px-4 py-2.5 rounded shadow-sm hover:bg-[#1f5700] transition-all flex items-center gap-2 font-bold"
        >
          <span className="material-symbols-outlined text-sm">add_box</span>
          <span>+ Create New Template</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['all', 'Clinical', 'Interactive', 'Editorial', 'Patient-Facing', 'Internal'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-4 py-1.5 font-label-caps text-xs rounded transition-all whitespace-nowrap ${
              categoryFilter === cat
                ? 'bg-[#296c00] text-white font-bold shadow-xs'
                : 'bg-white border border-[#bfcab4] text-[#404a39] hover:bg-[#efeeea]'
            }`}
          >
            {cat === 'all' ? 'All Template Categories' : cat}
          </button>
        ))}
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const brand = template.brandId !== 'shared' ? BRANDS[template.brandId] : null;

          return (
            <div
              key={template.id}
              className="bg-white border border-[#bfcab4] rounded overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Image Preview */}
              <div className="h-48 w-full bg-[#efeeea] border-b border-[#bfcab4] relative overflow-hidden flex items-center justify-center">
                {template.imagePreview ? (
                  <img
                    src={template.imagePreview}
                    alt={template.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-[#bfcab4]">image</span>
                )}
                <span className="absolute top-3 left-3 bg-[#1b1c1a] text-white font-label-caps text-[9px] px-2 py-0.5 rounded font-bold uppercase">
                  {template.category}
                </span>

                <span
                  className="absolute top-3 right-3 text-white font-label-caps text-[9px] px-2 py-0.5 rounded font-bold uppercase shadow-xs"
                  style={{ backgroundColor: brand?.primaryColor || '#5a38f0' }}
                >
                  {brand ? brand.shortCode : 'SHARED ECOSYSTEM'}
                </span>
              </div>

              {/* Template Details */}
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-headline-md text-base font-bold text-[#1b1c1a]">
                      {template.title}
                    </h3>
                    <span className="font-code-sm text-[10px] text-[#707a67] bg-[#efeeea] px-1.5 py-0.5 rounded">
                      {template.usesCount} Uses
                    </span>
                  </div>

                  <p className="font-body-md text-xs text-[#707a67] line-clamp-2">
                    {template.description}
                  </p>
                </div>

                {/* Default Caption Preview Box */}
                <div className="p-2.5 bg-[#faf9f5] border border-[#bfcab4] rounded text-[11px] font-body-md text-[#404a39] italic line-clamp-2">
                  "{template.defaultCaption}"
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {template.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="font-label-caps text-[9px] bg-[#efeeea] border border-[#bfcab4] px-1.5 py-0.5 rounded text-[#707a67]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Action Buttons Row */}
                <div className="pt-2 border-t border-[#bfcab4] space-y-2">
                  <button
                    onClick={() => onUseTemplate(template)}
                    className="w-full bg-[#296c00] text-white font-label-caps text-xs font-bold py-2.5 rounded shadow-xs hover:bg-[#1f5700] transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">content_paste</span>
                    <span>Use Template for New Post</span>
                  </button>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenEditModal(template)}
                      className="flex-1 bg-[#efeeea] border border-[#bfcab4] text-[#1b1c1a] font-label-caps text-[11px] font-bold py-1.5 rounded hover:bg-[#bfcab4]/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete template "${template.title}"?`)) {
                          onDeleteTemplate(template.id);
                        }
                      }}
                      className="flex-1 bg-[#ffdad6] text-[#ba1a1a] font-label-caps text-[11px] font-bold py-1.5 rounded hover:bg-[#ba1a1a] hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Template Modal */}
      {(showCreateTemplateModal || editingTemplate) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#bfcab4] max-w-lg w-full p-6 rounded shadow-2xl relative space-y-4 my-8">
            <button
              onClick={() => {
                setShowCreateTemplateModal(false);
                setEditingTemplate(null);
              }}
              className="absolute top-4 right-4 text-[#707a67] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">
              {editingTemplate ? 'Edit Reusable Post Template' : 'Save Reusable Post Template'}
            </h2>

            <div className="space-y-3 text-xs font-body-md">
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Oncology Protocol Alert V3"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of when to use this template"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as PostTemplate['category'])}
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 font-label-caps text-xs focus:outline-none"
                >
                  <option value="Clinical">Clinical</option>
                  <option value="Interactive">Interactive</option>
                  <option value="Editorial">Editorial</option>
                  <option value="Patient-Facing">Patient-Facing</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Target Ecosystem Brand
                </label>
                <select
                  value={newBrandId}
                  onChange={(e) => setNewBrandId(e.target.value as BrandId | 'shared')}
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 font-label-caps text-xs focus:outline-none"
                >
                  <option value="shared">Shared Ecosystem (All Brands)</option>
                  {Object.values(BRANDS).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold">
                  Template Image
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#bfcab4] rounded p-3 text-[#296c00] hover:border-[#296c00] hover:bg-[#f0fdf4] transition-colors font-label-caps text-xs font-bold disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-lg">
                    {isUploading ? 'hourglass_empty' : 'upload_file'}
                  </span>
                  <span>{isUploading ? 'Uploading…' : 'Upload from your device'}</span>
                </button>
                {uploadError && (
                  <p className="text-[11px] text-[#ba1a1a] bg-[#ffdad6] border border-[#ffb4ab] rounded p-2">
                    {uploadError}
                  </p>
                )}

                {newImagePreview && (
                  <div className="flex items-center gap-2 p-2 bg-[#faf9f5] border border-[#bfcab4] rounded">
                    <div className="w-10 h-10 rounded overflow-hidden bg-[#efeeea] border border-[#bfcab4] flex-shrink-0">
                      <img src={newImagePreview} alt="Preview" draggable={false} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-[#707a67] truncate flex-1">{newImagePreview}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#bfcab4]" />
                  <span className="text-[9px] uppercase text-[#707a67]">or paste a link</span>
                  <div className="flex-1 h-px bg-[#bfcab4]" />
                </div>
                <input
                  type="text"
                  value={newImagePreview}
                  onChange={(e) => setNewImagePreview(e.target.value)}
                  placeholder="https://... or Drive URL"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Default Boilerplate Caption
                </label>
                <textarea
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  rows={3}
                  placeholder="Write reusable caption boilerplate with [PLACEHOLDERS]..."
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#bfcab4]">
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea]"
              >
                Cancel
              </button>
              <button
                onClick={editingTemplate ? handleSaveEditedTemplate : handleCreateTemplate}
                className="px-4 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700]"
              >
                {editingTemplate ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
