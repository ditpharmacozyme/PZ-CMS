import React, { useState, useRef, useEffect } from 'react';
import { Post, BrandId, Platform, SpecType, PostTemplate, ContentBankItem, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { toDateStr, todayStr, logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';

interface NewPostModalProps {
  initialDate?: string;
  /** Pre-selected template, set when the user clicked "Use template". */
  initialTemplateId?: string;
  templates?: PostTemplate[];
  selectedBrandFilter?: BrandId | 'all';
  onAddPost: (newPost: Post) => void;
  onClose: () => void;
  contentBank?: ContentBankItem[];
  teamMembers?: TeamMember[];
}

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string; bg: string }> = {
  instagram: { label: 'Instagram', icon: 'photo_camera', color: '#E1306C', bg: '#fdf2f8' },
  linkedin: { label: 'LinkedIn', icon: 'work', color: '#0A66C2', bg: '#eff6ff' },
  twitter: { label: 'X / Twitter', icon: 'tag', color: '#1DA1F2', bg: '#f0f9ff' },
  web: { label: 'Web Portal', icon: 'language', color: '#296c00', bg: '#f0fdf4' },
  email: { label: 'Email Broadcast', icon: 'mail', color: '#d97706', bg: '#fffbeb' }
};

export const NewPostModal: React.FC<NewPostModalProps> = ({
  initialDate,
  initialTemplateId,
  templates = [],
  selectedBrandFilter = 'all',
  onAddPost,
  onClose,
  contentBank = [],
  teamMembers = []
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [brandId, setBrandId] = useState<BrandId>(
    selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter
  );
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [specType, setSpecType] = useState<SpecType>('feed-post');

  // Date and Time calculation helpers
  const [scheduledDate, setScheduledDate] = useState(initialDate || todayStr());
  const [scheduledTime, setScheduledTime] = useState('10:00');

  const initialAssignee = teamMembers && teamMembers.length > 0 ? teamMembers[0].name : '';
  const initialEmail = teamMembers && teamMembers.length > 0 ? teamMembers[0].email || '' : '';

  const [assignee, setAssignee] = useState(initialAssignee);
  const [visualUrl, setVisualUrl] = useState('');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Content Bank Helper, Backlog toggles, and Email Reminder
  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [isBacklog, setIsBacklog] = useState<boolean>(!initialDate);
  const [reminderEmail, setReminderEmail] = useState<string>(initialEmail);

  // File upload ref & test email state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Template autofill
  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setTitle(tpl.title);
      if (tpl.brandId !== 'shared') setBrandId(tpl.brandId);
      setCaption(tpl.defaultCaption);
      setPlatform(tpl.platform);
      setSpecType(tpl.specType);
      if (tpl.imagePreview) setVisualUrl(tpl.imagePreview);
    }
  };

  // Apply a template chosen from the Template Library before this modal opened.
  useEffect(() => {
    if (initialTemplateId) handleSelectTemplate(initialTemplateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId]);

  // Upload to Drive and store only the returned URL — never base64.
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const { url, fileName } = await uploadImage(file);
      setVisualUrl(url);
      setUploadedFileName(fileName);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Send real test email reminder via Apps Script Proxy
  const handleSendTestEmail = async () => {
    const scriptUrl = localStorage.getItem('appscript_url');
    if (!scriptUrl) {
      alert('Please enter your Google Apps Script Web App URL first in the Apps Script Hub tab.');
      return;
    }

    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch('/api/appscript/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptUrl,
          payload: {
            action: 'sendEmailReminder',
            post: {
              title: title || 'New Instagram Campaign',
              brandId,
              scheduledDate,
              scheduledTime,
              platform,
              caption: caption || 'Instagram post caption cue.',
              assignee,
              visualUrl,
              reminderEmail
            },
            recipientEmail: reminderEmail
          }
        })
      });
      const data = await res.json();
      if (data?.data?.status === 'success') {
        setEmailStatus(`✓ Email sent to ${reminderEmail}`);
      } else {
        setEmailStatus(`❌ ${data?.data?.error || data?.error || 'Failed to send'}`);
      }
    } catch (err: any) {
      setEmailStatus(`❌ Error: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // Date Shortcuts
  const applyDateShortcut = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setScheduledDate(toDateStr(d));
  };

  const applyNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    setScheduledDate(toDateStr(d));
  };

  const handleCreate = () => {
    if (!title.trim()) {
      setActiveStep(1);
      return;
    }

    const finalDate = isBacklog ? '' : scheduledDate;
    const finalTime = isBacklog ? '' : scheduledTime;

    const newPost: Post = {
      id: `post-${Date.now()}`,
      brandId,
      title: title.trim(),
      caption: caption.trim(),
      platform,
      specType,
      scheduledDate: finalDate,
      scheduledTime: finalTime,
      reminderEmail,
      emailReminderEnabled: !isBacklog,
      status: finalDate ? 'in-progress' : 'not-started',
      assignee,
      visualUrl,
      templateId: selectedTemplateId || undefined,
      approved: false,
      comments: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: assignee || 'Someone',
          action: finalDate ? `Scheduled reminder for ${finalDate} at ${finalTime}` : 'Created idea',
          timestamp: logTimestamp()
        }
      ],
      tags: []
    };

    onAddPost(newPost);
    onClose();
  };

  // Human Readable Date
  const formatReadableDate = (dateString: string) => {
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#FAF9F5] border border-[#bfcab4] max-w-2xl w-full rounded-lg shadow-2xl overflow-hidden my-auto max-h-[96vh] flex flex-col relative">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#bfcab4] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#296c00]/10 flex items-center justify-center text-[#296c00]">
              <span className="material-symbols-outlined text-2xl">event_upcoming</span>
            </div>
            <div>
              <h2 className="font-display-xl text-lg sm:text-xl font-bold text-[#1b1c1a] leading-tight">
                New Post
              </h2>
              <p className="font-label-caps text-[11px] text-[#707a67]">
                Adding to {BRANDS[brandId]?.name || 'Ecosystem'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-[#707a67] hover:text-[#1b1c1a] hover:bg-[#efeeea] rounded transition-colors"
            title="Close Modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Wizard Stepper Tabs */}
        <div className="flex border-b border-[#bfcab4] bg-[#f5f4ef]">
          <button
            onClick={() => setActiveStep(1)}
            className={`flex-1 py-2.5 px-3 font-label-caps text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
              activeStep === 1
                ? 'border-[#296c00] text-[#296c00] bg-white'
                : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">1</span>
            <span>Content & Brand</span>
          </button>

          <button
            onClick={() => setActiveStep(2)}
            className={`flex-1 py-2.5 px-3 font-label-caps text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
              activeStep === 2
                ? 'border-[#296c00] text-[#296c00] bg-white'
                : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">2</span>
            <span>Schedule & Channel</span>
          </button>

          <button
            onClick={() => setActiveStep(3)}
            className={`flex-1 py-2.5 px-3 font-label-caps text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
              activeStep === 3
                ? 'border-[#296c00] text-[#296c00] bg-white'
                : 'border-transparent text-[#707a67] hover:text-[#1b1c1a]'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/10 flex items-center justify-center text-[10px]">3</span>
            <span>Visual & Specs</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* STEP 1: Content & Brand */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Template Quick Loader */}
              {templates.length > 0 && (
                <div className="p-3 bg-white border border-[#bfcab4] rounded space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                      Start From Template (Optional)
                    </label>
                    {selectedTemplateId && (
                      <span className="text-[10px] text-[#296c00] font-bold">✓ Template Applied</span>
                    )}
                  </div>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
                  >
                    <option value="">-- Blank New Campaign Post --</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.title} ({tpl.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title & Brand Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                    Post Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. World Health Day"
                    className="w-full bg-white border border-[#bfcab4] p-2.5 font-bold text-xs focus:outline-none focus:border-[#296c00] rounded"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                    Brand
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value as BrandId)}
                    className="w-full bg-white border border-[#bfcab4] p-2.5 font-label-caps text-xs focus:outline-none focus:border-[#296c00] rounded"
                  >
                    {Object.values(BRANDS).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Caption */}
              <div className="space-y-1">
                <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                  Caption
                </label>
                <div className="relative">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    placeholder="Write your Instagram caption here..."
                    className="w-full bg-white border border-[#bfcab4] p-3 text-xs leading-relaxed focus:outline-none focus:border-[#296c00] rounded"
                  />
                  {/* Swipe Copy Button */}
                  <button
                    type="button"
                    onClick={() => setShowBankDrawer(!showBankDrawer)}
                    className="absolute bottom-2 right-2 flex items-center gap-1 bg-[#efeeea] border border-[#bfcab4] text-[#296c00] text-[10px] font-label-caps font-bold px-2 py-1 rounded hover:bg-[#aceecf] transition-colors"
                    title="Insert from Content Bank"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>article</span>
                    Swipe Copy
                  </button>

                  {/* Swipe Copy Mini Drawer */}
                  {showBankDrawer && (
                    <div className="absolute z-10 bottom-10 right-0 w-72 max-h-64 overflow-y-auto bg-white border border-[#bfcab4] rounded shadow-xl">
                      <div className="p-2 border-b border-[#bfcab4] flex gap-1.5 sticky top-0 bg-white">
                        <input
                          type="text"
                          value={bankSearchQuery}
                          onChange={(e) => setBankSearchQuery(e.target.value)}
                          placeholder="Search copy..."
                          className="flex-1 bg-[#faf9f5] border border-[#bfcab4] rounded px-2 py-1 text-[10px] focus:outline-none"
                        />
                        <button onClick={() => setShowBankDrawer(false)} className="text-[#707a67] hover:text-[#1b1c1a]">
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>
                      </div>
                      {contentBank
                        .filter(item =>
                          item.brandId === 'shared' || item.brandId === brandId
                        )
                        .filter(item =>
                          !bankSearchQuery.trim() ||
                          item.text.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
                          item.tags?.some(t => t.toLowerCase().includes(bankSearchQuery.toLowerCase()))
                        )
                        .slice(0, 20)
                        .map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setCaption(prev => prev + (prev ? '\n\n' : '') + item.text);
                              setShowBankDrawer(false);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] text-[#1b1c1a] hover:bg-[#f0fae8] border-b border-[#bfcab4]/50 leading-relaxed"
                          >
                            <p className="line-clamp-3">{item.text}</p>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="bg-[#efeeea] text-[#707a67] text-[9px] px-1 rounded">{tag}</span>
                                ))}
                              </div>
                            )}
                          </button>
                        ))}
                      {contentBank.filter(item => item.brandId === 'shared' || item.brandId === brandId).length === 0 && (
                        <p className="p-3 text-[10px] text-[#707a67] text-center">No content bank items for this brand.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned person */}
              <div className="space-y-1">
                <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                  Assigned To
                </label>
                <select
                  value={assignee}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    setAssignee(selectedName);
                    const member = teamMembers?.find((m) => m.name === selectedName);
                    if (member && member.email) {
                      setReminderEmail(member.email);
                    }
                  }}
                  className="w-full bg-white border border-[#bfcab4] p-2.5 font-label-caps text-xs rounded"
                >
                  {teamMembers && teamMembers.length > 0 ? (
                    teamMembers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.role})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Hamza Ansari">Hamza Ansari (Brand & Content Lead)</option>
                      <option value="Pharmacozyme Ops">Pharmacozyme Ops (Global Approver)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Schedule & Channel */}
          {activeStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Target Platform Visual Selector */}
              <div className="space-y-2">
                <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                  Select Target Platform / Channel
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((pKey) => {
                    const cfg = PLATFORM_CONFIG[pKey];
                    const isSelected = platform === pKey;
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => setPlatform(pKey)}
                        className={`p-3 rounded border text-left flex items-center gap-2.5 transition-all ${
                          isSelected
                            ? 'border-[#296c00] bg-white ring-2 ring-[#296c00]/20 shadow-xs'
                            : 'border-[#bfcab4] bg-white hover:bg-[#efeeea]'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-lg p-1.5 rounded"
                          style={{ backgroundColor: cfg.bg, color: cfg.color }}
                        >
                          {cfg.icon}
                        </span>
                        <div>
                          <div className="font-label-caps text-xs font-bold text-[#1b1c1a]">
                            {cfg.label}
                          </div>
                          {isSelected && (
                            <div className="text-[10px] text-[#296c00] font-bold">Selected</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Backlog / Schedule Mode Toggle */}
              <div className="flex items-center gap-3 p-4 bg-white border border-[#bfcab4] rounded shadow-2xs">
                <input
                  type="checkbox"
                  id="new-post-backlog-toggle"
                  checked={isBacklog}
                  onChange={(e) => setIsBacklog(e.target.checked)}
                  className="w-4 h-4 text-[#296c00] border-[#bfcab4] rounded focus:ring-[#296c00]"
                />
                <label
                  htmlFor="new-post-backlog-toggle"
                  className="font-label-caps text-xs font-bold text-[#1b1c1a] cursor-pointer select-none"
                >
                  📥 Save as Idea (no date yet)
                </label>
              </div>

              {isBacklog ? (
                <div className="p-4 bg-[#efeeea] border border-dashed border-[#bfcab4] rounded text-center text-xs text-[#707a67]">
                  <span className="material-symbols-outlined text-xl mb-1 text-[#296c00]">lightbulb</span>
                  <p>This post will be saved as an idea with no date.</p>
                  <p className="mt-0.5">You can set a date later by dragging it onto the calendar.</p>
                </div>
              ) : (
                <>
                  {/* Date Presets + Picker */}
                  <div className="p-4 bg-white border border-[#bfcab4] rounded space-y-3">
                    <label className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase block">
                      📅 Target Publication Date
                    </label>
                    
                    {/* Date Quick Shortcut Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyDateShortcut(0)}
                        className="px-3 py-1.5 bg-[#efeeea] border border-[#bfcab4] rounded text-xs font-label-caps font-bold text-[#1b1c1a] hover:bg-[#296c00] hover:text-white transition-colors"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDateShortcut(1)}
                        className="px-3 py-1.5 bg-[#efeeea] border border-[#bfcab4] rounded text-xs font-label-caps font-bold text-[#1b1c1a] hover:bg-[#296c00] hover:text-white transition-colors"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDateShortcut(3)}
                        className="px-3 py-1.5 bg-[#efeeea] border border-[#bfcab4] rounded text-xs font-label-caps font-bold text-[#1b1c1a] hover:bg-[#296c00] hover:text-white transition-colors"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={applyNextMonday}
                        className="px-3 py-1.5 bg-[#efeeea] border border-[#bfcab4] rounded text-xs font-label-caps font-bold text-[#1b1c1a] hover:bg-[#296c00] hover:text-white transition-colors"
                      >
                        Next Monday
                      </button>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="flex-1 bg-[#faf9f5] border border-[#bfcab4] p-2.5 font-code-sm text-xs rounded focus:outline-none focus:border-[#296c00]"
                      />
                      <div className="text-xs font-body-md text-[#707a67] italic font-semibold">
                        {formatReadableDate(scheduledDate)}
                      </div>
                    </div>
                  </div>

                  {/* Time Presets + Picker */}
                  <div className="p-4 bg-white border border-[#bfcab4] rounded space-y-3">
                    <label className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase block">
                      ⏰ Reminder Time
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Morning', time: '09:00' },
                        { label: 'Midday', time: '13:00' },
                        { label: 'Afternoon', time: '16:00' },
                        { label: 'Evening', time: '19:00' }
                      ].map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setScheduledTime(slot.time)}
                          className={`p-2 rounded border text-center transition-all ${
                            scheduledTime === slot.time
                              ? 'border-[#296c00] bg-[#296c00] text-white font-bold'
                              : 'border-[#bfcab4] bg-[#faf9f5] text-[#1b1c1a] hover:bg-[#efeeea]'
                          }`}
                        >
                          <div className="font-label-caps text-xs">{slot.time}</div>
                          <div className="text-[10px] opacity-80">{slot.label}</div>
                        </button>
                      ))}
                    </div>

                <div className="pt-1">
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-[#faf9f5] border border-[#bfcab4] p-2.5 font-code-sm text-xs rounded focus:outline-none focus:border-[#296c00]"
                  />
                </div>
              </div>

                  {/* Email Reminder */}
                  <div className="p-4 bg-white border border-[#296c00]/30 rounded space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[#296c00]" style={{ fontSize: '16px' }}>mark_email_unread</span>
                      <label className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase block">
                        Email Reminder for Instagram Posting
                      </label>
                    </div>
                    <p className="font-body-md text-[10px] text-[#707a67]">
                      We'll send a reminder to this address on the scheduled date so you can post manually on Instagram.
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        value={reminderEmail}
                        onChange={(e) => setReminderEmail(e.target.value)}
                        placeholder="e.g. team@pharmacozyme.com"
                        className="flex-1 bg-[#faf9f5] border border-[#bfcab4] p-2.5 font-body-md text-xs rounded focus:outline-none focus:border-[#296c00]"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={sendingEmail}
                        className="px-3 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded hover:bg-[#1f5700] disabled:opacity-50 transition-all flex items-center gap-1 whitespace-nowrap"
                        title="Send immediate test email reminder"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        <span>{sendingEmail ? 'Sending...' : 'Test Email'}</span>
                      </button>
                    </div>
                    {emailStatus && (
                      <p className={`text-[10px] font-label-caps mt-1 font-bold ${emailStatus.includes('✓') ? 'text-[#296c00]' : 'text-[#ba1a1a]'}`}>
                        {emailStatus}
                      </p>
                    )}
                  </div>
              </>
          )}
        </div>
      )}

          {/* STEP 3: Visual & Specs */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Image format / spec */}
              <div className="space-y-1">
                <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                  Image Format
                </label>
                <select
                  value={specType}
                  onChange={(e) => setSpecType(e.target.value as SpecType)}
                  className="w-full bg-white border border-[#bfcab4] p-2.5 font-label-caps text-xs rounded"
                >
                  {Object.values(SPECS).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.dimensions} ({s.aspectRatio})
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload from device OR paste URL */}
              <div className="space-y-2">
                <label className="font-label-caps text-[10px] text-[#707a67] font-bold uppercase block">
                  Image
                </label>

                {/* File upload button */}
                <div>
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
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#bfcab4] rounded p-4 text-[#296c00] hover:border-[#296c00] hover:bg-[#f0fdf4] transition-colors font-label-caps text-xs font-bold disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-xl">upload_file</span>
                    <span>{isUploading ? 'Uploading…' : 'Upload from your device'}</span>
                  </button>
                  {uploadedFileName && !isUploading && (
                    <p className="mt-1 font-label-caps text-[10px] text-[#296c00] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      {uploadedFileName}
                    </p>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-[11px] font-body-md text-[#ba1a1a] bg-[#ffdad6] border border-[#ffb4ab] rounded p-2">
                      {uploadError}
                    </p>
                  )}
                </div>

                {/* OR paste URL */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#bfcab4]" />
                  <span className="font-label-caps text-[9px] text-[#707a67] uppercase">or paste a link</span>
                  <div className="flex-1 h-px bg-[#bfcab4]" />
                </div>
                <input
                  type="text"
                  value={visualUrl}
                  onChange={(e) => { setVisualUrl(e.target.value); setUploadedFileName(''); }}
                  placeholder="https://drive.google.com/... or https://..."
                  className="w-full bg-white border border-[#bfcab4] p-2.5 text-xs focus:outline-none focus:border-[#296c00] rounded"
                />
              </div>

              {/* Visual Live Preview */}
              {visualUrl && (
                <div className="p-3 bg-white border border-[#bfcab4] rounded flex items-center gap-4">
                  <div className="w-16 h-16 rounded overflow-hidden bg-[#efeeea] border border-[#bfcab4] flex-shrink-0">
                    <img src={visualUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-[#1b1c1a]">Preview</div>
                    <div className="font-label-caps text-[11px] text-[#707a67]">
                      {uploadedFileName ? `Uploaded: ${uploadedFileName}` : 'Linked image'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary card */}
          <div className="p-3 bg-[#f0fdf4] border border-[#86efac] rounded flex items-center justify-between text-xs text-[#166534]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#296c00]">verified</span>
              <div>
                <span className="font-bold">Summary: </span>
                <span>
                  {title ? `"${title}"` : 'Untitled Post'}{' '}
                  {isBacklog ? 'saved as an idea (no date set).' : (
                    <>
                      reminder set for{' '}
                      <strong className="underline">{formatReadableDate(scheduledDate)}</strong> at{' '}
                      <strong>{scheduledTime}</strong> on{' '}
                      <strong className="capitalize">{PLATFORM_CONFIG[platform]?.label || platform}</strong>.
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white border-t border-[#bfcab4] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev - 1) as 1 | 2)}
                className="px-3 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea] flex items-center gap-1 font-bold"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back</span>
              </button>
            )}
            {activeStep < 3 && (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev + 1) as 2 | 3)}
                className="px-3 py-2 bg-[#efeeea] border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#296c00] hover:text-white transition-colors flex items-center gap-1 font-bold"
              >
                <span>Next Step</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#bfcab4] font-label-caps text-xs rounded hover:bg-[#efeeea] font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="px-5 py-2 bg-[#296c00] text-white font-label-caps text-xs font-bold rounded shadow-xs hover:bg-[#1f5700] active:scale-95 transition-all flex items-center gap-1.5 min-h-[40px]"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              <span>Save Post</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
