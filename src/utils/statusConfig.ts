import { PostStatus } from '../types';

export const STATUS_CONFIG: Record<PostStatus | 'overdue', { color: string, bgColor: string, label: string, icon?: string }> = {
  'not-started': { color: '#707a67', bgColor: '#efeeea', label: 'Not Started' },
  'in-progress': { color: '#935c00', bgColor: '#ffddb0', label: 'In Progress' },
  'ready-to-post': { color: '#0061a4', bgColor: '#d1e4ff', label: 'Ready to Post' },
  'posted': { color: '#296c00', bgColor: '#aceecf', label: 'Posted', icon: 'check_circle' },
  'overdue': { color: '#ba1a1a', bgColor: '#ffdad6', label: 'Overdue', icon: 'error' },
};
