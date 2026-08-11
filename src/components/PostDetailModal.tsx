import React, { useState } from 'react';
import { Post, BrandId, PostStatus, Platform, SpecType, PostComment, ContentBankItem, TeamMember } from '../types';
import { BRANDS, SPECS } from '../data/brands';
import { logTimestamp } from '../utils/date';
import { uploadImage } from '../utils/uploadImage';

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

const PIPELINE_STATUSES: { value: PostStatus; label: string; color: string }[] = [
  { value: 'not-started', label: 'Not Started', color: '#707a67' },
  { value: 'in-progress', label: 'In Progress', color: '#c77a00' },
  { value: 'ready-to-post', label: 'Ready to Post', color: '#296951' },
  { value: 'posted', label: 'Posted', color: '#296c00' }
];

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
  const defaultAuthor = activeTeammate
    ? `${activeTeammate.name} (${activeTeammate.role})`
    : (teamMembers && teamMembers.length > 0 ? `${teamMembers[0].name} (${teamMembers[0].role})` : 'Team');
  const [editedPost, setEditedPost] = useState<Post>({ ...post });
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState(defaultAuthor);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [approvalWarning, setApprovalWarning] = useState<string | null>(null);
  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const brand = BRANDS[editedPost.brandId];
  const spec = SPECS[editedPost.specType];

  const handleDuplicateClick = async () => {
    setIsDuplicating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      onDuplicatePost(editedPost);
    } finally {
      setIsDuplicating(false);
    }
  };

  // Cross-brand Voice Check (Soft Warning)
  const isCrossBrandMention = React.useMemo(() => {
    const text = editedPost.caption.toLowerCase() + ' ' + editedPost.title.toLowerCase();
    const otherBrands = Object.values(BRANDS).filter((b) => b.id !== editedPost.brandId);
    return otherBrands.some((b) => text.includes(b.name.toLowerCase()));
  }, [editedPost.caption, editedPost.title, editedPost.brandId]);

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
            post: editedPost,
            recipientEmail: editedPost.reminderEmail || 'team@pharmacozyme.com'
          }
        })
      });
      const data = await res.json();
      if (data?.data?.status === 'success') {
        setEmailStatus(`✓ Email sent to ${editedPost.reminderEmail || 'team@pharmacozyme.com'}`);
      } else {
        setEmailStatus(`❌ ${data?.data?.error || data?.error || 'Failed to send'}`);
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
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

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

  // Handle Status Pipeline Change (Non-blocking - soft advisory warning only)
  const handleStatusChange = (newStatus: PostStatus) => {
    if ((newStatus === 'ready-to-post' || newStatus === 'posted') && !editedPost.approved) {
      setApprovalWarning(
        'Advisory: This post has not been signed off. You can still proceed, but approval is recommended before posting.'
      );
      // Non-blocking — continue the status update
    } else {
      setApprovalWarning(null);
    }
    const actorName = activeTeammate ? activeTeammate.name : (editedPost.assignees[0] || 'Someone');
    setEditedPost((prev) => ({
      ...prev,
      status: newStatus,
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: actorName,
          action: `Changed status to "${newStatus.replace(/-/g, ' ')}"`,
          timestamp: logTimestamp()
        },
        ...prev.activityLog
      ]
    }));
  };

  // Handle Approval Sign-Off Toggle
  const handleToggleApproval = () => {
    const isAllowed = activeTeammate?.userRole === 'Owner' || activeTeammate?.userRole === 'Manager' || activeTeammate?.name === 'Hamza Ansari';
    if (!isAllowed) {
      setApprovalWarning(`Permission Denied: Only Owner or Manager roles can approve posts. You are currently logged in as ${activeTeammate?.userRole || 'Editor'}.`);
      return;
    }

    const nextApproved = !editedPost.approved;
    const approverName = activeTeammate
      ? `${activeTeammate.name} (${activeTeammate.role})`
      : (teamMembers && teamMembers.length > 0 ? `${teamMembers[0].name} (${teamMembers[0].role})` : 'Team');
    const actorName = activeTeammate ? activeTeammate.name : approverName;
    setApprovalWarning(null);
    setEditedPost((prev) => ({
      ...prev,
      approved: nextApproved,
      approvedBy: nextApproved ? approverName : undefined,
      approvedAt: nextApproved ? logTimestamp() : undefined,
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: actorName,
          action: nextApproved ? 'Approved this post' : 'Removed approval',
          timestamp: logTimestamp()
        },
        ...prev.activityLog
      ]
    }));
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
    const actorName = activeTeammate ? activeTeammate.name : 'Someone';
    const logs = [...editedPost.activityLog];
    let changed = false;

    if (post.assignees.join(',') !== editedPost.assignees.join(',')) {
      logs.unshift({
        id: `act-${Date.now()}-assignee`,
        actor: actorName,
        action: `Reassigned to ${editedPost.assignees.length > 0 ? editedPost.assignees.join(', ') : 'Unassigned'}`,
        timestamp: logTimestamp()
      });
      changed = true;
    }

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

    const finalPost = changed ? { ...editedPost, activityLog: logs } : editedPost;
    onSavePost(finalPost);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end md:items-center justify-center md:p-6 overflow-hidden">
      {/* The panel: bottom-sheet on mobile, centered card on md+ */}
      <div className="bg-[#FAF9F5] border border-[#bfcab4] w-full md:max-w-4xl md:rounded-lg shadow-2xl overflow-hidden max-h-[95dvh] md:max-h-[92vh] flex flex-col rounded-t-2xl md:rounded-lg sheet-modal relative">
        {isDuplicating && (
          <div className="absolute inset-0 bg-[#FAF9F5]/90 backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-auto">
            <div className="w-10 h-10 rounded-full border-3 border-[#296c00] border-t-transparent animate-spin mb-3" />
            <p className="font-label-caps text-xs text-[#296c00] font-bold uppercase tracking-wider">Duplicating Post...</p>
            <p className="font-body-md text-xs text-[#707a67] mt-1">Please wait while the post is cloned.</p>
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-[#FAF9F5]/75 backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-auto">
            <div className="w-8 h-8 rounded-full border-2 border-[#296c00] border-t-transparent animate-spin mb-2" />
            <p className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase tracking-wider">Uploading Image...</p>
          </div>
        )}
        {/* Drag handle (mobile only) */}
        <div className="pt-3 pb-0 flex justify-center md:hidden">
          <div className="sheet-handle" />
        </div>

        {/* Top Header Bar */}
        <div className="px-3 sm:px-4 py-3 bg-white border-b border-[#bfcab4] flex items-center justify-between sticky top-0 z-10 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: brand?.primaryColor || '#296c00' }}
            />
            <span className="font-label-caps text-[11px] sm:text-xs font-bold text-[#296c00] uppercase truncate">
              {brand?.name} post
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleDuplicateClick}
              disabled={isDuplicating}
              className="px-2.5 sm:px-3 py-1.5 min-h-[38px] bg-[#efeeea] border border-[#bfcab4] font-label-caps text-[11px] sm:text-xs text-[#1b1c1a] hover:bg-[#296c00] hover:text-white transition-all rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Duplicate Post"
            >
              {isDuplicating ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#296c00] border-t-transparent animate-spin" />
                  <span className="hidden sm:inline">Duplicating...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Duplicate Post</span>
                  <span className="sm:hidden material-symbols-outlined text-base">content_copy</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this post from calendar?')) {
                  onDeletePost(editedPost.id);
                  onClose();
                }
              }}
              className="px-2.5 sm:px-3 py-1.5 min-h-[38px] bg-[#ffdad6] text-[#ba1a1a] font-label-caps text-[11px] sm:text-xs rounded hover:bg-[#ba1a1a] hover:text-white transition-all font-bold"
              title="Delete Post"
            >
              <span className="hidden sm:inline">Delete</span>
              <span className="sm:hidden material-symbols-outlined text-base">delete</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center text-[#707a67] hover:text-[#1b1c1a] transition-colors"
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
              <label className="font-label-caps text-[10px] sm:text-xs text-[#707a67] uppercase font-bold">
                Campaign / Post Title
              </label>
              <input
                type="text"
                value={editedPost.title}
                onChange={(e) => setEditedPost({ ...editedPost, title: e.target.value })}
                className="w-full bg-white border border-[#bfcab4] p-2.5 min-h-[44px] font-headline-md text-sm sm:text-base font-bold text-[#1b1c1a] focus:border-[#296c00] focus:outline-none rounded-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] sm:text-xs text-[#707a67] uppercase font-bold">
                Assigned Ecosystem Brand
              </label>
              <select
                value={editedPost.brandId}
                onChange={(e) => setEditedPost({ ...editedPost, brandId: e.target.value as BrandId })}
                className="w-full bg-white border border-[#bfcab4] p-2.5 min-h-[44px] font-label-caps text-xs font-bold text-[#1b1c1a] focus:border-[#296c00] focus:outline-none rounded-xs"
              >
                {Object.values(BRANDS).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.shortCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STATUS PIPELINE STEPPER */}
          <div className="bg-white p-3 sm:p-4 border border-[#bfcab4] rounded shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-label-caps text-xs text-[#296c00] uppercase font-bold">
                Status
              </label>
              <span className="font-label-caps text-[10px] sm:text-xs font-bold text-[#1b1c1a] uppercase bg-[#efeeea] px-2 py-0.5 border border-[#bfcab4] rounded capitalize">
                {editedPost.status.replace(/-/g, ' ')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
              {PIPELINE_STATUSES.map((st, idx) => {
                const isActive = editedPost.status === st.value;
                const currentIdx = PIPELINE_STATUSES.findIndex(s => s.value === editedPost.status);
                const isPassed = currentIdx >= idx;

                return (
                  <button
                    key={st.value}
                    onClick={() => handleStatusChange(st.value)}
                    className={`flex-1 min-w-[100px] sm:min-w-[110px] min-h-[40px] py-2 px-1 text-center font-label-caps text-[10px] font-bold uppercase transition-all border rounded flex-shrink-0 ${
                      isActive
                        ? 'bg-[#296c00] text-white border-[#296c00] shadow-xs'
                        : isPassed
                        ? 'bg-[#aceecf] text-[#07513b] border-[#bfcab4]'
                        : 'bg-[#faf9f5] text-[#707a67] border-[#bfcab4] hover:bg-[#efeeea]'
                    }`}
                  >
                    {idx + 1}. {st.label}
                  </button>
                );
              })}
            </div>

            {/* Advisory Approval Warning Banner (non-blocking) */}
            {approvalWarning && (
              <div className="p-3 bg-[#fff8e1] border border-[#c77a00] text-[#c77a00] rounded flex items-center justify-between text-xs font-body-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">info</span>
                  <span>{approvalWarning}</span>
                </div>
                <button
                  onClick={() => setApprovalWarning(null)}
                  className="text-[#c77a00] font-label-caps text-[10px] px-2 py-1 rounded border border-[#c77a00] hover:bg-[#c77a00]/10"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* APPROVAL GATE & ASSIGNEE ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Approval Box — advisory only, never blocks status or scheduling (PRD §5.4) */}
            <div className="p-3 bg-white border border-[#bfcab4] rounded flex flex-col justify-between">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold mb-1">
                Approved
              </label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label-caps text-xs font-bold text-[#1b1c1a]">
                    {editedPost.approved ? 'Yes' : 'Not yet'}
                  </p>
                  {editedPost.approvedBy && (
                    <p className="text-[10px] font-body-md text-[#707a67]">{editedPost.approvedBy}</p>
                  )}
                </div>
                <button
                  onClick={handleToggleApproval}
                  className={`px-3 py-1.5 font-label-caps text-xs rounded font-bold uppercase transition-all ${
                    editedPost.approved
                      ? 'bg-[#aceecf] text-[#07513b] border border-[#296c00]'
                      : 'bg-[#296c00] text-white hover:bg-[#1f5700]'
                  }`}
                >
                  {editedPost.approved ? 'Approved' : 'Approve'}
                </button>
              </div>
            </div>

            {/* Assignee Box */}
            <div className="space-y-1 bg-white p-3 border border-[#bfcab4] rounded">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Assignees {editedPost.assignees.length > 0 && `(${editedPost.assignees.length})`}
              </label>
              {teamMembers && teamMembers.length > 0 ? (
                <div className="border border-[#bfcab4] rounded divide-y divide-[#bfcab4] max-h-28 overflow-y-auto">
                  {teamMembers.map((m) => {
                    const checked = editedPost.assignees.includes(m.name);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 p-1.5 cursor-pointer hover:bg-[#faf9f5] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const wasEmpty = editedPost.assignees.length === 0;
                            setEditedPost((prev) => ({
                              ...prev,
                              assignees: checked
                                ? prev.assignees.filter((n) => n !== m.name)
                                : [...prev.assignees, m.name],
                              reminderEmail: wasEmpty && !checked && m.email ? m.email : prev.reminderEmail
                            }));
                          }}
                          className="w-3.5 h-3.5 text-[#296c00] border-[#bfcab4] rounded focus:ring-[#296c00]"
                        />
                        <span className="font-body-md text-[11px] text-[#1b1c1a] truncate">{m.name} ({m.role})</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] font-body-md text-[#707a67] italic p-1.5">
                  Add people in Settings → Team to assign this post.
                </p>
              )}
            </div>

            {/* Recurrence Rule Box */}
            <div className="space-y-1 bg-white p-3 border border-[#bfcab4] rounded">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Recurrence Rule
              </label>
              <select
                value={editedPost.recurrenceRule || 'none'}
                onChange={(e) => setEditedPost({ ...editedPost, recurrenceRule: e.target.value })}
                className="w-full bg-[#faf9f5] border border-[#bfcab4] p-1.5 font-label-caps text-xs text-[#1b1c1a] focus:outline-none"
              >
                <option value="none">One-time Post</option>
                <option value="weekly:monday">Every Monday Series</option>
                <option value="weekly:friday">Every Friday Quiz Series</option>
                <option value="monthly">Monthly Broadcast</option>
              </select>
            </div>
          </div>

          {/* EMAIL REMINDER DATE, TIME, EMAIL, PLATFORM, SPEC */}
          <div className="bg-white p-4 border border-[#bfcab4] rounded space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#bfcab4]">
              <span className="material-symbols-outlined text-[#296c00]" style={{ fontSize: '16px' }}>mark_email_unread</span>
              <label className="font-label-caps text-[10px] text-[#296c00] font-bold uppercase">
                Instagram Posting Email Reminder
              </label>
            </div>
            <p className="font-body-md text-[10px] text-[#707a67]">
              Set a date & time to receive a reminder email — we post directly on Instagram, so this is your cue.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Reminder Date
              </label>
              <input
                type="date"
                value={editedPost.scheduledDate}
                onChange={(e) => setEditedPost({ ...editedPost, scheduledDate: e.target.value })}
                className="w-full bg-[#faf9f5] border border-[#bfcab4] p-1.5 font-code-sm text-xs text-[#1b1c1a] rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Reminder Time
              </label>
              <input
                type="time"
                value={editedPost.scheduledTime}
                onChange={(e) => setEditedPost({ ...editedPost, scheduledTime: e.target.value })}
                className="w-full bg-[#faf9f5] border border-[#bfcab4] p-1.5 font-code-sm text-xs text-[#1b1c1a] rounded"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Target Platform
              </label>
              <select
                value={editedPost.platform}
                onChange={(e) => setEditedPost({ ...editedPost, platform: e.target.value as Platform })}
                className="w-full bg-[#faf9f5] border border-[#bfcab4] p-1.5 font-label-caps text-xs text-[#1b1c1a]"
              >
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">X / Twitter</option>
                <option value="web">Web Portal</option>
                <option value="email">Email Broadcast</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Spec Helper
              </label>
              <select
                value={editedPost.specType}
                onChange={(e) => setEditedPost({ ...editedPost, specType: e.target.value as SpecType })}
                className="w-full bg-[#faf9f5] border border-[#bfcab4] p-1.5 font-label-caps text-xs text-[#1b1c1a]"
              >
                {Object.values(SPECS).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.dimensions})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2 md:col-span-1">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Reminder Email
              </label>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  value={editedPost.reminderEmail || (teamMembers && teamMembers.length > 0 ? teamMembers[0].email : '') || ''}
                  onChange={(e) => setEditedPost({ ...editedPost, reminderEmail: e.target.value })}
                  placeholder="e.g. hamzaansari4you@gmail.com"
                  className="flex-1 bg-[#faf9f5] border border-[#bfcab4] p-1.5 font-body-md text-xs text-[#1b1c1a] rounded"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={sendingEmail}
                  className="px-2.5 py-1 bg-[#296c00] text-white font-label-caps text-[10px] font-bold rounded hover:bg-[#1f5700] disabled:opacity-50 transition-all flex items-center gap-1 whitespace-nowrap"
                  title="Send immediate reminder email test"
                >
                  <span className="material-symbols-outlined text-xs">send</span>
                  <span>{sendingEmail ? 'Sending...' : 'Send Email'}</span>
                </button>
              </div>
              {emailStatus && (
                <p className={`text-[10px] font-label-caps mt-1 font-bold ${emailStatus.includes('✓') ? 'text-[#296c00]' : 'text-[#ba1a1a]'}`}>
                  {emailStatus}
                </p>
              )}
            </div>
            </div>
          </div>

          {/* Auto Spec Helper Banner */}
          <div className="p-3 bg-[#efeeea] border border-[#bfcab4] rounded flex items-center justify-between text-xs font-label-caps">
            <div>
              <span className="font-bold text-[#296c00]">{spec?.name}:</span>{' '}
              <span className="text-[#1b1c1a] font-code-sm">{spec?.dimensions}</span> ({spec?.aspectRatio})
            </div>
            <span className="text-[#707a67] text-[10px]">{spec?.description}</span>
          </div>

          {/* CAPTION & VISUAL ATTACHMENT ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Caption & Voice Check */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                  Post Caption & Editorial Copy
                </label>
                {isCrossBrandMention && (
                  <span className="text-[10px] font-label-caps text-[#ba1a1a] bg-[#ffdad6] px-1.5 py-0.5 rounded font-bold">
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
                  className="w-full bg-white border border-[#bfcab4] p-3 font-body-md text-xs text-[#1b1c1a] focus:border-[#296c00] focus:outline-none"
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
                    {contentBank.filter(item => item.brandId === 'shared' || item.brandId === editedPost.brandId).length === 0 && (
                      <p className="p-3 text-[10px] text-[#707a67] text-center">No content bank items for this brand.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Inline Brand Guardrails Shelf */}
              <div className="p-3 bg-[#faf9f5] border border-[#bfcab4] rounded space-y-2 text-xs">
                <span className="font-label-caps text-[10px] text-[#296c00] font-bold block uppercase">
                  Inline Brand Voice Rules ({brand?.name})
                </span>
                <ul className="space-y-1 text-[11px] font-body-md text-[#404a39] list-disc list-inside">
                  {brand?.voiceRules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>

                {/* Color Palette Click-to-Copy */}
                <div className="pt-2 flex items-center gap-2">
                  <span className="font-label-caps text-[9px] text-[#707a67] uppercase">Palette:</span>
                  {[brand?.primaryColor, brand?.secondaryColor, brand?.accentColor, '#FAF9F5'].map(
                    (hex, i) => (
                      <button
                        key={i}
                        onClick={() => hex && handleCopyHex(hex)}
                        className="w-5 h-5 rounded-full border border-[#bfcab4] transition-transform hover:scale-110"
                        style={{ backgroundColor: hex }}
                        title={`Click to copy ${hex}`}
                      />
                    )
                  )}
                  {copyFeedback && (
                    <span className="font-label-caps text-[10px] text-[#296c00] font-bold">
                      {copyFeedback}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Visual Media Attachment */}
            <div className="space-y-3">
              <label className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold">
                Visual Media Attachment
              </label>

              {/* Preview Box */}
              <div className="h-44 bg-white border border-[#bfcab4] rounded overflow-hidden flex items-center justify-center relative shadow-inner">
                {editedPost.visualUrl ? (
                  <img
                    src={editedPost.visualUrl}
                    alt="Visual Attachment"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-[#707a67]">
                    <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                    <p className="font-label-caps text-xs mt-1">Upload a file or paste a link</p>
                  </div>
                )}
              </div>

              {/* Attachment Inputs */}
              <div className="space-y-2">
                <div>
                  <label className="font-label-caps text-[9px] text-[#707a67] block mb-1">
                    Upload from your device
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="w-full text-xs font-label-caps text-[#404a39] file:mr-2 file:py-1 file:px-3 file:border-0 file:text-xs file:font-label-caps file:bg-[#296c00] file:text-white hover:file:bg-[#1f5700] disabled:opacity-60"
                  />
                  {isUploading && (
                    <p className="mt-1 text-[10px] font-label-caps text-[#296c00]">Uploading…</p>
                  )}
                  {uploadError && (
                    <p className="mt-1 text-[11px] font-body-md text-[#ba1a1a] bg-[#ffdad6] border border-[#ffb4ab] rounded p-2">
                      {uploadError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-label-caps text-[9px] text-[#707a67] block mb-1">
                    Or paste a link (Drive, Canva, Figma)
                  </label>
                  <input
                    type="text"
                    value={editedPost.visualUrl}
                    onChange={(e) => setEditedPost({ ...editedPost, visualUrl: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-white border border-[#bfcab4] p-1.5 font-code-sm text-xs text-[#1b1c1a]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COMMENTS & COLLABORATION THREAD */}
          <div className="bg-white p-4 border border-[#bfcab4] rounded space-y-3">
            <h3 className="font-label-caps text-xs font-bold text-[#296c00] uppercase">
              Collaboration & Feedback Thread ({editedPost.comments.length})
            </h3>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {editedPost.comments.length === 0 ? (
                <p className="text-xs font-body-md text-[#707a67] py-2">
                  No comments yet. Start the review conversation below.
                </p>
              ) : (
                editedPost.comments.map((c) => (
                  <div key={c.id} className="p-2.5 bg-[#faf9f5] border border-[#bfcab4] rounded text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label-caps font-bold text-[#296c00]">{c.author}</span>
                      <span className="font-code-sm text-[10px] text-[#707a67]">{c.timestamp}</span>
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
                className="flex-1 bg-[#faf9f5] border border-[#bfcab4] px-3 py-1.5 font-body-md text-xs text-[#1b1c1a] focus:outline-none"
              />
              <button
                onClick={handleAddComment}
                className="bg-[#296c00] text-white px-4 py-1.5 font-label-caps text-xs rounded hover:bg-[#1f5700]"
              >
                Comment
              </button>
            </div>
          </div>

          {/* ACTIVITY AUDIT LOG */}
          <div className="p-3 bg-[#efeeea] border border-[#bfcab4] rounded space-y-2">
            <span className="font-label-caps text-[10px] text-[#707a67] uppercase font-bold block">
              Activity ({editedPost.activityLog.length})
            </span>
            <div className="space-y-1 max-h-28 overflow-y-auto font-code-sm text-[11px] text-[#404a39]">
              {editedPost.activityLog.map((log) => (
                <div key={log.id} className="flex justify-between">
                  <span>
                    • <strong className="text-[#296c00]">{log.actor}:</strong> {log.action}
                  </span>
                  <span className="text-[#707a67]">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls — sticky sheet action bar on mobile */}
        <div className="sheet-action-bar">
          <button
            onClick={onClose}
            className="flex-1 md:flex-none px-4 py-2.5 min-h-[48px] border border-[#bfcab4] font-label-caps text-xs text-[#1b1c1a] hover:bg-[#efeeea] rounded font-bold"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="flex-1 md:flex-none px-5 sm:px-6 py-2.5 min-h-[48px] bg-[#296c00] text-white font-label-caps text-xs font-bold rounded shadow-xs hover:bg-[#1f5700] active:scale-95 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
