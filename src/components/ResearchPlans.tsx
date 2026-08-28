import React, { useMemo, useState, Suspense } from 'react';
import { ResearchItem, ResearchType, ResearchFileType, BrandId, TeamMember, Post } from '../types';
import { BRANDS } from '../data/brands';
import {
  CALENDAR_CSV_HEADERS,
  CalendarCsvRow,
  parseCalendarCsv,
  parseFrontmatter,
  mapBrandNameToId,
  convertCsvRowsToPosts
} from '../utils/researchParse';
import { uploadResearchFile, MAX_RESEARCH_FILE_BYTES } from '../utils/uploadResearchFile';
import { useConfirm } from './ui/ConfirmDialog';

// Lazy-loaded: only downloaded when someone actually opens a Markdown doc,
// keeping it off the main bundle (already past Vite's 500KB warning).
const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface ResearchPlansProps {
  researchItems: ResearchItem[];
  selectedBrandFilter: BrandId | 'all';
  teamMembers: TeamMember[];
  activeTeammate?: TeamMember | null;
  onAddResearchItem: (item: ResearchItem) => void;
  onDeleteResearchItem: (id: string) => void;
  onBatchAddPosts?: (posts: Post[]) => void;
}

const RESEARCH_TYPES: ResearchType[] = ['calendar', 'research', 'plan', 'brief', 'notes'];
const TYPE_LABELS: Record<ResearchType, string> = {
  calendar: 'Calendar Entries',
  research: 'Research',
  plan: 'Plan',
  brief: 'Brief',
  notes: 'Notes'
};
const FILE_TYPE_ICONS: Record<ResearchFileType, string> = {
  csv: 'table_view',
  xlsx: 'table_view',
  md: 'description',
  docx: 'article',
  pdf: 'picture_as_pdf'
};

function extToFileType(fileName: string): ResearchFileType | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'pdf') return 'pdf';
  return null;
}

