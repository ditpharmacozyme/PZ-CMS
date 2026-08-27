import React, { useState } from 'react';
import { BrandAsset, BrandId } from '../types';
import { BRANDS } from '../data/brands';
import { Modal } from './ui/Modal';
import { TextField, SelectField } from './ui/Field';
import { Button } from './ui/Button';
import { useConfirm } from './ui/ConfirmDialog';

interface AssetLibraryProps {
  assets: BrandAsset[];
  selectedBrandFilter: BrandId | 'all';
  onAddAsset: (asset: BrandAsset) => void;
  onUpdateAsset: (asset: BrandAsset) => void;
  onDeleteAsset: (assetId: string) => void;
}

const ASSET_TYPE_OPTIONS: { value: BrandAsset['type']; label: string }[] = [
  { value: 'vector_pack', label: 'Vector Pack' },
  { value: 'logo', label: 'Logo / Monogram' },
  { value: 'font', label: 'Typography Font' },
  { value: 'spec_sheet', label: 'Spec Sheet / Manual' },
];

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
  assets,
  selectedBrandFilter,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset
}) => {
  const confirm = useConfirm();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<BrandAsset | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<BrandId>('pharmacozyme');
  const [type, setType] = useState<BrandAsset['type']>('vector_pack');
  const [fileType, setFileType] = useState('SVG / Vector');
  const [size, setSize] = useState('1.5 MB');
  const [url, setUrl] = useState('');

  const isDirty = editingAsset
    ? title !== editingAsset.title || brandId !== editingAsset.brandId || type !== editingAsset.type ||
      fileType !== editingAsset.fileType || size !== editingAsset.size || url !== editingAsset.url
    : Boolean(title.trim() || url.trim());

  const filteredAssets = assets.filter((asset) => {
    if (selectedBrandFilter !== 'all' && asset.brandId !== selectedBrandFilter) return false;
    if (activeCategory !== 'all' && asset.type !== activeCategory) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && ![asset.title, asset.fileType, asset.type.replace('_', ' ')].some((v) => (v || '').toLowerCase().includes(q))) {
      return false;
    }
    return true;
  });

  const resetForm = () => {
    setTitle('');
    setTitleError(null);
    setBrandId('pharmacozyme');
    setType('vector_pack');
    setFileType('SVG / Vector');
    setSize('1.5 MB');
    setUrl('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEditModal = (asset: BrandAsset) => {
    setEditingAsset(asset);
    setTitleError(null);
    setTitle(asset.title);
    setBrandId(asset.brandId);
    setType(asset.type);
    setFileType(asset.fileType);
    setSize(asset.size);
    setUrl(asset.url);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingAsset(null);
  };

  const handleSaveAsset = () => {
    if (!title.trim()) {
      setTitleError('Give this asset a name so the team can find it.');
      return;
    }
    if (editingAsset) {
      const updated: BrandAsset = {
        ...editingAsset,
        title: title.trim(),
        brandId,
        type,
        fileType: fileType.trim() || 'Asset',
        size: size.trim() || '1.0 MB',
        url: url.trim() || '#'
      };
      onUpdateAsset(updated);
    } else {
      const newAsset: BrandAsset = {
        id: `asset-${Date.now()}`,
        title: title.trim(),
        brandId,
        type,
        fileType: fileType.trim() || 'Asset',
        size: size.trim() || '1.0 MB',
        url: url.trim() || '#'
      };
      onAddAsset(newAsset);
    }
    resetForm();
    closeModal();
  };

  const handleDeleteAsset = async (asset: BrandAsset) => {
    const ok = await confirm({
      title: `Delete "${asset.title}"?`,
      body: "This can't be undone.",
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (ok) onDeleteAsset(asset.id);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#bfcab4]">
        <div>
          <span className="font-label-caps text-xs text-[#296951] uppercase font-bold tracking-widest">
            Logos, fonts & spec sheets
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Assets
          </h2>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-[#296c00] text-white font-label-caps text-xs px-4 py-2.5 rounded shadow-sm hover:bg-[#1f5700] transition-all flex items-center gap-2 font-bold"
        >
          <span className="material-symbols-outlined text-sm">upload_file</span>
          <span>+ Add New Brand Asset</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-[#bfcab4] rounded px-3 h-11 max-w-md">
        <span className="material-symbols-outlined text-[#707a67] text-lg">search</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search assets by name or file type…"
          className="flex-1 bg-transparent text-sm text-[#1b1c1a] focus:outline-none placeholder:text-[#bfcab4]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-[#707a67] hover:text-[#1b1c1a] p-1 -mr-1" aria-label="Clear search">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['all', 'vector_pack', 'logo', 'font', 'spec_sheet'].map((catType) => (
          <button
            key={catType}
            onClick={() => setActiveCategory(catType)}
            className={`px-4 py-1.5 font-label-caps text-xs rounded transition-all capitalize ${
              activeCategory === catType
                ? 'bg-[#296c00] text-white font-bold shadow-xs'
                : 'bg-white border border-[#bfcab4] text-[#404a39] hover:bg-[#efeeea]'
            }`}
          >
            {catType === 'all' ? 'All Asset Types' : catType.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredAssets.map((asset) => {
          const brand = BRANDS[asset.brandId];
          return (
            <div
              key={asset.id}
              className="bg-white border border-[#bfcab4] p-4 rounded shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <span
                  className="font-label-caps text-[9px] px-2 py-0.5 text-white font-bold rounded uppercase"
                  style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
                >
                  {brand?.shortCode || asset.brandId}
                </span>
                <span className="font-code-sm text-[10px] text-[#707a67]">{asset.size}</span>
              </div>

              <div>
                <h3 className="font-headline-md text-sm font-bold text-[#1b1c1a]">{asset.title}</h3>
                <p className="font-body-md text-xs text-[#707a67] mt-1">{asset.fileType}</p>
              </div>

              <div className="space-y-2 pt-1 border-t border-[#bfcab4]">
                <button
                  onClick={() => {
                    if (asset.url && asset.url !== '#') {
                      window.open(asset.url, '_blank');
                    } else {
                      alert(`Accessing asset: ${asset.title}`);
                    }
                  }}
                  className="w-full bg-[#efeeea] border border-[#bfcab4] text-[#296c00] font-label-caps text-xs font-bold py-2 rounded hover:bg-[#296c00] hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Open / Download</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(asset)}
                    className="flex-1 bg-[#faf9f5] border border-[#bfcab4] text-[#1b1c1a] font-label-caps text-[11px] font-bold py-1 rounded hover:bg-[#bfcab4]/30 transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteAsset(asset)}
                    className="flex-1 bg-[#ffdad6] text-[#ba1a1a] font-label-caps text-[11px] font-bold py-1 rounded hover:bg-[#ba1a1a] hover:text-white transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Asset Modal */}
      <Modal
        isOpen={showAddModal || Boolean(editingAsset)}
        onClose={closeModal}
        title={editingAsset ? 'Edit Brand Asset' : 'Add New Brand Asset'}
        size="sm"
        isDirty={isDirty}
        dirtyPrompt={{
          title: 'Discard this asset?',
          body: "Your changes haven't been saved.",
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
        }}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveAsset}>
              {editingAsset ? 'Update Asset' : 'Add Asset'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <TextField
            label="Asset name"
            required
            value={title}
            onChange={(v) => { setTitle(v); if (titleError) setTitleError(null); }}
            error={titleError}
            placeholder="e.g. Vector Primary Logo Kit 2026"
          />

          <SelectField
            label="Brand"
            value={brandId}
            onChange={(v) => setBrandId(v as BrandId)}
            options={Object.values(BRANDS).map((b) => ({ value: b.id, label: b.name }))}
          />

          <SelectField
            label="Asset type"
            value={type}
            onChange={(v) => setType(v as BrandAsset['type'])}
            options={ASSET_TYPE_OPTIONS}
          />

          <TextField
            label="File format"
            value={fileType}
            onChange={setFileType}
            placeholder="e.g. SVG / EPS / PNG"
          />

          <TextField
            label="File size"
            value={size}
            onChange={setSize}
            placeholder="e.g. 4.2 MB"
          />

          <TextField
            label="Link (Google Drive or direct URL)"
            value={url}
            onChange={setUrl}
            placeholder="https://drive.google.com/..."
          />
        </div>
      </Modal>
    </div>
  );
};
