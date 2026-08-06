import React, { useState } from 'react';
import { BrandAsset, BrandId } from '../types';
import { BRANDS } from '../data/brands';

interface AssetLibraryProps {
  assets: BrandAsset[];
  selectedBrandFilter: BrandId | 'all';
  onAddAsset: (asset: BrandAsset) => void;
  onUpdateAsset: (asset: BrandAsset) => void;
  onDeleteAsset: (assetId: string) => void;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
  assets,
  selectedBrandFilter,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<BrandAsset | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [brandId, setBrandId] = useState<BrandId>('pharmacozyme');
  const [type, setType] = useState<BrandAsset['type']>('vector_pack');
  const [fileType, setFileType] = useState('SVG / Vector');
  const [size, setSize] = useState('1.5 MB');
  const [url, setUrl] = useState('');

  const filteredAssets = assets.filter((asset) => {
    if (selectedBrandFilter !== 'all' && asset.brandId !== selectedBrandFilter) return false;
    if (activeCategory !== 'all' && asset.type !== activeCategory) return false;
    return true;
  });

  const resetForm = () => {
    setTitle('');
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
    setTitle(asset.title);
    setBrandId(asset.brandId);
    setType(asset.type);
    setFileType(asset.fileType);
    setSize(asset.size);
    setUrl(asset.url);
  };

  const handleSaveAsset = () => {
    if (!title.trim()) return;
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
      setEditingAsset(null);
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
      setShowAddModal(false);
    }
    resetForm();
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
                    onClick={() => {
                      if (confirm(`Delete asset "${asset.title}"?`)) {
                        onDeleteAsset(asset.id);
                      }
                    }}
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
      {(showAddModal || editingAsset) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#bfcab4] max-w-md w-full p-6 rounded shadow-2xl relative space-y-4 my-8">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingAsset(null);
              }}
              className="absolute top-4 right-4 text-[#707a67] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">
              {editingAsset ? 'Edit Brand Asset' : 'Add New Brand Asset'}
            </h2>

            <div className="space-y-3 text-xs font-body-md">
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Asset Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Vector Primary Logo Kit 2026"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Brand Owner
                </label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value as BrandId)}
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 font-label-caps text-xs focus:outline-none"
                >
                  {Object.values(BRANDS).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Asset Type Category
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as BrandAsset['type'])}
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 font-label-caps text-xs focus:outline-none"
                >
                  <option value="vector_pack">Vector Pack</option>
                  <option value="logo">Logo / Monogram</option>
                  <option value="font">Typography Font</option>
                  <option value="spec_sheet">Spec Sheet / Manual</option>
                </select>
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  File Format Label
                </label>
                <input
                  type="text"
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  placeholder="e.g. SVG / EPS / PNG"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  File Size / Spec
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. 4.2 MB"
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] block uppercase font-bold mb-1">
                  Google Drive / Direct Asset URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#bfcab4]">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAsset(null);
                }}
                className="px-4 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsset}
                className="px-4 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700]"
              >
                {editingAsset ? 'Update Asset' : 'Add Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