export const ResearchPlans: React.FC<ResearchPlansProps> = ({
  researchItems,
  selectedBrandFilter,
  teamMembers,
  activeTeammate,
  onAddResearchItem,
  onDeleteResearchItem,
  onBatchAddPosts
}) => {
  const confirm = useConfirm();
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<BrandId | 'shared' | 'all'>(
    selectedBrandFilter === 'all' ? 'all' : selectedBrandFilter
  );
  const [selectedType, setSelectedType] = useState<ResearchType | 'all'>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<ResearchFileType | null>(null);
  const [parsedRows, setParsedRows] = useState<CalendarCsvRow[] | null>(null);
  const [parsedBody, setParsedBody] = useState<string>('');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState<BrandId | 'shared'>(
    selectedBrandFilter === 'all' ? 'shared' : selectedBrandFilter
  );
  const [type, setType] = useState<ResearchType>('research');
  const [owner, setOwner] = useState(activeTeammate?.name || teamMembers[0]?.name || '');
  const [itemDate, setItemDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [autoPopulateCalendar, setAutoPopulateCalendar] = useState(true);

  // Detail view
  const [viewingItem, setViewingItem] = useState<ResearchItem | null>(null);

  const filteredItems = useMemo(() => {
    return researchItems.filter((item) => {
      if (selectedBrand !== 'all') {
        if (item.brand !== selectedBrand) return false;
      } else if (selectedBrandFilter !== 'all') {
        if (item.brand !== 'shared' && item.brand !== selectedBrandFilter) return false;
      }

      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (selectedOwner !== 'all' && item.owner !== selectedOwner) return false;

      if (dateFrom && (!item.itemDate || item.itemDate < dateFrom)) return false;
      if (dateTo && (!item.itemDate || item.itemDate > dateTo)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchOwner = item.owner.toLowerCase().includes(q);
        if (!matchTitle && !matchTags && !matchOwner) return false;
      }

      return true;
    });
  }, [researchItems, selectedBrand, selectedBrandFilter, selectedType, selectedOwner, dateFrom, dateTo, searchQuery]);

  const resetUploadForm = () => {
    setSelectedFile(null);
    setFileType(null);
    setParsedRows(null);
    setParsedBody('');
    setTitle('');
    setBrand(selectedBrandFilter === 'all' ? 'shared' : selectedBrandFilter);
    setType('research');
    setOwner(activeTeammate?.name || teamMembers[0]?.name || '');
    setItemDate('');
    setTagsInput('');
    setUploadError(null);
  };

  const handleOpenUploadModal = () => {
    resetUploadForm();
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    resetUploadForm();
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setParsedRows(null);
    setParsedBody('');

    const detected = extToFileType(file.name);
    if (!detected) {
      setFileType(null);
      setUploadError(`Unsupported file type. Use CSV, MD, DOCX, or PDF (got "${file.name}").`);
      return;
    }
    if (file.size > MAX_RESEARCH_FILE_BYTES) {
      setFileType(null);
      setUploadError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 3MB.`);
      return;
    }

    setFileType(detected);
    const baseTitle = file.name.replace(/\.[^.]+$/, '');
    setTitle(baseTitle);

    if (detected === 'csv') {
      setType('calendar');
      const text = await file.text();
      const result = parseCalendarCsv(text);
      if (result.error) {
        setUploadError(result.error);
      } else {
        setParsedRows(result.rows);
      }
    } else if (detected === 'md') {
      const text = await file.text();
      const { data, body } = parseFrontmatter(text);
      setParsedBody(body);
      if (typeof data.title === 'string' && data.title) setTitle(data.title);
      if (typeof data.brand === 'string' && data.brand) setBrand(mapBrandNameToId(data.brand));
      if (typeof data.type === 'string' && RESEARCH_TYPES.includes(data.type as ResearchType)) {
        setType(data.type as ResearchType);
      }
      if (typeof data.date === 'string' && data.date) setItemDate(data.date);
      if (typeof data.owner === 'string' && data.owner) setOwner(data.owner);
      if (Array.isArray(data.tags)) setTagsInput(data.tags.join(', '));
      else if (typeof data.tags === 'string' && data.tags) setTagsInput(data.tags);
    }
  };

  const handleSubmitUpload = async () => {
    if (!selectedFile || !fileType || !title.trim() || !owner.trim()) return;
    if (fileType === 'csv' && !parsedRows) return; // header validation error already shown, blocks submit

    setIsUploading(true);
    setUploadError(null);
    try {
      const { fileId, webViewLink } = await uploadResearchFile(selectedFile, brand, type);
      const newItem: ResearchItem = {
        id: `res-${Date.now()}`,
        brand,
        type,
        title: title.trim(),
        owner: owner.trim(),
        itemDate: itemDate || undefined,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        driveFileId: fileId,
        driveViewUrl: webViewLink,
        fileType,
        parsedMetadata:
          fileType === 'csv' ? { rows: parsedRows } : fileType === 'md' ? { body: parsedBody } : undefined,
        uploadedBy: activeTeammate?.id,
        createdAt: new Date().toISOString()
      };
      onAddResearchItem(newItem);

      // Auto-populate Calendar if requested and supported
      if (fileType === 'csv' && parsedRows && autoPopulateCalendar && onBatchAddPosts) {
        const posts = convertCsvRowsToPosts(parsedRows, brand, owner.trim());
        onBatchAddPosts(posts);
      }

      handleCloseUploadModal();
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit = Boolean(selectedFile && fileType && title.trim() && owner.trim() && !(fileType === 'csv' && !parsedRows) && !isUploading);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e9e9e7]">
        <div>
          <span className="font-label-caps text-xs text-[#296951] uppercase font-bold tracking-widest">
            Research & Plans
          </span>
          <h2 className="font-display-xl text-2xl md:text-3xl text-[#1b1c1a] font-bold mt-1">
            Plans, Research & Content Calendars
          </h2>
          <p className="text-xs text-[#5f5f5b] mt-1">
            Upload calendars (CSV) or docs (Markdown, DOCX, PDF) planned with external AI — organized and searchable.
          </p>
        </div>

        <button
          onClick={handleOpenUploadModal}
          className="bg-[#296c00] text-white font-label-caps text-xs px-4 py-2.5 rounded shadow-sm hover:bg-[#1f5700] transition-all flex items-center gap-2 font-bold whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm font-bold">upload</span>
          <span>Upload File</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-white p-4 border border-[#e9e9e7] rounded shadow-2xs">
        <div className="lg:col-span-2 relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-[#5f5f5b] text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, tags, or owner..."
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] pl-9 pr-8 py-2 font-body-md text-xs text-[#1b1c1a] focus:bg-white focus:border-[#296c00] focus:outline-none rounded"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-[#5f5f5b] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value as any)}
          className="w-full bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-2 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
        >
          <option value="all">All Brands / Shared</option>
          <option value="shared">Shared</option>
          {Object.values(BRANDS).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as any)}
          className="w-full bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-2 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
        >
          <option value="all">All Types</option>
          {RESEARCH_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={selectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          className="w-full bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-2 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
        >
          <option value="all">All Owners</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>

        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] px-2 py-2 font-code-sm text-[11px] text-[#1b1c1a] focus:outline-none rounded"
            title="From date"
          />
          <span className="text-[#5f5f5b] text-xs">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-[#f4f4f3] border border-[#e9e9e7] px-2 py-2 font-code-sm text-[11px] text-[#1b1c1a] focus:outline-none rounded"
            title="To date"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.length === 0 ? (
          <div className="col-span-full bg-white border border-[#e9e9e7] p-12 text-center text-xs font-body-md text-[#5f5f5b]">
            No research items found matching the selected filters.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isShared = item.brand === 'shared';
            const brandCfg = !isShared ? BRANDS[item.brand] : null;

            return (
              <div
                key={item.id}
                className="bg-white border border-[#e9e9e7] rounded-lg p-5 flex flex-col justify-between shadow-2xs hover:shadow-md transition-all gap-4 relative group"
              >
                <div className="flex justify-between items-center">
                  <span
                    className="font-label-caps text-[9px] px-2 py-0.5 rounded text-white font-bold uppercase shadow-2xs"
                    style={{ backgroundColor: brandCfg?.primaryColor || '#5A38F0' }}
                  >
                    {brandCfg ? brandCfg.shortCode : 'SHARED'}
                  </span>
                  <span className="font-code-sm text-[9px] text-[#5f5f5b]">{item.itemDate || '—'}</span>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#296c00]">
                      {FILE_TYPE_ICONS[item.fileType]}
                    </span>
                    <h3 className="font-headline-md text-sm font-bold text-[#1b1c1a] leading-snug">
                      {item.title}
                    </h3>
                  </div>
                  <p className="font-label-caps text-[9px] text-[#5f5f5b] uppercase tracking-wide">
                    {TYPE_LABELS[item.type]} · {item.owner}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="font-label-caps text-[8px] sm:text-[9px] bg-[#f1f1f0] border border-[#e9e9e7] px-1.5 py-0.5 rounded text-[#57574f] font-bold"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#e9e9e7]/50">
                    <button
                      onClick={() => setViewingItem(item)}
                      className="flex-1 font-label-caps text-[10px] font-bold py-2 rounded border bg-[#f4f4f3] border-[#e9e9e7] text-[#296c00] hover:bg-[#f1f1f0] transition-colors flex items-center justify-center gap-1 min-h-[36px]"
                    >
                      <span className="material-symbols-outlined text-xs">visibility</span>
                      <span>View</span>
                    </button>
                    <a
                      href={item.driveViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 bg-[#296c00] text-white font-label-caps text-[10px] font-bold py-2 rounded hover:bg-[#1f5700] transition-colors flex items-center justify-center gap-1 min-h-[36px]"
                    >
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                      <span>Open in Drive</span>
                    </a>
                  </div>

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={async () => {
                        if (await confirm({ title: `Delete "${item.title}" from Research & Plans?`, body: 'This does not delete the file from Drive.', confirmLabel: 'Delete', tone: 'danger' })) {
                          onDeleteResearchItem(item.id);
                        }
                      }}
                      className="p-1.5 bg-[#fcebeb] text-[#dc2626] border border-[#ffb4ab] rounded shadow-xs hover:bg-[#fcebeb]/80"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#e9e9e7] max-w-lg w-full p-6 rounded shadow-2xl relative space-y-4 my-8">
            <button
              onClick={handleCloseUploadModal}
              className="absolute top-4 right-4 text-[#5f5f5b] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a]">Upload Research or Plan</h2>

            <div className="space-y-4 text-xs font-body-md">
              <div>
                <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                  File (CSV, MD, DOCX, or PDF — max 3MB) *
                </label>
                <input
                  type="file"
                  accept=".csv,.md,.markdown,.docx,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="block w-full text-xs text-[#57574f] file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-label-caps file:font-bold file:bg-[#f1f1f0] file:text-[#296c00] hover:file:bg-[#296c00] hover:file:text-white file:transition-all cursor-pointer"
                />
                {uploadError && (
                  <p className="text-[11px] text-[#dc2626] mt-2 font-body-md leading-relaxed">{uploadError}</p>
                )}
                {fileType === 'csv' && parsedRows && (
                  <p className="text-[11px] text-[#296c00] mt-2 font-bold">
                    ✓ {parsedRows.length} calendar rows parsed and headers validated.
                  </p>
                )}
                {fileType === 'csv' && (
                  <p className="text-[10px] text-[#5f5f5b] mt-1">
                    Required headers: {CALENDAR_CSV_HEADERS.join(', ')}
                  </p>
                )}
              </div>

              {selectedFile && fileType && (
                <>
                  <div>
                    <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 text-xs focus:outline-none rounded"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                        Brand
                      </label>
                      <select
                        value={brand}
                        onChange={(e) => setBrand(e.target.value as any)}
                        className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 font-label-caps text-xs focus:outline-none rounded"
                      >
                        <option value="shared">Shared (All Brands)</option>
                        {Object.values(BRANDS).map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                        Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as ResearchType)}
                        className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 font-label-caps text-xs focus:outline-none rounded"
                      >
                        {RESEARCH_TYPES.map((t) => (
                          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                        Owner *
                      </label>
                      {teamMembers.length > 0 ? (
                        <select
                          value={owner}
                          onChange={(e) => setOwner(e.target.value)}
                          className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 font-label-caps text-xs focus:outline-none rounded"
                        >
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={owner}
                          onChange={(e) => setOwner(e.target.value)}
                          className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 text-xs focus:outline-none rounded"
                        />
                      )}
                    </div>
                    <div>
                      <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={itemDate}
                        onChange={(e) => setItemDate(e.target.value)}
                        className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 font-code-sm text-xs focus:outline-none rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-label-caps text-[10px] text-[#5f5f5b] block uppercase font-bold mb-1">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="e.g. Q3, Launch, SEO"
                      className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-2.5 text-xs focus:outline-none rounded"
                    />
                  </div>

                  {fileType === 'csv' && (
                    <div className="pt-2">
                      <label className="flex items-start gap-2 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input
                            type="checkbox"
                            checked={autoPopulateCalendar}
                            onChange={(e) => setAutoPopulateCalendar(e.target.checked)}
                            className="appearance-none w-4 h-4 border-2 border-[#e9e9e7] rounded-sm checked:bg-[#296c00] checked:border-[#296c00] transition-colors cursor-pointer group-hover:border-[#296c00]"
                          />
                          {autoPopulateCalendar && (
                            <span className="material-symbols-outlined text-[12px] text-white absolute pointer-events-none font-bold">
                              check
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-label-caps text-xs text-[#1b1c1a]">Auto-populate Content Calendar</span>
                          <span className="text-[10px] text-[#5f5f5b]">Creates editable posts on the main Calendar grid</span>
                        </div>
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#e9e9e7]">
              <button
                onClick={handleCloseUploadModal}
                className="px-4 py-2 border border-[#e9e9e7] font-label-caps text-xs rounded hover:bg-[#f1f1f0]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitUpload}
                disabled={!canSubmit}
                className="px-4 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700] disabled:opacity-50"
              >
                {isUploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#e9e9e7] max-w-2xl w-full p-6 rounded shadow-2xl relative space-y-4 my-8 max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setViewingItem(null)}
              className="absolute top-4 right-4 text-[#5f5f5b] hover:text-[#1b1c1a]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div>
              <span className="font-label-caps text-[10px] text-[#296951] uppercase font-bold tracking-widest">
                {TYPE_LABELS[viewingItem.type]}
              </span>
              <h2 className="font-headline-md text-lg font-bold text-[#1b1c1a] mt-1">{viewingItem.title}</h2>
              <p className="text-[11px] text-[#5f5f5b] mt-1">
                {viewingItem.owner}{viewingItem.itemDate ? ` · ${viewingItem.itemDate}` : ''}
              </p>
            </div>

            {viewingItem.fileType === 'csv' && Array.isArray((viewingItem.parsedMetadata as any)?.rows) && (
              <div className="space-y-3">
                {onBatchAddPosts && (
                  <button
                    onClick={() => {
                      const rows = (viewingItem.parsedMetadata as any).rows as CalendarCsvRow[];
                      const posts = convertCsvRowsToPosts(rows, viewingItem.brand, viewingItem.owner);
                      onBatchAddPosts(posts);
                    }}
                    className="w-full py-2 bg-[#f1f1f0] border border-[#e9e9e7] text-[#296c00] font-label-caps text-xs font-bold rounded hover:bg-[#e9e9e7] flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">bolt</span>
                    Import / Auto-fill Content Calendar ({((viewingItem.parsedMetadata as any).rows as CalendarCsvRow[]).length} posts)
                  </button>
                )}
                <div className="overflow-x-auto border border-[#e9e9e7] rounded">
                  <table className="w-full text-[11px] font-body-md">
                    <thead className="bg-[#f4f4f3]">
                      <tr>
                        {CALENDAR_CSV_HEADERS.map((h) => (
                          <th key={h} className="text-left px-2 py-1.5 font-label-caps text-[9px] uppercase text-[#5f5f5b] border-b border-[#e9e9e7]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {((viewingItem.parsedMetadata as any).rows as CalendarCsvRow[]).map((row, i) => (
                        <tr key={i} className="border-b border-[#e9e9e7]/40 last:border-0">
                          {CALENDAR_CSV_HEADERS.map((h) => (
                            <td key={h} className="px-2 py-1.5 text-[#1b1c1a]">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewingItem.fileType === 'md' && typeof (viewingItem.parsedMetadata as any)?.body === 'string' && (
              <div className="prose prose-sm max-w-none font-body-md text-[#1b1c1a]">
                <Suspense fallback={<p className="text-xs text-[#5f5f5b]">Loading document…</p>}>
                  <ReactMarkdown>{(viewingItem.parsedMetadata as any).body}</ReactMarkdown>
                </Suspense>
              </div>
            )}

            {(viewingItem.fileType === 'pdf' || viewingItem.fileType === 'docx' || viewingItem.fileType === 'xlsx') && (
              <div className="bg-[#f4f4f3] border border-[#e9e9e7] rounded p-6 text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-[#296c00]">
                  {FILE_TYPE_ICONS[viewingItem.fileType]}
                </span>
                <p className="text-xs text-[#5f5f5b]">
                  This file type isn't previewed in-app — open it in Drive to view the full content.
                </p>
              </div>
            )}

            {viewingItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2 border-t border-[#e9e9e7]/50">
                {viewingItem.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="font-label-caps text-[9px] bg-[#f1f1f0] border border-[#e9e9e7] px-1.5 py-0.5 rounded text-[#57574f] font-bold"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <a
              href={viewingItem.driveViewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#296c00] font-bold text-xs hover:underline"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Open in Drive
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
