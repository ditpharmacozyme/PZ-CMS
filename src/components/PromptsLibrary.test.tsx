import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PromptsLibrary } from './PromptsLibrary';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { Prompt } from '../types';

vi.mock('../utils/storage', () => ({
  fetchRemotePromptCategories: vi.fn().mockResolvedValue([
    { id: 'c1', name: 'Hook Ideas', sortOrder: 0, createdAt: '2026-10-01T00:00:00Z' },
    { id: 'c2', name: 'Hashtags', sortOrder: 1, createdAt: '2026-10-01T00:00:00Z' },
  ]),
  upsertRemotePromptCategory: vi.fn().mockResolvedValue(undefined),
  deleteRemotePromptCategory: vi.fn().mockResolvedValue(undefined),
  subscribeRemotePromptCategories: vi.fn().mockReturnValue(() => {}),
  getStoredPromptCategories: vi.fn().mockReturnValue([]),
  saveStoredPromptCategories: vi.fn(),
}));

const prompts: Prompt[] = [
  { id: 'p1', title: 'Caption writer', promptText: 'Write a caption about {topic}', category: 'Hook Ideas', images: ['img1.png'], videoLinks: ['https://v.example/1'], createdBy: 'Hamza', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
  { id: 'p2', title: 'Hashtag generator', promptText: 'List 10 hashtags for {topic}', category: 'Hashtags', images: [], videoLinks: [], createdBy: 'Hamza', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
];

function renderLibrary(props: Partial<React.ComponentProps<typeof PromptsLibrary>> = {}) {
  const onAddPrompt = vi.fn();
  const onUpdatePrompt = vi.fn();
  const onDeletePrompt = vi.fn();
  render(
    <ConfirmProvider>
      <PromptsLibrary
        prompts={prompts}
        onAddPrompt={onAddPrompt}
        onUpdatePrompt={onUpdatePrompt}
        onDeletePrompt={onDeletePrompt}
        activeTeammateName="Hamza Ansari"
        {...props}
      />
    </ConfirmProvider>
  );
  return { onAddPrompt, onUpdatePrompt, onDeletePrompt };
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('PromptsLibrary', () => {
  it('renders every prompt by default', () => {
    renderLibrary();
    expect(screen.getByText('Caption writer')).toBeInTheDocument();
    expect(screen.getByText('Hashtag generator')).toBeInTheDocument();
  });

  it('filters by category chip', async () => {
    renderLibrary();
    fireEvent.click(await screen.findByRole('button', { name: 'Hashtags' }));
    expect(screen.queryByText('Caption writer')).not.toBeInTheDocument();
    expect(screen.getByText('Hashtag generator')).toBeInTheDocument();
  });

  it('filters by search text', () => {
    renderLibrary();
    fireEvent.change(screen.getByPlaceholderText(/search prompts/i), { target: { value: 'hashtag' } });
    expect(screen.queryByText('Caption writer')).not.toBeInTheDocument();
    expect(screen.getByText('Hashtag generator')).toBeInTheDocument();
  });

  it('shows no badges for a prompt with no images and no video links', () => {
    renderLibrary();
    const card = screen.getByText('Hashtag generator').closest('[data-testid="prompt-card"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).queryByText(/image/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/video/i)).not.toBeInTheDocument();
  });

  it('copies the exact prompt text, special characters included', async () => {
    const special: Prompt = { ...prompts[0], id: 'p3', title: 'Special', promptText: 'Line one\nLine "two" with \'quotes\'' };
    renderLibrary({ prompts: [special] });
    const card = screen.getByText('Special').closest('[data-testid="prompt-card"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Line one\nLine "two" with \'quotes\'');
  });

  it('opens the editor and calls onAddPrompt on save', async () => {
    const { onAddPrompt } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New one' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'Do X' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onAddPrompt).toHaveBeenCalledTimes(1);
  });

  it('deleting a category reassigns its prompts to Uncategorized', async () => {
    const { onUpdatePrompt } = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: /manage categories/i }));
    fireEvent.click(await screen.findByRole('button', { name: /delete category "hook ideas"/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(onUpdatePrompt).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', category: 'Uncategorized' })));
  });

  it('re-initializes the editor fields when switching between prompts without stale data (C1 regression)', async () => {
    const { onUpdatePrompt } = renderLibrary();

    // Open prompt A (p1) and confirm its own data is shown.
    fireEvent.click(screen.getByText('Caption writer'));
    expect(await screen.findByLabelText(/title/i)).toHaveValue('Caption writer');
    // Close without saving.
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument());

    // Open prompt B (p2) and confirm it shows B's data, not A's stale data.
    fireEvent.click(screen.getByText('Hashtag generator'));
    expect(await screen.findByLabelText(/title/i)).toHaveValue('Hashtag generator');

    // Save B's edit (title tweak only) and assert B's original images/videoLinks
    // survive intact — not emptied by stale state from A.
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Hashtag generator v2' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onUpdatePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p2',
        title: 'Hashtag generator v2',
        images: prompts[1].images,
        videoLinks: prompts[1].videoLinks,
      })
    );
  });
});
