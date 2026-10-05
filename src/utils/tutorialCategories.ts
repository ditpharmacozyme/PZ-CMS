import { Tutorial } from '../types';

export const UNCATEGORIZED = 'Uncategorized';

const matches = (t: Tutorial, name: string) =>
  (t.category || '').toLowerCase() === name.toLowerCase();

export function applyCategoryRename(
  tutorials: Tutorial[],
  oldName: string,
  newName: string
): Tutorial[] {
  return tutorials.map((t) =>
    matches(t, oldName) ? { ...t, category: newName } : t
  );
}

export function applyCategoryDelete(
  tutorials: Tutorial[],
  name: string
): Tutorial[] {
  return tutorials.map((t) =>
    matches(t, name) ? { ...t, category: UNCATEGORIZED } : t
  );
}
