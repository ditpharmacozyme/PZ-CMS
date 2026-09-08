import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { TemplateLibrary } from './TemplateLibrary';
import { PostTemplate, TemplateCategory } from '../types';

vi.mock('../utils/storage', async (orig) => {
  const actual = await orig<typeof import('../utils/storage')>();
  return {
    ...actual,
    fetchRemoteBrands: vi.fn().mockResolvedValue(null),
    subscribeRemoteBrands: vi.fn().mockReturnValue(() => {}),
    fetchRemoteCategories: vi.fn().mockResolvedValue(null),
    subscribeRemoteCategories: vi.fn().mockReturnValue(() => {}),
    upsertRemoteCategory: vi.fn().mockResolvedValue(undefined),
    deleteRemoteCategory: vi.fn().mockResolvedValue(undefined),
  };
});

const tpl = (id: string, category: string): PostTemplate => ({
  id, title: id, description: '', brandId: 'shared', category, platform: 'instagram',
  specType: 'feed-post', defaultCaption: '', tags: [], imagePreview: '', usesCount: 0,
});

const cat = (id: string, name: string, sortOrder: number): TemplateCategory => ({
  id, brandId: 'shared', name, sortOrder, createdAt: '2026-01-01',
});

beforeEach(() => localStorage.clear());

describe('TemplateLibrary — category rename cascade', () => {
  it('does not rewrite templates when the rename collides with another category', async () => {
    localStorage.setItem(
      'pharmacozyme_brandops_template_categories_v1',
      JSON.stringify([cat('a', 'Clinical', 0), cat('b', 'Editorial', 1)]),
    );
    const onUpdateTemplate = vi.fn();

    render(
      <BrandsProvider>
        <ConfirmProvider>
          <TemplateLibrary
            templates={[tpl('t1', 'Editorial')]}
            onUseTemplate={() => {}}
            onSaveNewTemplate={() => {}}
            onUpdateTemplate={onUpdateTemplate}
            onDeleteTemplate={() => {}}
            selectedBrandFilter="all"
          />
        </ConfirmProvider>
      </BrandsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /manage categories/i }));

    const input = screen.getByDisplayValue('Editorial') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'clinical' } });
    await act(async () => { fireEvent.blur(input); });

    // Cascade must not have run — no template rewritten to the target name.
    expect(onUpdateTemplate).not.toHaveBeenCalled();
    // Uncontrolled input restored to the category's real name.
    await waitFor(() => expect(input.value).toBe('Editorial'));
  });
});
