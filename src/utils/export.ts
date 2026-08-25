import Papa from 'papaparse';
import { Post, PostTemplate, ContentBankItem, ResearchItem } from '../types';

/**
 * Export all scheduled & backlog posts to a CSV file
 */
export function exportPostsToCSV(posts: Post[]): void {
  const data = posts.map((post) => ({
    ID: post.id,
    Brand: post.brandId,
    Title: post.title,
    'Scheduled Date': post.scheduledDate || 'Unscheduled (Idea Backlog)',
    'Scheduled Time': post.scheduledTime || '',
    Platform: post.platform,
    'Content Type': post.specType,
    Status: post.status,
    Assignees: post.assignees ? post.assignees.join(', ') : '',
    Approved: post.approved ? 'Yes' : 'No',
    Caption: post.caption || '',
    'Visual URL': post.visualUrl || '',
    'Recurrence Rule': post.recurrenceRule || '',
    Tags: post.tags ? post.tags.join(', ') : '',
    Notes: post.notes || ''
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Pharmacozyme_Posts_Backup_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export full workspace JSON snapshot (posts, templates, swipe copy, research)
 */
export function exportFullWorkspaceJSON(
  posts: Post[],
  templates?: PostTemplate[],
  contentBank?: ContentBankItem[],
  researchItems?: ResearchItem[]
): void {
  const exportPayload = {
    app: 'Pharmacozyme Brand-Ops Studio',
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    counts: {
      posts: posts.length,
      templates: templates?.length || 0,
      contentBank: contentBank?.length || 0,
      researchItems: researchItems?.length || 0
    },
    data: {
      posts,
      templates: templates || [],
      contentBank: contentBank || [],
      researchItems: researchItems || []
    }
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Pharmacozyme_CMS_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
