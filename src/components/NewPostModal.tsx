import React, { useState, useRef, useEffect } from 'react';
import { Post, BrandId, Platform, SpecType, PostTemplate, ContentBankItem, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { todayStr, logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';
import { combineAssigneeEmails } from '../utils/postOwnership';
import { useSmartMemory, PostDraft } from '../hooks/useSmartMemory';
import { useImageUploadZone } from '../hooks/useImageUploadZone';
import { supabase } from '../lib/supabase';
import { Modal } from './ui/Modal';
import { TextField, TextAreaField, SelectField } from './ui/Field';
import { Button } from './ui/Button';
import { Stepper, StepDef } from './ui/Stepper';
import { useConfirm } from './ui/ConfirmDialog';

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

const STEPS: StepDef[] = [
  { id: 'what', label: 'What' },
  { id: 'copy', label: 'Copy' },
  { id: 'when', label: 'When & who' }
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
  const confirm = useConfirm();

  // Wizard state
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);

  const [title, setTitle] = useState(initialDraft?.title || '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
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

  // Assignees
  const defaultAssignee = activeTeammate ? activeTeammate.name : (teamMembers.length > 0 ? teamMembers[0].name : '');
  const [assignees, setAssignees] = useState<string[]>(
    initialDraft?.assignees || (defaultAssignee ? [defaultAssignee] : [])
  );

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

  // Content Bank / Swipe Copy Drawer
  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // Auto-sync reminder email when assignees change
  useEffect(() => {
    if (!teamMembers || teamMembers.length === 0) return;
    const combined = combineAssigneeEmails(assignees, teamMembers);
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

  // The presence of a title or caption is what makes this draft worth saving
  // -- and worth protecting from an accidental close. Both the autosave
  // effect below and the Modal's `isDirty` prop key off this same condition.
  const isDirty = Boolean(title.trim() || caption.trim());

  // Auto-save draft on changes
  useEffect(() => {
    if (isDirty) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, caption, brandId, platform, isBacklog, scheduledDate, scheduledTime, assignees, visualUrl, reminderEmail, saveDraft]);

  const toggleAssignee = (name: string) => {
    setAssignees((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  // Image Upload -- reuses src/utils/uploadImage.ts unchanged (compression,
  // auth token, Drive upload, UploadNotConfiguredError all live there).
  const uploadFile = async (file: File) => {
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

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadFile(file);
  };

  const { isDragging, dropHandlers } = useImageUploadZone(uploadFile, isUploading);

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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch('/api/appscript/proxy', {
        method: 'POST',
        headers,
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
      if (res.ok && (data.status === 'success' || data.result === 'success' || data?.data?.status === 'success')) {
        setEmailStatus(`✓ Test reminder sent to ${recipient}`);
      } else {
        setEmailStatus(`❌ ${data?.data?.error || data?.message || data?.error || 'Failed to send'}`);
      }
    } catch (err: any) {
      setEmailStatus(`Send failed: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // Step 1 (title) validation -- this is the exact fix from Phase 1, re-homed:
  // a real inline error via titleError/titleInputRef instead of a silent no-op.
  const validateStep1 = (): boolean => {
    if (!title.trim()) {
      setTitleError('Give this post a title so the team can find it.');
      titleInputRef.current?.focus();
      return false;
    }
    setTitleError(null);
    return true;
  };

  const goToStep = (index: number) => {
    setStep(index);
    setFurthestStep((f) => Math.max(f, index));
  };

  const handleNext = () => {
    if (step === 0 && !validateStep1()) return;
    goToStep(Math.min(step + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const handleStepClick = (index: number) => {
    if (index === step) return;
    if (index > step && step === 0 && !validateStep1()) return;
    goToStep(index);
  };

  const dirtyPrompt = {
    title: 'Discard this draft?',
    body: 'Your draft will be lost. This can’t be undone.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep draft'
  };

  // Single funnel for clearing the autosaved draft -- only ever called once
  // the user has actually agreed to lose it (or after a successful submit).
  const handleModalClose = () => {
    clearDraft();
    onClose();
  };

  // The footer Cancel button lives outside Modal's own header-X/Escape/
  // backdrop handling, so it re-implements the same dirty check here via the
  // shared ConfirmDialog, funneling into the same handleModalClose either way.
  const handleCancelClick = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: dirtyPrompt.title,
        body: dirtyPrompt.body,
        confirmLabel: dirtyPrompt.confirmLabel,
        cancelLabel: dirtyPrompt.cancelLabel,
        tone: 'danger'
      });
      if (!ok) return;
    }
    handleModalClose();
  };

  // Form Submit
  const handleSubmit = () => {
    if (!validateStep1()) {
      setStep(0);
      return;
    }

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
      // Specialized roles (Designer / Publisher / Engagement) and specType are
      // no longer set during creation -- PostDetailModal's own "Who does what"
      // card is the one place that sets them, post-creation.
      taskRoles: {},
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

  const isLastStep = step === STEPS.length - 1;

  // Single Enter-to-advance / Enter-to-submit path. The primary footer button
  // is a real type="submit" associated to this form via the `form` attribute
  // (Modal renders `footer` as a sibling of `children`, not nested inside
  // it), so pressing Enter in any text/date/time/email field in the step
  // body -- the exact "button appears to do nothing" failure this phase
  // exists to eliminate -- reaches this handler instead of being silently
  // swallowed.
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLastStep) {
      handleSubmit();
    } else {
      handleNext();
    }
  };

  const brand = BRANDS[brandId];
  const activeSpec = SPECS[specType];

  const filteredBankItems = contentBank
    .filter((item) => !bankSearchQuery || item.text.toLowerCase().includes(bankSearchQuery.toLowerCase()))
    .slice(0, 6);

  return (
    <Modal
      isOpen={true}
      onClose={handleModalClose}
      eyebrow="Create content post"
      title={`New post for ${brand?.name || 'your brand'}`}
      size="md"
      isDirty={isDirty}
      dirtyPrompt={dirtyPrompt}
      initialFocusRef={titleInputRef}
      icon={
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0"
          style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
        >
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="w-6 h-6 object-contain" />
          ) : (
            <span className="material-symbols-outlined text-lg">{brand?.icon}</span>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button type="button" variant="ghost" onClick={handleCancelClick}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={handleBack}>
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button type="submit" form="new-post-form" variant="primary" icon="add_circle">
                {isBacklog ? 'Add to idea backlog' : 'Schedule post'}
              </Button>
            ) : (
              <Button type="submit" form="new-post-form" variant="primary" iconRight="arrow_forward">
                Next
              </Button>
            )}
          </div>
        </div>
      }
    >
      <form id="new-post-form" onSubmit={handleFormSubmit} className="space-y-5">
        <Stepper steps={STEPS} currentIndex={step} furthestIndex={furthestStep} onStepClick={handleStepClick} />

        {/* ── Step 1: What are you posting? ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-headline-md text-sm font-bold text-[var(--color-ink)]">What are you posting?</h3>
              <p className="font-body-md text-xs text-[var(--color-ink-muted)] mt-0.5">
                Pick a brand and platform, then give it a title so the team can find it.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Brand"
                value={brandId}
                onChange={(v) => setBrandId(v as BrandId)}
                options={Object.values(BRANDS).map((b) => ({ value: b.id, label: b.name }))}
              />
              <SelectField
                label="Platform"
                value={platform}
                onChange={(v) => setPlatform(v as Platform)}
                options={Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => ({ value: key, label: cfg.label }))}
              />
            </div>

            <TextField
              ref={titleInputRef}
              label="Title"
              required
              value={title}
              onChange={(v) => { setTitle(v); if (titleError) setTitleError(null); }}
              error={titleError}
              placeholder="e.g. Lipase Enzyme Kinetics & Activation"
            />
          </div>
        )}

        {/* ── Step 2: What does it say? ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-headline-md text-sm font-bold text-[var(--color-ink)]">What does it say?</h3>
                <p className="font-body-md text-xs text-[var(--color-ink-muted)] mt-0.5">
                  Write the caption and attach an image, or reuse something from the content bank.
                </p>
              </div>
                <button
                  type="button"
                  onClick={() => setShowBankDrawer((v) => !v)}
                  className="px-2.5 py-1.5 bg-[var(--color-muted)] hover:bg-[var(--color-line)] text-[var(--color-ink-soft)] font-label-caps text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">auto_stories</span>
                  <span>Reuse saved copy</span>
                </button>
            </div>

            <TextAreaField
              label="Caption"
              value={caption}
              onChange={setCaption}
              rows={5}
              showCharCount
              placeholder="Write the full post caption, medical rationale, hooks, and call-to-action..."
            />

            {showBankDrawer && (
              <div className="border border-[var(--color-line)] rounded-lg bg-[var(--color-muted)] p-3 max-h-56 overflow-y-auto space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-label-caps text-[10px] font-bold text-[var(--color-accent)] uppercase">
                    Reuse saved copy
                  </span>
                  <input
                    type="text"
                    value={bankSearchQuery}
                    onChange={(e) => setBankSearchQuery(e.target.value)}
                    placeholder="Search copy items..."
                    className="bg-[var(--color-raised)] border border-[var(--color-line)] rounded-md px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
                {filteredBankItems.length === 0 ? (
                  <p className="text-[11px] text-[var(--color-ink-muted)] text-center py-2">No saved copy found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredBankItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => { setCaption(item.text); setShowBankDrawer(false); }}
                        className="p-2.5 bg-[var(--color-raised)] border border-[var(--color-line)] rounded-lg cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                      >
                        <p className="text-xs text-[var(--color-ink)] line-clamp-2">{item.text}</p>
                        <span className="text-[9px] text-[var(--color-ink-muted)] mt-1 block">Click to insert</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 bg-[var(--color-raised)] p-4 rounded-xl border border-[var(--color-line-subtle)]">
              <div className="flex items-center justify-between">
                <span className="font-body-md text-[13px] font-medium text-[var(--color-ink-soft)]">Image</span>
                <span className="text-[10px] text-[var(--color-ink-muted)]">
                  Recommended: {activeSpec?.dimensions}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div
                  {...dropHandlers}
                  className={`w-24 h-24 rounded-lg bg-[var(--color-muted)] border-2 border-dashed overflow-hidden flex items-center justify-center relative flex-shrink-0 transition-colors ${
                    isDragging ? 'border-[#296c00] bg-[#f0fae8]' : 'border-[var(--color-line)]'
                  }`}
                  title="Drop an image or paste a screenshot"
                >
                  {visualUrl ? (
                    <img src={visualUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-[var(--color-ink-muted)]">
                      {isDragging ? 'download' : 'image'}
                    </span>
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
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon="upload"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : visualUrl ? 'Replace image' : 'Upload image'}
                    </Button>
                    {visualUrl && (
                      <button
                        type="button"
                        onClick={() => setVisualUrl('')}
                        className="px-2 py-1 text-xs text-[var(--color-danger)] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--color-ink-muted)]">Max 5MB (JPG, PNG, WebP)</p>
                  {uploadError && <p className="text-[10px] text-[var(--color-danger)]">{uploadError}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: When and who? ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-headline-md text-sm font-bold text-[var(--color-ink)]">When and who?</h3>
              <p className="font-body-md text-xs text-[var(--color-ink-muted)] mt-0.5">
                Schedule it (or park it in the backlog) and choose who's on it.
              </p>
            </div>

            <div className="bg-[var(--color-raised)] p-4 rounded-xl border border-[var(--color-line-subtle)] space-y-3">
              <label className="flex items-center gap-1.5 text-xs font-label-caps text-[var(--color-ink-soft)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBacklog}
                  onChange={(e) => setIsBacklog(e.target.checked)}
                  className="w-3.5 h-3.5 text-[var(--color-accent)] rounded focus:ring-[var(--color-accent)]"
                />
                <span>Save to backlog (no date)</span>
              </label>

              {!isBacklog && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <TextField
                    label="Date"
                    type="date"
                    value={scheduledDate}
                    onChange={setScheduledDate}
                  />
                  <div>
                    <TextField
                      label="Time"
                      type="time"
                      value={scheduledTime}
                      onChange={setScheduledTime}
                    />
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      {TIME_PRESETS.map((p) => (
                        <button
                          key={p.time}
                          type="button"
                          onClick={() => setScheduledTime(p.time)}
                          className={`px-2 py-1 rounded text-[10px] font-label-caps font-bold transition-all cursor-pointer ${
                            scheduledTime === p.time
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-muted)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]'
                          }`}
                        >
                          {p.time}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[var(--color-raised)] p-4 rounded-xl border border-[var(--color-line-subtle)] space-y-2">
              <span className="font-body-md text-[13px] font-medium text-[var(--color-ink-soft)] block">Assignees</span>
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
                          ? 'bg-[var(--color-accent)] text-white shadow-xs'
                          : 'bg-[var(--color-muted)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: m.color || '#5f5f5b' }}
                      >
                        {m.avatarInitials}
                      </span>
                      <span>{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isBacklog && (
              <div className="bg-[var(--color-accent-soft)] p-4 rounded-xl border border-[var(--color-accent)]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailReminderEnabled}
                      onChange={(e) => setEmailReminderEnabled(e.target.checked)}
                      className="w-4 h-4 text-[var(--color-accent)] rounded focus:ring-[var(--color-accent)]"
                    />
                    <span>Email reminder</span>
                  </label>
                  <span className="font-label-caps text-[9px] bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full font-bold">
                    Automated
                  </span>
                </div>

                {emailReminderEnabled && (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1">
                        <TextField
                          label="Recipient email(s)"
                          type="email"
                          value={reminderEmail}
                          onChange={setReminderEmail}
                          placeholder="e.g. name@example.com"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon="send"
                        onClick={handleSendTestEmail}
                        disabled={sendingEmail}
                      >
                        {sendingEmail ? 'Sending...' : 'Test send'}
                      </Button>
                    </div>
                    {emailStatus && (
                      <p className={`text-[10px] font-bold ${emailStatus.includes('✓') ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}`}>
                        {emailStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
