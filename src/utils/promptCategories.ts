import { Prompt } from '../types';

export const UNCATEGORIZED = 'Uncategorized';

const matches = (p: Prompt, name: string) => (p.category || '').toLowerCase() === name.toLowerCase();

export function applyCategoryRename(prompts: Prompt[], oldName: string, newName: string): Prompt[] {
  return prompts.map((p) => (matches(p, oldName) ? { ...p, category: newName } : p));
}

export function applyCategoryDelete(prompts: Prompt[], name: string): Prompt[] {
  return prompts.map((p) => (matches(p, name) ? { ...p, category: UNCATEGORIZED } : p));
}
