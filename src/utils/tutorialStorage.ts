import { supabase } from '../lib/supabase';
import { Tutorial, TutorialCategory } from '../types';

export const TUTORIALS_KEY = 'pharmacozyme_brandops_tutorials_v1';
export const TUTORIAL_CATEGORIES_KEY = 'pharmacozyme_brandops_tutorial_categories_v1';

export const DEFAULT_TUTORIAL_CATEGORIES: TutorialCategory[] = [
  { id: 'tc-1', name: 'Onboarding & SOPs', sortOrder: 0, createdAt: new Date().toISOString() },
  { id: 'tc-2', name: 'Video Production', sortOrder: 1, createdAt: new Date().toISOString() },
  { id: 'tc-3', name: 'Design & Creative', sortOrder: 2, createdAt: new Date().toISOString() },
  { id: 'tc-4', name: 'AI Tools & Workflows', sortOrder: 3, createdAt: new Date().toISOString() },
  { id: 'tc-5', name: 'Copywriting & Content', sortOrder: 4, createdAt: new Date().toISOString() }
];

export function getStoredTutorialCategories(): TutorialCategory[] {
  try {
    const raw = localStorage.getItem(TUTORIAL_CATEGORIES_KEY);
    if (!raw) {
      saveStoredTutorialCategories(DEFAULT_TUTORIAL_CATEGORIES);
      return DEFAULT_TUTORIAL_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_TUTORIAL_CATEGORIES;
  } catch {
    return DEFAULT_TUTORIAL_CATEGORIES;
  }
}

export function saveStoredTutorialCategories(categories: TutorialCategory[]): void {
  try {
    localStorage.setItem(TUTORIAL_CATEGORIES_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error('Error saving tutorial categories:', err);
  }
}

export function getStoredTutorials(): Tutorial[] {
  try {
    const raw = localStorage.getItem(TUTORIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredTutorials(tutorials: Tutorial[]): void {
  try {
    localStorage.setItem(TUTORIALS_KEY, JSON.stringify(tutorials));
  } catch (err) {
    console.error('Error saving tutorials:', err);
  }
}

/* Row mappers */
export function rowToCategory(row: Record<string, unknown>): TutorialCategory {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at || new Date().toISOString())
  };
}

export function categoryToRow(c: Omit<TutorialCategory, 'createdAt'>): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    sort_order: c.sortOrder
  };
}

export function rowToTutorial(row: Record<string, unknown>): Tutorial {
  return {
    id: String(row.id),
    brandId: (row.brand_id || 'shared') as Tutorial['brandId'],
    title: String(row.title || ''),
    description: String(row.description || ''),
    category: String(row.category || 'Uncategorized'),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : undefined,
    thumbnailStoragePath: row.thumbnail_storage_path ? String(row.thumbnail_storage_path) : undefined,
    videos: Array.isArray(row.videos) ? (row.videos as Tutorial['videos']) : [],
    links: Array.isArray(row.links) ? (row.links as Tutorial['links']) : [],
    prompts: Array.isArray(row.prompts) ? (row.prompts as Tutorial['prompts']) : [],
    files: Array.isArray(row.files) ? (row.files as Tutorial['files']) : [],
    createdBy: row.created_by ? String(row.created_by) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString())
  };
}

export function tutorialToRow(t: Tutorial): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: t.id,
    brand_id: t.brandId,
    title: t.title,
    description: t.description,
    category: t.category,
    tags: t.tags || [],
    videos: t.videos || [],
    links: t.links || [],
    prompts: t.prompts || [],
    files: t.files || [],
    created_by: t.createdBy || '',
    created_at: t.createdAt,
    updated_at: t.updatedAt
  };

  if (t.thumbnailUrl !== undefined) {
    row.thumbnail_url = t.thumbnailUrl;
  }
  if (t.thumbnailStoragePath !== undefined) {
    row.thumbnail_storage_path = t.thumbnailStoragePath;
  }

  return row;
}

/* Remote Supabase sync */
export async function fetchRemoteTutorialCategories(): Promise<TutorialCategory[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('tutorial_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Supabase] fetchRemoteTutorialCategories failed:', error.message);
    return null;
  }
  return data.map((r) => rowToCategory(r as Record<string, unknown>));
}

export async function upsertRemoteTutorialCategory(
  c: Omit<TutorialCategory, 'createdAt'>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tutorial_categories').upsert(categoryToRow(c));
  if (error) console.error('[Supabase] upsertRemoteTutorialCategory failed:', error.message);
}

export async function deleteRemoteTutorialCategory(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tutorial_categories').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteTutorialCategory failed:', error.message);
}

export function subscribeRemoteTutorialCategories(
  onChange: (cats: TutorialCategory[]) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('tutorial-categories-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorial_categories' }, async () => {
      const c = await fetchRemoteTutorialCategories();
      if (c) onChange(c);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchRemoteTutorials(): Promise<Tutorial[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('tutorials')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] fetchRemoteTutorials failed:', error.message);
    return null;
  }
  return data.map((r) => rowToTutorial(r as Record<string, unknown>));
}

export async function upsertRemoteTutorial(t: Tutorial): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tutorials').upsert(tutorialToRow(t));
  if (error) console.error('[Supabase] upsertRemoteTutorial failed:', error.message);
}

export async function deleteRemoteTutorial(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('tutorials').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteTutorial failed:', error.message);
}

export function subscribeRemoteTutorials(
  onChange: (tutorials: Tutorial[]) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('tutorials-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorials' }, async () => {
      const t = await fetchRemoteTutorials();
      if (t) onChange(t);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
