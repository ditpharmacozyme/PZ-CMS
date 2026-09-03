import { PostTemplate, BrandId } from '../types';

export const UNCATEGORIZED = 'Uncategorized';

const matches = (t: PostTemplate, scope: BrandId | 'shared', name: string) =>
  t.brandId === scope && (t.category || '').toLowerCase() === name.toLowerCase();

export function applyCategoryRename(
  templates: PostTemplate[], scope: BrandId | 'shared', oldName: string, newName: string,
): PostTemplate[] {
  return templates.map((t) => (matches(t, scope, oldName) ? { ...t, category: newName } : t));
}

export function applyCategoryDelete(
  templates: PostTemplate[], scope: BrandId | 'shared', name: string,
): PostTemplate[] {
  return templates.map((t) => (matches(t, scope, name) ? { ...t, category: UNCATEGORIZED } : t));
}
