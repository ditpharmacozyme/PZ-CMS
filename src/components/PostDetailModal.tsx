import React, { useState } from 'react';
import { Post, BrandId, Platform, SpecType, PostComment, ContentBankItem, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';
import { supabase } from '../lib/supabase';
import { getPostStatusConfig } from '../utils/statusConfig';
import { setStageDone, Stage } from '../utils/stages';
import { combineAssigneeEmails } from '../utils/postOwnership';
import { useConfirm } from './ui/ConfirmDialog';
import { useImageUploadZone } from '../hooks/useImageUploadZone';

interface PostDetailModalProps {
  post: Post;
  onSavePost: (updatedPost: Post) => void;
  onDeletePost: (postId: string) => void;
  onDuplicatePost: (post: Post) => void;
  onClose: () => void;
  contentBank?: ContentBankItem[];
  teamMembers?: TeamMember[];
  activeTeammate?: TeamMember | null;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  onSavePost,
  onDeletePost,
  onDuplicatePost,
  onClose,
  contentBank = [],
  teamMembers = [],
  activeTeammate = null
}) => {
  const confirm = useConfirm();
  const defaultAuthor = activeTeammate
    ? `${activeTeammate.name} (${activeTeammate.role})`
    : (teamMembers && teamMembers.length > 0 ? `${teamMembers[0].name} (${teamMembers[0].role})` : 'Team');
  const [editedPost, setEditedPost] = useState<Post>({ ...post });
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(defaultAuthor);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const brand = BRANDS[editedPost.brandId];
  const spec = SPECS[editedPost.specType];

  const handleDuplicateClick = () => {
    onDuplicatePost(editedPost);
  };

  // Cross-brand Voice Check (Soft Warning)
  const isCrossBrandMention = React.useMemo(() => {
    const text = editedPost.caption.toLowerCase() + ' ' + editedPost.title.toLowerCase();
    const otherBrands = Object.values(BRANDS).filter((b) => b.id !== editedPost.brandId);
    return otherBrands.some((b) => text.includes(b.name.toLowerCase()));
  }, [editedPost.caption, editedPost.title, editedPost.brandId]);

  // Send real test email reminder via Apps Script Proxy.
  // No hardcoded fallback recipient -- if reminderEmail is empty there is no
  // real address to send to, so we ask for one instead of silently mailing
  // a shared inbox that may not even exist anymore.
  // The recipient a reminder goes to when the field has never been touched:
  // the assignees' emails, not "whoever is first in the team list".
  const assigneeEmailFallback = combineAssigneeEmails(editedPost.assignees, teamMembers);
  // What the input shows: the user's own value once they've set anything
  // (including deliberately blanking it), the fallback only while it's
  // literally undefined. Not `||`, so a cleared field stays cleared, and no
  // `.trim()` here so a space can be typed before the next address.
  const reminderEmailValue = editedPost.reminderEmail ?? assigneeEmailFallback;
  // The address actually used on save / test-send (trimmed, fallback applied).
  const resolvedReminderEmail = reminderEmailValue.trim();

  const handleSendTestEmail = async () => {
    const recipient = resolvedReminderEmail;
    if (!recipient) {
      setEmailStatus('Add a reminder email first.');
      return;
    }
    if (!supabase) {
      setEmailStatus('❌ Supabase is not configured.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setEmailStatus('❌ No active session.');
      return;
    }

    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch('/api/appscript/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payload: {
            action: 'sendEmailReminder',
            post: editedPost,
            recipientEmail: recipient
          }
        })
      });
      const data = await res.json();
      if (res.ok && data?.data?.status === 'success') {
        setEmailStatus(`✓ Email sent to ${recipient}`);
      } else {
        setEmailStatus(`❌ ${data?.data?.error || data?.message || data?.error || 'Failed to send'}`);
      }
    } catch (err: any) {
      setEmailStatus(`❌ Error: ${err.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle Copy Hex Code
  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopyFeedback(`Copied ${hex}!`);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  // Upload to Drive and store only the returned URL — never base64.
  const uploadFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadImage(file);
      const actorName = activeTeammate ? activeTeammate.name : (editedPost.assignees[0] || 'Someone');
      setEditedPost((prev) => ({
        ...prev,
        visualUrl: url,
        activityLog: [
          {
            id: `act-${Date.now()}`,
            actor: actorName,
            action: `Added image "${file.name}"`,
            timestamp: logTimestamp()
          },
          ...prev.activityLog
        ]
      }));
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadFile(file);
  };

  const { isDragging, dropHandlers } = useImageUploadZone(uploadFile, isUploading);

  // Handle a stage checkbox flip -- persists immediately (see comment at the
  // checkbox grid) via the same utils/stages.ts mutator the calendar quick
  // toggles use, so both paths stamp *DoneAt/*DoneBy and recompute status
  // identically.
  const handleStageToggle = (stage: Stage) => {
    const actorName = activeTeammate?.name || 'Someone';
    const current = editedPost.stageCompletion || {};
    const isDone = stage === 'design' ? current.designDone : stage === 'publish' ? current.publishDone : current.engagementDone;
    const nextPost = setStageDone(editedPost, stage, !isDone, actorName);
    setEditedPost(nextPost);
    onSavePost(nextPost);
  };

  // Handle Adding Comment
  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const comment: PostComment = {
      id: `c-${Date.now()}`,
      author: commentAuthor,
      text: newCommentText.trim(),
      timestamp: logTimestamp()
    };
    setEditedPost((prev) => ({
      ...prev,
      comments: [...prev.comments, comment]
    }));
    setNewCommentText('');
  };

  // Handle Save
  const handleSave = () => {
    // Assignee/role changes are no longer tracked here -- both now persist
    // immediately on their own onChange (matching the stage checkboxes
    // below), each writing its own activity log entry at the moment it
    // happens. Diffing against `post` here for them would double-log: `post`
    // is a snapshot taken when this modal opened and never re-syncs while
    // it's open, so it stays "stale" (pre-change) for the rest of this
    // session even after an instant-save updates editedPost.
    const actorName = activeTeammate ? activeTeammate.name : 'Someone';
    const logs = [...editedPost.activityLog];
    let changed = false;

    if (post.scheduledDate !== editedPost.scheduledDate || post.scheduledTime !== editedPost.scheduledTime) {
      const originalSched = post.scheduledDate ? `${post.scheduledDate} ${post.scheduledTime}` : 'Idea Backlog';
      const newSched = editedPost.scheduledDate ? `${editedPost.scheduledDate} ${editedPost.scheduledTime}` : 'Idea Backlog';
      logs.unshift({
        id: `act-${Date.now()}-sched`,
        actor: actorName,
        action: `Rescheduled from ${originalSched} to ${newSched}`,
        timestamp: logTimestamp()
      });
      changed = true;
    }

    if (post.caption !== editedPost.caption && !post.caption.trim() && editedPost.caption.trim()) {
      logs.unshift({
        id: `act-${Date.now()}-caption`,
        actor: actorName,
        action: 'Wrote caption copy',
        timestamp: logTimestamp()
      });
      changed = true;
    }

    const finalPost: Post = {
      ...(changed ? { ...editedPost, activityLog: logs } : editedPost),
      emailReminderEnabled: !!editedPost.scheduledDate && (editedPost.emailReminderEnabled !== false),
      // Persist the resolved recipient even if the user never touched the
      // field -- the input showed them an address, so store that one instead
      // of the empty string that get_due_reminders would keep re-serving.
      reminderEmail: resolvedReminderEmail || undefined,
    };
    onSavePost(finalPost);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end md:items-center justify-center md:p-6 overflow-hidden">
      {/* The panel: bottom-sheet on mobile, centered card on md+ */}
      <div className="bg-[#f4f4f3] border border-[#e9e9e7] w-full md:max-w-4xl md:rounded-lg shadow-2xl overflow-hidden max-h-[95dvh] md:max-h-[92vh] flex flex-col rounded-t-2xl md:rounded-lg sheet-modal relative">
        {isUploading && (
          <div className="absolute inset-0 bg-[#f4f4f3]/75 backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-auto">
            <div className="w-8 h-8 rounded-full border-2 border-[#4f46e5] border-t-transparent animate-spin mb-2" />
            <p className="font-label-caps text-[10px] text-[#4f46e5] font-bold tracking-wider">Uploading Image...</p>
          </div>
        )}
        {/* Drag handle (mobile only) */}
        <div className="pt-3 pb-0 flex justify-center md:hidden">
          <div className="sheet-handle" />
        </div>

        {/* Top Header Bar */}
        <div className="px-3 sm:px-4 py-3 bg-white border-b border-[#e9e9e7] flex items-center justify-between sticky top-0 z-10 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: brand?.primaryColor || '#4f46e5' }}
            />
            <span className="font-label-caps text-[11px] sm:text-xs font-bold text-[#4f46e5] truncate">
              {brand?.name} post
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleDuplicateClick}
              className="px-2.5 sm:px-3 py-1.5 min-h-[38px] bg-[#f1f1f0] border border-[#e9e9e7] font-label-caps text-[11px] sm:text-xs text-[#1b1c1a] hover:bg-[#4f46e5] hover:text-white transition-all rounded font-bold flex items-center gap-1.5 cursor-pointer"
              title="Duplicate Post"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              <span className="hidden sm:inline">Duplicate</span>
            </button>
            <button
              onClick={async () => {
                if (await confirm({ title: 'Delete this post from calendar?', confirmLabel: 'Delete', tone: 'danger' })) {
                  onDeletePost(editedPost.id);
                  onClose();
                }
              }}
              className="px-2.5 sm:px-3 py-1.5 min-h-[38px] bg-[#fcebeb] text-[#dc2626] font-label-caps text-[11px] sm:text-xs rounded hover:bg-[#dc2626] hover:text-white transition-all font-bold"
              title="Delete Post"
            >
              <span className="hidden sm:inline">Delete</span>
              <span className="sm:hidden material-symbols-outlined text-base">delete</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center text-[#5f5f5b] hover:text-[#1b1c1a] transition-colors"
              title="Close"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>


        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-5 md:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Title & Brand Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="font-label-caps text-[10px] sm:text-xs text-[#5f5f5b] font-bold">
                Title
              </label>
              <input
                type="text"
                value={editedPost.title}
                onChange={(e) => setEditedPost({ ...editedPost, title: e.target.value })}
                className="w-full bg-white border border-[#e9e9e7] p-2.5 min-h-[44px] font-headline-md text-sm sm:text-base font-bold text-[#1b1c1a] focus:border-[#4f46e5] focus:outline-none rounded-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] sm:text-xs text-[#5f5f5b] font-bold">
                Brand
              </label>
              <select
                value={editedPost.brandId}
                onChange={(e) => setEditedPost({ ...editedPost, brandId: e.target.value as BrandId })}
                className="w-full bg-white border border-[#e9e9e7] p-2.5 min-h-[44px] font-label-caps text-xs font-bold text-[#1b1c1a] focus:border-[#4f46e5] focus:outline-none rounded-xs"
              >
                {Object.values(BRANDS).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.shortCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STATUS -- derived from the stage checkboxes below, not set here */}
          <div className="bg-white p-3 sm:p-4 border border-[#e9e9e7] rounded shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-label-caps text-xs text-[#4f46e5] font-bold">
                Status
              </label>
              <span
                className="font-label-caps text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: getPostStatusConfig(editedPost).bgColor, color: getPostStatusConfig(editedPost).color }}
              >
                {getPostStatusConfig(editedPost).label}
              </span>
            </div>
            <p className="text-[11px] font-body-md text-[#5f5f5b]">
              Updates automatically as Design and Publish are checked off below.
            </p>
          </div>

          {/* ASSIGNEES -- Recurrence Rule moved into the scheduling card below,
              so it reads as one scheduling concept with date/time rather than
              a separate box. */}
          <div className="space-y-1 bg-white p-3 border border-[#e9e9e7] rounded">
            <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
              Assignees {editedPost.assignees.length > 0 && `(${editedPost.assignees.length})`}
            </label>
            {teamMembers && teamMembers.length > 0 ? (
              <div className="border border-[#e9e9e7] rounded divide-y divide-[#e9e9e7] max-h-28 overflow-y-auto">
                {teamMembers.map((m) => {
                  const checked = editedPost.assignees.includes(m.name);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-1.5 cursor-pointer hover:bg-[#f4f4f3] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          // Persists immediately, matching the stage checkboxes below
                          // instead of the rest of this form's "Save Changes" gate --
                          // assignment is exactly the kind of one-field change that
                          // shouldn't need a separate save step (see AssigneePopover,
                          // which does the same from calendar cards).
                          const nextAssignees = checked
                            ? editedPost.assignees.filter((n) => n !== m.name)
                            : [...editedPost.assignees, m.name];
                          const combined = combineAssigneeEmails(nextAssignees, teamMembers);
                          const actorName = activeTeammate ? activeTeammate.name : (editedPost.assignees[0] || 'Someone');
                          const nextPost: Post = {
                            ...editedPost,
                            assignees: nextAssignees,
                            reminderEmail: combined || editedPost.reminderEmail,
                            activityLog: [
                              {
                                id: `act-${Date.now()}-assignee`,
                                actor: actorName,
                                action: `Reassigned to ${nextAssignees.length > 0 ? nextAssignees.join(', ') : 'Unassigned'}`,
                                timestamp: logTimestamp()
                              },
                              ...editedPost.activityLog
                            ]
                          };
                          setEditedPost(nextPost);
                          onSavePost(nextPost);
                        }}
                        className="w-3.5 h-3.5 text-[#4f46e5] border-[#e9e9e7] rounded focus:ring-[#4f46e5]"
                      />
                      <span className="font-body-md text-[11px] text-[#1b1c1a] truncate">{m.name} ({m.role})</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] font-body-md text-[#5f5f5b] italic p-1.5">
                Add people in Settings → Team to assign this post.
              </p>
            )}
          </div>

          {/* TASK ROLES & HANDOFF TRACKING */}
          <div className="bg-white p-4 border border-[#e9e9e7] rounded space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#e9e9e7]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4338ca]" style={{ fontSize: '18px' }}>alt_route</span>
                <label className="font-label-caps text-[10px] text-[#4338ca] font-bold tracking-wider">
                  Who does what
                </label>
              </div>
              <span className="font-label-caps text-[9px] text-[#5f5f5b] font-bold">Multi-person Workflow</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-label-caps text-[9px] text-[#5f5f5b] font-bold block mb-1">
                  🎨 Designer
                </label>
                <select
                  value={editedPost.taskRoles?.designer || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextPost: Post = { ...editedPost, taskRoles: { ...editedPost.taskRoles, designer: val || undefined } };
                    setEditedPost(nextPost);
                    onSavePost(nextPost);
                  }}
                  className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-[#5f5f5b] font-bold block mb-1">
                  🚀 Publisher
                </label>
                <select
                  value={editedPost.taskRoles?.publisher || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextPost: Post = { ...editedPost, taskRoles: { ...editedPost.taskRoles, publisher: val || undefined } };
                    setEditedPost(nextPost);
                    onSavePost(nextPost);
                  }}
                  className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label-caps text-[9px] text-[#5f5f5b] font-bold block mb-1">
                  💬 Engagement
                </label>
                <select
                  value={editedPost.taskRoles?.engagementLead || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextPost: Post = { ...editedPost, taskRoles: { ...editedPost.taskRoles, engagementLead: val || undefined } };
                    setEditedPost(nextPost);
                    onSavePost(nextPost);
                  }}
                  className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Workflow Stage Completion Checklist -- persists immediately
                (like the calendar quick-toggles), unlike the rest of this
                form which waits for Save Changes, because status derives
                from these the instant they change (see utils/postStatus.ts)
                and a stale local-only status would be actively misleading. */}
            <div className="pt-2 border-t border-[#e9e9e7]/50 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 bg-[#f4f4f3] border border-[#e9e9e7] rounded cursor-pointer hover:bg-[#f1f1f0]">
                <input
                  type="checkbox"
                  checked={!!editedPost.stageCompletion?.designDone}
                  onChange={() => handleStageToggle('design')}
                  className="w-4 h-4 text-[#4f46e5] border-[#e9e9e7] rounded"
                />
                <div className="flex flex-col">
                  <span className="font-label-caps text-xs font-bold text-[#1b1c1a]">🎨 Design Done</span>
                  {editedPost.stageCompletion?.designDoneAt && (
                    <span className="text-[9px] text-[#5f5f5b]">by {editedPost.stageCompletion.designDoneBy}</span>
                  )}
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 bg-[#f4f4f3] border border-[#e9e9e7] rounded cursor-pointer hover:bg-[#f1f1f0]">
                <input
                  type="checkbox"
                  checked={!!editedPost.stageCompletion?.publishDone}
                  onChange={() => handleStageToggle('publish')}
                  className="w-4 h-4 text-[#4f46e5] border-[#e9e9e7] rounded"
                />
                <div className="flex flex-col">
                  <span className="font-label-caps text-xs font-bold text-[#1b1c1a]">🚀 Published</span>
                  {editedPost.stageCompletion?.publishDoneAt && (
                    <span className="text-[9px] text-[#5f5f5b]">by {editedPost.stageCompletion.publishDoneBy}</span>
                  )}
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 bg-[#f4f4f3] border border-[#e9e9e7] rounded cursor-pointer hover:bg-[#f1f1f0]">
                <input
                  type="checkbox"
                  checked={!!editedPost.stageCompletion?.engagementDone}
                  onChange={() => handleStageToggle('engagement')}
                  className="w-4 h-4 text-[#4f46e5] border-[#e9e9e7] rounded"
                />
                <div className="flex flex-col">
                  <span className="font-label-caps text-xs font-bold text-[#1b1c1a]">💬 Engagement Monitored</span>
                  {editedPost.stageCompletion?.engagementDoneAt && (
                    <span className="text-[9px] text-[#5f5f5b]">by {editedPost.stageCompletion.engagementDoneBy}</span>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* EMAIL REMINDER DATE, TIME, EMAIL, PLATFORM, SPEC */}
          <div className="bg-white p-4 border border-[#e9e9e7] rounded space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e9e9e7]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4f46e5]" style={{ fontSize: '16px' }}>mark_email_unread</span>
                <label className="font-label-caps text-[10px] text-[#4f46e5] font-bold">
                  Instagram Posting Email Reminder
                </label>
              </div>
              {/* The only place, other than NewPostModal, this can be turned
                  off after creation -- drag-reschedules and the detail modal
                  used to silently keep re-arming it with no visible switch. */}
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0" title="Send a reminder email for this post">
                <input
                  type="checkbox"
                  checked={editedPost.emailReminderEnabled !== false}
                  onChange={(e) => setEditedPost({ ...editedPost, emailReminderEnabled: e.target.checked })}
                  className="w-4 h-4 text-[#4f46e5] border-[#e9e9e7] rounded focus:ring-[#4f46e5]"
                />
                <span className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                  {editedPost.emailReminderEnabled !== false ? 'On' : 'Off'}
                </span>
              </label>
            </div>
            <p className="font-body-md text-[10px] text-[#5f5f5b]">
              Set a date & time to receive a reminder email — we post directly on Instagram, so this is your cue.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Reminder Date
              </label>
              <input
                type="date"
                value={editedPost.scheduledDate}
                onChange={(e) => setEditedPost({ ...editedPost, scheduledDate: e.target.value })}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-code-sm text-xs text-[#1b1c1a] rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Reminder Time
              </label>
              <input
                type="time"
                value={editedPost.scheduledTime}
                onChange={(e) => setEditedPost({ ...editedPost, scheduledTime: e.target.value })}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-code-sm text-xs text-[#1b1c1a] rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Repeat this post
              </label>
              <select
                value={editedPost.recurrenceRule || 'none'}
                onChange={(e) => setEditedPost({ ...editedPost, recurrenceRule: e.target.value })}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none rounded"
              >
                {/* Values are parsed as exact strings by CalendarView.tsx and
                    PostCard.tsx (ghost "repeating slot" placeholders) --
                    only the visible label text changes here. */}
                <option value="none">Doesn't repeat</option>
                <option value="weekly:monday">Every Monday</option>
                <option value="weekly:friday">Every Friday</option>
                <option value="monthly">Every month</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Target Platform
              </label>
              <select
                value={editedPost.platform}
                onChange={(e) => setEditedPost({ ...editedPost, platform: e.target.value as Platform })}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-label-caps text-xs text-[#1b1c1a]"
              >
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">X / Twitter</option>
                <option value="web">Web Portal</option>
                <option value="email">Email Broadcast</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Spec Helper
              </label>
              <select
                value={editedPost.specType}
                onChange={(e) => setEditedPost({ ...editedPost, specType: e.target.value as SpecType })}
                className="w-full bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-label-caps text-xs text-[#1b1c1a]"
              >
                {Object.values(SPECS).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.dimensions})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2 md:col-span-1">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Reminder Email
              </label>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={reminderEmailValue}
                  onChange={(e) => setEditedPost({ ...editedPost, reminderEmail: e.target.value })}
                  placeholder="e.g. name@example.com"
                  className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] p-1.5 font-body-md text-xs text-[#1b1c1a] rounded"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingEmail}
                  className="px-2.5 py-1 bg-[#4f46e5] text-white font-label-caps text-[10px] font-bold rounded hover:bg-[#4338ca] disabled:opacity-50 transition-all flex items-center gap-1 whitespace-nowrap"
                  title="Send immediate reminder email test"
                >
                  <span className="material-symbols-outlined text-xs">send</span>
                  <span>{sendingEmail ? 'Sending...' : 'Send Email'}</span>
                </button>
              </div>
              {emailStatus && (
                <p className={`text-[10px] font-label-caps mt-1 font-bold ${emailStatus.includes('✓') ? 'text-[#15803d]' : 'text-[#dc2626]'}`}>
                  {emailStatus}
                </p>
              )}
            </div>
            </div>
          </div>

          {/* Auto Spec Helper Banner */}
          <div className="p-3 bg-[#f1f1f0] border border-[#e9e9e7] rounded flex items-center justify-between text-xs font-label-caps">
            <div>
              <span className="font-bold text-[#4f46e5]">{spec?.name}:</span>{' '}
              <span className="text-[#1b1c1a] font-code-sm">{spec?.dimensions}</span> ({spec?.aspectRatio})
            </div>
            <span className="text-[#5f5f5b] text-[10px]">{spec?.description}</span>
          </div>

          {/* CAPTION & VISUAL ATTACHMENT ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Caption & Voice Check */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                  Caption
                </label>
                {isCrossBrandMention && (
                  <span className="text-[10px] font-label-caps text-[#dc2626] bg-[#fcebeb] px-1.5 py-0.5 rounded font-bold">
                    ⚠️ Cross-Brand Mention Detected
                  </span>
                )}
              </div>

              <div className="relative">
                <textarea
                  value={editedPost.caption}
                  onChange={(e) => setEditedPost({ ...editedPost, caption: e.target.value })}
                  rows={6}
                  placeholder="Write caption here..."
                  className="w-full bg-white border border-[#e9e9e7] p-3 font-body-md text-xs text-[#1b1c1a] focus:border-[#4f46e5] focus:outline-none"
                />
                {/* Reuse saved copy button -- same action + same label as NewPostModal's
                    Step 2, so it doesn't read as a second, differently-named feature. */}
                <button
                  type="button"
                  onClick={() => setShowBankDrawer(!showBankDrawer)}
                  className="absolute bottom-2 right-2 flex items-center gap-1 bg-[#f1f1f0] border border-[#e9e9e7] text-[#4f46e5] text-[10px] font-label-caps font-bold px-2 py-1 rounded hover:bg-[#eef2ff] transition-colors"
                  title="Reuse saved copy"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>article</span>
                  Reuse saved copy
                </button>

                {/* Reuse saved copy mini drawer */}
                {showBankDrawer && (
                  <div className="absolute z-10 bottom-10 right-0 w-72 max-h-64 overflow-y-auto bg-white border border-[#e9e9e7] rounded shadow-xl">
                    <div className="p-2 border-b border-[#e9e9e7] flex gap-1.5 sticky top-0 bg-white">
                      <input
                        type="text"
                        value={bankSearchQuery}
                        onChange={(e) => setBankSearchQuery(e.target.value)}
                        placeholder="Search copy..."
                        className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] rounded px-2 py-1 text-[10px] focus:outline-none"
                      />
                      <button onClick={() => setShowBankDrawer(false)} className="text-[#5f5f5b] hover:text-[#1b1c1a]">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    </div>
                    {contentBank
                      .filter(item =>
                        item.brandId === 'shared' || item.brandId === editedPost.brandId
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
                            setEditedPost(prev => ({ ...prev, caption: prev.caption + (prev.caption ? '\n\n' : '') + item.text }));
                            setShowBankDrawer(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[10px] text-[#1b1c1a] hover:bg-[#eef2ff] border-b border-[#e9e9e7]/50 leading-relaxed"
                        >
                          <p className="line-clamp-3">{item.text}</p>
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="bg-[#f1f1f0] text-[#5f5f5b] text-[9px] px-1 rounded">{tag}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    {contentBank.filter(item => item.brandId === 'shared' || item.brandId === editedPost.brandId).length === 0 && (
                      <p className="p-3 text-[10px] text-[#5f5f5b] text-center">No content bank items for this brand.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Inline Brand Guardrails Shelf */}
              <div className="p-3 bg-[#f4f4f3] border border-[#e9e9e7] rounded space-y-2 text-xs">
                <span className="font-label-caps text-[10px] text-[#4f46e5] font-bold block">
                  Inline Brand Voice Rules ({brand?.name})
                </span>
                <ul className="space-y-1 text-[11px] font-body-md text-[#57574f] list-disc list-inside">
                  {brand?.voiceRules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>

                {/* Color Palette Click-to-Copy */}
                <div className="pt-2 flex items-center gap-2">
                  <span className="font-label-caps text-[9px] text-[#5f5f5b]">Palette:</span>
                  {[brand?.primaryColor, brand?.secondaryColor, brand?.accentColor, '#f4f4f3'].map(
                    (hex, i) => (
                      <button
                        key={i}
                        onClick={() => hex && handleCopyHex(hex)}
                        className="w-5 h-5 rounded-full border border-[#e9e9e7] transition-transform hover:scale-110"
                        style={{ backgroundColor: hex }}
                        title={`Click to copy ${hex}`}
                      />
                    )
                  )}
                  {copyFeedback && (
                    <span className="font-label-caps text-[10px] text-[#4f46e5] font-bold">
                      {copyFeedback}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="space-y-3">
              <label className="font-label-caps text-[10px] text-[#5f5f5b] font-bold">
                Image
              </label>

              {/* Preview Box -- also a drop target; a screenshot can be pasted
                  anywhere in the modal. */}
              <div
                {...dropHandlers}
                className={`h-44 bg-white border rounded overflow-hidden flex items-center justify-center relative shadow-inner transition-colors ${
                  isDragging ? 'border-[#4f46e5] border-2 bg-[#eef2ff]' : 'border-[#e9e9e7]'
                }`}
              >
                {editedPost.visualUrl ? (
                  <img
                    src={editedPost.visualUrl}
                    alt="Post image"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-[#5f5f5b]">
                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                    <p className="font-label-caps text-xs mt-1">
                      {isDragging ? 'Drop to upload' : 'Drop an image, paste a screenshot, or use the picker below'}
                    </p>
                  </div>
                )}
              </div>

              {/* Attachment Inputs */}
              <div className="space-y-2">
                <div>
                  <label className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                    Upload from your device
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="w-full text-xs font-label-caps text-[#57574f] file:mr-2 file:py-1 file:px-3 file:border-0 file:text-xs file:font-label-caps file:bg-[#4f46e5] file:text-white hover:file:bg-[#4338ca] disabled:opacity-60"
                  />
                  {isUploading && (
                    <p className="mt-1 text-[10px] font-label-caps text-[#4f46e5]">Uploading…</p>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-[11px] font-body-md text-[#dc2626] bg-[#fcebeb] border border-[#ffb4ab] rounded p-2">
                      {uploadError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-label-caps text-[9px] text-[#5f5f5b] block mb-1">
                    Or paste a link (Drive, Canva, Figma)
                  </label>
                  <input
                    type="text"
                    value={editedPost.visualUrl}
                    onChange={(e) => setEditedPost({ ...editedPost, visualUrl: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-white border border-[#e9e9e7] p-1.5 font-code-sm text-xs text-[#1b1c1a]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COMMENTS & COLLABORATION THREAD */}
          <div className="bg-white p-4 border border-[#e9e9e7] rounded space-y-3">
            <h3 className="font-label-caps text-xs font-bold text-[#4f46e5]">
              Collaboration & Feedback Thread ({editedPost.comments.length})
            </h3>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {editedPost.comments.length === 0 ? (
                <p className="text-xs font-body-md text-[#5f5f5b] py-2">
                  No comments yet. Start the review conversation below.
                </p>
              ) : (
                editedPost.comments.map((c) => (
                  <div key={c.id} className="p-2.5 bg-[#f4f4f3] border border-[#e9e9e7] rounded text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label-caps font-bold text-[#4f46e5]">{c.author}</span>
                      <span className="font-code-sm text-[10px] text-[#5f5f5b]">{c.timestamp}</span>
                    </div>
                    <p className="font-body-md text-[#1b1c1a]">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Write a feedback note or request edit..."
                className="flex-1 bg-[#f4f4f3] border border-[#e9e9e7] px-3 py-1.5 font-body-md text-xs text-[#1b1c1a] focus:outline-none"
              />
              <button
                onClick={handleAddComment}
                className="bg-[#4f46e5] text-white px-4 py-1.5 font-label-caps text-xs rounded hover:bg-[#4338ca]"
              >
                Comment
              </button>
            </div>
          </div>

          {/* ACTIVITY AUDIT LOG */}
          <div className="p-3 bg-[#f1f1f0] border border-[#e9e9e7] rounded space-y-2">
            <span className="font-label-caps text-[10px] text-[#5f5f5b] font-bold block">
              Activity ({editedPost.activityLog.length})
            </span>
            <div className="space-y-1 max-h-28 overflow-y-auto font-code-sm text-[11px] text-[#57574f]">
              {editedPost.activityLog.map((log) => (
                <div key={log.id} className="flex justify-between">
                  <span>
                    • <strong className="text-[#4f46e5]">{log.actor}:</strong> {log.action}
                  </span>
                  <span className="text-[#5f5f5b]">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls — sticky sheet action bar on mobile */}
        <div className="sheet-action-bar">
          <button
            onClick={onClose}
            className="flex-1 md:flex-none px-4 py-2.5 min-h-[48px] border border-[#e9e9e7] font-label-caps text-xs text-[#1b1c1a] hover:bg-[#f1f1f0] rounded font-bold"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="flex-1 md:flex-none px-5 sm:px-6 py-2.5 min-h-[48px] bg-[#4f46e5] text-white font-label-caps text-xs font-bold rounded shadow-xs hover:bg-[#4338ca] active:scale-95 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
