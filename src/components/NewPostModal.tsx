import React, { useState, useRef, useEffect } from 'react';
import { Post, BrandId, Platform, SpecType, PostTemplate, ContentBankItem, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { todayStr, logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';
import { useSmartMemory, PostDraft } from '../hooks/useSmartMemory';

interface NewPostModalProps {
  initialDate?: string;
  initialTemplateId?: string;
  initialDraft?: PostDraft | null;
  templates?: PostTemplate[];
  selectedBrandFilter?: BrandId | 'all';
  onAddPost: (newPost: Post) => void;
  onClose: () => void;
  contentBank?: ContentBankItem[];
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
}

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string; bg: string }> = {
  instagram: { label: 'Instagram', icon: 'photo_camera', color: '#E1306C', bg: '#fdf2f8' },
  linkedin: { label: 'LinkedIn', icon: 'work', color: '#0A66C2', bg: '#eff6ff' },
  twitter: { label: 'X / Twitter', icon: 'tag', color: '#1DA1F2', bg: '#f0f9ff' },
  web: { label: 'Web Portal', icon: 'language', color: '#296c00', bg: '#f0fdf4' },
  email: { label: 'Email Broadcast', icon: 'mail', color: '#d97706', bg: '#fffbeb' }
};

const TIME_PRESETS = [
  { label: 'Morning (10:00 AM)', time: '10:00' },
  { label: 'Afternoon (2:00 PM)', time: '14:00' },
  { label: 'Evening (6:00 PM)', time: '18:00' }
];

export const NewPostModal: React.FC<NewPostModalProps> = ({
  initialDate,
  initialTemplateId,
  initialDraft,
  templates = [],
  selectedBrandFilter = 'all',
  onAddPost,
  onClose,
  contentBank = [],
  teamMembers = [],
  activeTeammate = null
}) => {
  const { saveDraft, clearDraft } = useSmartMemory();

  const [title, setTitle] = useState(initialDraft?.title || '');
  const [brandId, setBrandId] = useState<BrandId>(
    initialDraft?.brandId || (selectedBrandFilter === 'all' ? 'pharmacozyme' : selectedBrandFilter)
  );
  const [caption, setCaption] = useState(initialDraft?.caption || '');
  const [platform, setPlatform] = useState<Platform>(initialDraft?.platform || 'instagram');
  const [specType, setSpecType] = useState<SpecType>('feed-post');

  // Scheduling State
  const [isBacklog, setIsBacklog] = useState<boolean>(!initialDate && !initialDraft?.scheduledDate);
  const [scheduledDate, setScheduledDate] = useState(initialDraft?.scheduledDate || initialDate || todayStr());
  const [scheduledTime, setScheduledTime] = useState(initialDraft?.scheduledTime || '10:00');

  // Assignees & Roles
  const defaultAssignee = activeTeammate ? activeTeammate.name : (teamMembers.length > 0 ? teamMembers[0].name : '');
  const [assignees, setAssignees] = useState<string[]>(
    initialDraft?.assignees || (defaultAssignee ? [defaultAssignee] : [])
  );
  const [designerRole, setDesignerRole] = useState<string>('');
  const [publisherRole, setPublisherRole] = useState<string>('');
  const [engagementRole, setEngagementRole] = useState<string>('');

  // Email Reminder State
  const [emailReminderEnabled, setEmailReminderEnabled] = useState<boolean>(true);
  const initialEmail = activeTeammate?.email || (teamMembers.length > 0 ? teamMembers[0].email : '');
  const [reminderEmail, setReminderEmail] = useState<string>(initialDraft?.reminderEmail || initialEmail || '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Visual Media
  const [visualUrl, setVisualUrl] = useState(initialDraft?.visualUrl || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content Bank / Template Drawer
  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // Auto-sync reminder email when assignees change
  useEffect(() => {
    if (!teamMembers || teamMembers.length === 0) return;
    const emails = assignees
      .map((name) => teamMembers.find((m) => m.name === name)?.email)
      .filter((e): e is string => Boolean(e && e.trim()));
    const combined = Array.from(new Set(emails)).join(', ');
    if (combined && !reminderEmail) {
      setReminderEmail(combined);
    }
  }, [assignees, teamMembers, reminderEmail]);

  // Apply initial template if supplied
  useEffect(() => {
    if (initialTemplateId) {
      const tpl = templates.find((t) => t.id === initialTemplateId);
      if (tpl) {
        setTitle(tpl.title);
        if (tpl.brandId !== 'shared') setBrandId(tpl.brandId);
        setCaption(tpl.defaultCaption);
        setPlatform(tpl.platform);
        setSpecType(tpl.specType);
        if (tpl.imagePreview) setVisualUrl(tpl.imagePreview);
      }
    }
  }, [initialTemplateId, templates]);

  // Auto-save draft on changes
  useEffect(() => {
    if (title.trim() || caption.trim()) {
      saveDraft({
        title,
        caption,
        brandId,
        platform,
        scheduledDate: isBacklog ? '' : scheduledDate,
        scheduledTime: isBacklog ? '' : scheduledTime,
        assignees,
        visualUrl,
        reminderEmail
      });
    }
  }, [title, caption, brandId, platform, isBacklog, scheduledDate, scheduledTime, assignees, visualUrl, reminderEmail, saveDraft]);

  const toggleAssignee = (name: string) => {
    setAssignees((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  // Image Upload
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadImage(file);
      setVisualUrl(url);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  // Send immediate test reminder email
  const handleSendTestEmail = async () => {
    const recipient = reminderEmail || initialEmail;
    if (!recipient) {
      setEmailStatus('Please enter a recipient email.');
      return;
    }
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch('/api/appscript/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            action: 'sendEmailReminder',
            recipientEmail: recipient,
            post: {
              title: title || 'Untitled Post',
              caption,
              brandId,
              platform,
              scheduledDate: isBacklog ? 'Backlog (Unscheduled)' : scheduledDate,
              scheduledTime: isBacklog ? '' : scheduledTime,
              visualUrl,
              assignees: assignees.length > 0 ? assignees : ['Unassigned']
            }
          }
        })
      });
      const data = await res.json();
      if (data.status === 'success' || data.result === 'success') {
        setEmailStatus(`✓ Test reminder sent to ${recipient}`);
      } else {
        setEmailStatus(`Error: ${data.error || 'Failed to send'}`);
      }
    } catch (err: any) {
      setEmailStatus(`Send failed: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalDate = isBacklog ? '' : scheduledDate;
    const finalTime = isBacklog ? '' : scheduledTime;
    const creatorName = activeTeammate ? activeTeammate.name : (defaultAssignee || 'Someone');

    const newPost: Post = {
      id: `post-${Date.now()}`,
      brandId,
      title: title.trim(),
      caption: caption.trim(),
      platform,
      specType,
      scheduledDate: finalDate,
      scheduledTime: finalTime,
      status: 'not-started',
      assignees: assignees.length > 0 ? assignees : (defaultAssignee ? [defaultAssignee] : []),
      visualUrl,
      approved: false,
      emailReminderEnabled: !isBacklog && emailReminderEnabled,
      reminderEmail: reminderEmail.trim(),
      tags: [],
      comments: [],
      taskRoles: {
        designer: designerRole || undefined,
        publisher: publisherRole || undefined,
        engagementLead: engagementRole || undefined
      },
      stageCompletion: {
        designDone: false,
        publishDone: false,
        engagementDone: false
      },
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: creatorName,
          action: finalDate ? `Scheduled for ${finalDate} at ${finalTime}` : 'Created backlog idea',
          timestamp: logTimestamp()
        }
      ]
    };

    onAddPost(newPost);
    clearDraft();
    onClose();
  };

  const brand = BRANDS[brandId];
  const activeSpec = SPECS[specType];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-[#FAF9F5] border border-[#bfcab4] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#1b1c1a]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e5e4de] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
              style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
            >
              {brand?.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.name} className="w-6 h-6 object-contain" />
              ) : (
                <span className="material-symbols-outlined text-lg">{brand?.icon}</span>
              )}
            </div>
            <div>
              <span className="font-label-caps text-[10px] text-[#296951] uppercase font-bold tracking-wider">
                Create Content Post
              </span>
              <h3 className="font-display-xl text-lg font-bold text-[#1b1c1a]">
                New Post for {brand?.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBankDrawer(!showBankDrawer)}
              className="px-3 py-1.5 bg-[#efeeea] hover:bg-[#e5e4de] text-[#404a39] font-label-caps text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">auto_stories</span>
              <span className="hidden sm:inline">Swipe Copy</span>
            </button>
            <button
              onClick={() => {
                clearDraft();
                onClose();
              }}
              className="p-1.5 text-[#707a67] hover:text-[#1b1c1a] rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Form Body: 2-Column Responsive Layout */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── Left Column (Content, Brand, Media) ── */}
            <div className="lg:col-span-7 space-y-5">
              {/* Brand & Platform Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-1">
                    Target Brand
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value as BrandId)}
                    className="w-full bg-white border border-[#bfcab4] rounded-lg p-2.5 text-xs font-semibold text-[#1b1c1a] focus:ring-1 focus:ring-[#296c00] focus:outline-none"
                  >
                    {Object.values(BRANDS).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-1">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="w-full bg-white border border-[#bfcab4] rounded-lg p-2.5 text-xs font-semibold text-[#1b1c1a] focus:ring-1 focus:ring-[#296c00] focus:outline-none"
                  >
                    {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-1">
                  Post Title / Headline *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lipase Enzyme Kinetics & Activation"
                  className="w-full bg-white border border-[#bfcab4] rounded-lg p-2.5 text-sm font-semibold text-[#1b1c1a] placeholder:text-[#bfcab4] focus:ring-1 focus:ring-[#296c00] focus:outline-none"
                />
              </div>

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                    Caption & Body Copy
                  </label>
                  <span className="text-[10px] text-[#707a67] font-code-sm">
                    {caption.length} chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write the full post caption, medical rationale, hooks, and call-to-action..."
                  className="w-full bg-white border border-[#bfcab4] rounded-lg p-2.5 text-xs text-[#1b1c1a] placeholder:text-[#bfcab4] focus:ring-1 focus:ring-[#296c00] focus:outline-none resize-y"
                />
              </div>

              {/* Visual Attachment & Spec Dimension Helper */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-[#e5e4de]">
                <div className="flex items-center justify-between">
                  <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                    Visual Attachment & Format
                  </label>
                  <select
                    value={specType}
                    onChange={(e) => setSpecType(e.target.value as SpecType)}
                    className="bg-[#faf9f5] border border-[#bfcab4] rounded-md px-2 py-1 text-[11px] font-label-caps text-[#1b1c1a]"
                  >
                    {Object.values(SPECS).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.dimensions})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Image Dropzone & Preview */}
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg bg-[#faf9f5] border-2 border-dashed border-[#bfcab4] overflow-hidden flex items-center justify-center relative flex-shrink-0">
                    {visualUrl ? (
                      <img src={visualUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-[#bfcab4]">image</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-3 py-1.5 bg-[#efeeea] hover:bg-[#e5e4de] text-[#296c00] font-label-caps text-xs font-bold rounded-lg border border-[#bfcab4] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">upload</span>
                        <span>{isUploading ? 'Uploading...' : visualUrl ? 'Replace Image' : 'Upload Image'}</span>
                      </button>
                      {visualUrl && (
                        <button
                          type="button"
                          onClick={() => setVisualUrl('')}
                          className="px-2 py-1 text-xs text-[#ba1a1a] hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[#707a67]">
                      Recommended: {activeSpec?.dimensions} • Max 5MB (JPG, PNG, WebP)
                    </p>
                    {uploadError && <p className="text-[10px] text-[#ba1a1a]">{uploadError}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right Column (Scheduling, Email Reminders, Multi-Assignees & Roles) ── */}
            <div className="lg:col-span-5 space-y-5">
              {/* Scheduling Card */}
              <div className="bg-white p-4 rounded-xl border border-[#e5e4de] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#e5e4de]">
                  <h4 className="font-display-xl text-sm font-bold text-[#1b1c1a] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#296c00]">event</span>
                    <span>Schedule & Timing</span>
                  </h4>
                  <label className="flex items-center gap-1.5 text-xs font-label-caps text-[#707a67] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isBacklog}
                      onChange={(e) => setIsBacklog(e.target.checked)}
                      className="w-3.5 h-3.5 text-[#296c00] rounded focus:ring-[#296c00]"
                    />
                    <span>Save to Backlog (No Date)</span>
                  </label>
                </div>

                {!isBacklog && (
                  <div className="space-y-3">
                    <div>
                      <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-1">
                        Scheduled Date
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-[#faf9f5] border border-[#bfcab4] rounded-lg p-2 text-xs font-semibold text-[#1b1c1a] focus:ring-1 focus:ring-[#296c00] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block mb-1">
                        Scheduled Time
                      </label>
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {TIME_PRESETS.map((p) => (
                          <button
                            key={p.time}
                            type="button"
                            onClick={() => setScheduledTime(p.time)}
                            className={`px-2 py-1 rounded text-[10px] font-label-caps font-bold transition-all cursor-pointer ${
                              scheduledTime === p.time
                                ? 'bg-[#296c00] text-white'
                                : 'bg-[#efeeea] text-[#404a39] hover:bg-[#e4e2db]'
                            }`}
                          >
                            {p.time}
                          </button>
                        ))}
                      </div>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full bg-[#faf9f5] border border-[#bfcab4] rounded-lg p-2 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#296c00] focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Email Reminder Card (Auto-Enabled & 1-Click Test) ── */}
              {!isBacklog && (
                <div className="bg-[#f7faf4] p-4 rounded-xl border border-[#296c00]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#1b1c1a] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailReminderEnabled}
                        onChange={(e) => setEmailReminderEnabled(e.target.checked)}
                        className="w-4 h-4 text-[#296c00] rounded focus:ring-[#296c00]"
                      />
                      <span>Enable Email Reminder</span>
                    </label>
                    <span className="font-label-caps text-[9px] bg-[#296c00] text-white px-2 py-0.5 rounded-full font-bold">
                      Automated
                    </span>
                  </div>

                  {emailReminderEnabled && (
                    <div className="space-y-2 pt-1">
                      <label className="font-label-caps text-[9px] text-[#707a67] uppercase font-bold block">
                        Recipient Email(s)
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="email"
                          value={reminderEmail}
                          onChange={(e) => setReminderEmail(e.target.value)}
                          placeholder="e.g. hamzaansari4you@gmail.com"
                          className="flex-1 bg-white border border-[#bfcab4] rounded-lg p-2 text-xs text-[#1b1c1a] focus:ring-1 focus:ring-[#296c00] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSendTestEmail}
                          disabled={sendingEmail}
                          className="px-2.5 py-1.5 bg-[#296c00] hover:bg-[#205400] text-white font-label-caps text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          title="Send a real test reminder email right now"
                        >
                          <span className="material-symbols-outlined text-xs">send</span>
                          <span>{sendingEmail ? 'Sending...' : 'Test Send'}</span>
                        </button>
                      </div>
                      {emailStatus && (
                        <p className={`text-[10px] font-bold ${emailStatus.includes('✓') ? 'text-[#296c00]' : 'text-[#ba1a1a]'}`}>
                          {emailStatus}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Team Assignees & Specialized Roles */}
              <div className="bg-white p-4 rounded-xl border border-[#e5e4de] space-y-3">
                <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block">
                  Assignees
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {teamMembers.map((m) => {
                    const isSelected = assignees.includes(m.name);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleAssignee(m.name)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#296c00] text-white shadow-xs'
                            : 'bg-[#efeeea] text-[#404a39] hover:bg-[#e4e2db]'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: m.color || '#707a67' }}
                        >
                          {m.avatarInitials}
                        </span>
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Specialized Task Roles */}
                <div className="pt-2 border-t border-[#e5e4de] space-y-2">
                  <span className="font-label-caps text-[9px] text-[#707a67] uppercase font-bold block">
                    Specialized Roles (Optional)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-[#707a67] block mb-0.5">🎨 Designer</span>
                      <select
                        value={designerRole}
                        onChange={(e) => setDesignerRole(e.target.value)}
                        className="w-full bg-[#faf9f5] border border-[#bfcab4] rounded p-1 text-[11px]"
                      >
                        <option value="">None</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#707a67] block mb-0.5">🚀 Publisher</span>
                      <select
                        value={publisherRole}
                        onChange={(e) => setPublisherRole(e.target.value)}
                        className="w-full bg-[#faf9f5] border border-[#bfcab4] rounded p-1 text-[11px]"
                      >
                        <option value="">None</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#707a67] block mb-0.5">💬 Lead</span>
                      <select
                        value={engagementRole}
                        onChange={(e) => setEngagementRole(e.target.value)}
                        className="w-full bg-[#faf9f5] border border-[#bfcab4] rounded p-1 text-[11px]"
                      >
                        <option value="">None</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#e5e4de]">
            <button
              type="button"
              onClick={() => {
                clearDraft();
                onClose();
              }}
              className="px-4 py-2.5 text-xs font-label-caps font-bold text-[#707a67] hover:text-[#1b1c1a] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#296c00] hover:bg-[#205400] text-white font-label-caps text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>{isBacklog ? 'Add to Idea Backlog' : 'Schedule Post'}</span>
            </button>
          </div>
        </form>

        {/* Swipe Copy / Content Bank Drawer */}
        {showBankDrawer && (
          <div className="border-t border-[#e5e4de] bg-[#f7f6f2] p-4 max-h-60 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-xs font-bold text-[#296c00] uppercase">
                Insert Copy from Content Bank
              </span>
              <input
                type="text"
                value={bankSearchQuery}
                onChange={(e) => setBankSearchQuery(e.target.value)}
                placeholder="Search copy items..."
                className="bg-white border border-[#bfcab4] rounded-md px-2 py-1 text-xs w-48"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {contentBank
                .filter((item) =>
                  !bankSearchQuery || item.text.toLowerCase().includes(bankSearchQuery.toLowerCase())
                )
                .slice(0, 6)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCaption(item.text);
                      setShowBankDrawer(false);
                    }}
                    className="p-2.5 bg-white border border-[#bfcab4] rounded-lg cursor-pointer hover:border-[#296c00] transition-colors"
                  >
                    <p className="text-xs text-[#1b1c1a] line-clamp-2">{item.text}</p>
                    <span className="text-[9px] text-[#707a67] mt-1 block">Click to insert</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
