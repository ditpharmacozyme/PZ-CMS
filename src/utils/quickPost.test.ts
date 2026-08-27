import { describe, it, expect } from 'vitest';
import { buildQuickPost } from './quickPost';

describe('buildQuickPost', () => {
  it('trims the title and assigns to the given teammate', () => {
    const p = buildQuickPost('  New idea  ', { brandFilter: 'all', assignee: 'Hamza' });
    expect(p.title).toBe('New idea');
    expect(p.assignees).toEqual(['Hamza']);
  });

  it("falls back to pharmacozyme when the brand filter is 'all'", () => {
    expect(buildQuickPost('x', { brandFilter: 'all', assignee: 'A' }).brandId).toBe('pharmacozyme');
  });

  it('inherits a concrete brand filter', () => {
    expect(buildQuickPost('x', { brandFilter: 'med-q', assignee: 'A' }).brandId).toBe('med-q');
  });

  it('with no date lands in the backlog and logs "Created idea"', () => {
    const p = buildQuickPost('x', { brandFilter: 'all', assignee: 'A' });
    expect(p.scheduledDate).toBe('');
    expect(p.status).toBe('not-started');
    expect(p.activityLog[0].action).toBe('Created idea');
    expect(p.activityLog[0].actor).toBe('A');
  });

  it('with a date is a dated post and logs "Created post"', () => {
    const p = buildQuickPost('x', { brandFilter: 'all', assignee: 'A', scheduledDate: '2026-09-01' });
    expect(p.scheduledDate).toBe('2026-09-01');
    expect(p.activityLog[0].action).toBe('Created post');
  });

  it('leaves assignees empty when no assignee is given', () => {
    const p = buildQuickPost('x', { brandFilter: 'all', assignee: '' });
    expect(p.assignees).toEqual([]);
    expect(p.activityLog[0].actor).toBe('Someone');
  });
});
