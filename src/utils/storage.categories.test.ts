import { describe, it, expect } from 'vitest';
import { rowToCategory, categoryToRow } from './storage';

describe('template category mappers', () => {
  it('rowToCategory maps snake_case', () => {
    const c = rowToCategory({ id: '1', brand_id: 'med-q', name: 'Clinical', sort_order: 2, created_at: '2026-01-01' });
    expect(c).toEqual({ id: '1', brandId: 'med-q', name: 'Clinical', sortOrder: 2, createdAt: '2026-01-01' });
  });
  it('categoryToRow round-trips', () => {
    const row = categoryToRow({ id: '1', brandId: 'shared', name: 'X', sortOrder: 0 });
    expect(row).toMatchObject({ id: '1', brand_id: 'shared', name: 'X', sort_order: 0 });
  });
});
