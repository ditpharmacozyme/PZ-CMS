import { useState, useEffect } from 'react';
import { Post, TeamMember } from '../types';
import {
  getStoredPosts,
  saveStoredPosts,
  fetchRemotePosts,
  upsertRemotePost,
  upsertRemotePosts,
  deleteRemotePost,
  subscribeRemotePosts
} from '../utils/storage';
import { logAuditEvent, buildAuditEvent } from '../utils/audit';
import { logTimestamp } from '../utils/date';

interface ToastAction {
  label: string;
  onClick: () => void;
}

export function usePosts(
  showToast: (msg: string, action?: ToastAction, duration?: number) => void,
  activeTeammate: TeamMember | null
) {
  const [posts, setPosts] = useState<Post[]>(() => getStoredPosts());

  // Load from Supabase on mount & set up realtime listener
  useEffect(() => {
    fetchRemotePosts().then((remote) => {
      if (remote) setPosts(remote);
    });
    const unsub = subscribeRemotePosts((updated) => setPosts(updated));
    return () => unsub();
  }, []);

  // Save to local storage on change
  useEffect(() => {
    saveStoredPosts(posts);
  }, [posts]);

  const handleSavePost = (updatedPost: Post) => {
    const existing = posts.find((p) => p.id === updatedPost.id);

    // Rescheduling a post that already auto-sent its reminder must re-arm it --
    // otherwise reminder_sent_at stays stamped forever and get_due_reminders
    // (0016_reminder_rpcs.sql) permanently excludes it, even after the date/time
    // changes to a new, not-yet-due slot.
    if (
      existing?.reminderSentAt &&
      (existing.scheduledDate !== updatedPost.scheduledDate || existing.scheduledTime !== updatedPost.scheduledTime)
    ) {
      updatedPost = { ...updatedPost, reminderSentAt: undefined };
    }

    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    upsertRemotePost(updatedPost);
    showToast(`Saved "${updatedPost.title}"`);

    if (activeTeammate) {
      // post_approved stays a valid AuditActionType so historical entries still
      // render (see AuditLogView) -- but nothing writes new ones anymore now
      // that approval is gone from the UI; status_changed/post_edited cover it.
      const actionType =
        existing && existing.status !== updatedPost.status
          ? 'status_changed'
          : 'post_edited';

      logAuditEvent(
        buildAuditEvent({
          actorId: activeTeammate.id,
          actorName: activeTeammate.name,
          actionType,
          entityType: 'post',
          entityId: updatedPost.id,
          entityTitle: updatedPost.title,
          beforeValue: existing
            ? {
                title: existing.title,
                status: existing.status,
                scheduledDate: existing.scheduledDate,
                approved: existing.approved
              }
            : undefined,
          afterValue: {
            title: updatedPost.title,
            status: updatedPost.status,
            scheduledDate: updatedPost.scheduledDate,
            approved: updatedPost.approved
          }
        })
      );
    }
  };

  const handleDeletePost = (postId: string, onDeletedModalCallback?: () => void) => {
    const removed = posts.find((p) => p.id === postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    deleteRemotePost(postId);
    if (onDeletedModalCallback) onDeletedModalCallback();

    if (removed) {
      showToast(
        `Deleted "${removed.title}"`,
        {
          label: 'Undo',
          onClick: () => {
            setPosts((prev) => [removed, ...prev]);
            upsertRemotePost(removed);
          }
        },
        5000
      );

      if (activeTeammate) {
        logAuditEvent(
          buildAuditEvent({
            actorId: activeTeammate.id,
            actorName: activeTeammate.name,
            actionType: 'post_deleted',
            entityType: 'post',
            entityId: removed.id,
            entityTitle: removed.title,
            beforeValue: { title: removed.title, status: removed.status, scheduledDate: removed.scheduledDate }
          })
        );
      }
    } else {
      showToast('Post removed.');
    }
  };

  const handleDuplicatePost = (originalPost: Post, onDuplicateModalCallback?: (newPost: Post) => void) => {
    const actorName = activeTeammate ? activeTeammate.name : originalPost.assignees[0] || 'Someone';
    const duplicated: Post = {
      ...originalPost,
      id: `post-${Date.now()}`,
      title: `${originalPost.title} (Copy)`,
      status: 'not-started',
      approved: false,
      approvedBy: undefined,
      activityLog: [
        {
          id: `act-${Date.now()}`,
          actor: actorName,
          action: 'Duplicated from another post',
          timestamp: logTimestamp()
        }
      ]
    };
    setPosts((prev) => [duplicated, ...prev]);
    upsertRemotePost(duplicated);
    if (onDuplicateModalCallback) onDuplicateModalCallback(duplicated);
    showToast('Post duplicated.');

    if (activeTeammate) {
      logAuditEvent(
        buildAuditEvent({
          actorId: activeTeammate.id,
          actorName: activeTeammate.name,
          actionType: 'post_duplicated',
          entityType: 'post',
          entityId: duplicated.id,
          entityTitle: duplicated.title,
          afterValue: { title: duplicated.title, originalTitle: originalPost.title }
        })
      );
    }
  };

  const handleAddPost = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    upsertRemotePost(newPost);
    showToast(`Scheduled new post: "${newPost.title}"`);

    if (activeTeammate) {
      logAuditEvent(
        buildAuditEvent({
          actorId: activeTeammate.id,
          actorName: activeTeammate.name,
          actionType: newPost.scheduledDate ? 'post_scheduled' : 'post_created',
          entityType: 'post',
          entityId: newPost.id,
          entityTitle: newPost.title,
          afterValue: {
            title: newPost.title,
            status: newPost.status,
            scheduledDate: newPost.scheduledDate,
            brandId: newPost.brandId
          }
        })
      );
    }
  };

  const handleBatchAddPosts = async (newPosts: Post[]) => {
    if (newPosts.length === 0) return;
    setPosts((prev) => [...newPosts, ...prev]);
    const { error } = await upsertRemotePosts(newPosts);
    if (error) {
      showToast(`Added ${newPosts.length} posts locally (Supabase batch warning: ${error})`);
    } else {
      showToast(`Imported ${newPosts.length} posts to Content Calendar!`);
    }
  };

  return {
    posts,
    setPosts,
    handleAddPost,
    handleSavePost,
    handleDeletePost,
    handleDuplicatePost,
    handleBatchAddPosts
  };
}
