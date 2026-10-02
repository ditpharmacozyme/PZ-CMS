import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromptEditorModal } from './PromptEditorModal';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { PromptCategory, Prompt } from '../types';

const categories: PromptCategory[] = [
  { id: 'c1', name: 'Hook Ideas', sortOrder: 0, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'c2', name: 'Hashtags', sortOrder: 1, createdAt: '2026-10-01T00:00:00Z' },
];

function renderModal(props: Partial<React.ComponentProps<typeof PromptEditorModal>> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmProvider>
      <PromptEditorModal
        isOpen
        onClose={onClose}
        categories={categories}
        activeTeammateName="Hamza Ansari"
        onSave={onSave}
        {...props}
      />
    </ConfirmProvider>
  );
  return { onSave, onClose };
}

describe('PromptEditorModal — create', () => {
  it('saves a new prompt with title, text, and category', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Caption writer' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'Write a caption about X' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Hook Ideas' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Prompt;
    expect(saved.title).toBe('Caption writer');
    expect(saved.promptText).toBe('Write a caption about X');
    expect(saved.category).toBe('Hook Ideas');
    expect(saved.images).toEqual([]);
    expect(saved.videoLinks).toEqual([]);
    expect(saved.createdBy).toBe('Hamza Ansari');
  });

  it('defaults category to Uncategorized when none is picked and none exist', () => {
    const { onSave } = renderModal({ categories: [] });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave.mock.calls[0][0].category).toBe('Uncategorized');
  });

  it('adds and removes video link rows', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    const linkInputs = screen.getAllByPlaceholderText(/video link/i);
    expect(linkInputs).toHaveLength(1);
    fireEvent.change(linkInputs[0], { target: { value: 'https://youtube.com/watch?v=x' } });
    fireEvent.click(screen.getByRole('button', { name: /remove link/i }));
    expect(screen.queryAllByPlaceholderText(/video link/i)).toHaveLength(0);
  });

  it('includes entered video links in the saved prompt', () => {
    const { onSave } = renderModal();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/prompt text/i), { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    fireEvent.change(screen.getByPlaceholderText(/video link/i), { target: { value: 'https://example.com/v' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave.mock.calls[0][0].videoLinks).toEqual(['https://example.com/v']);
  });
});

describe('PromptEditorModal — edit', () => {
  const existing: Prompt = {
    id: 'p1', title: 'Existing', promptText: 'Old text', category: 'Hashtags',
    images: [], videoLinks: ['https://example.com/a'],
    createdBy: 'Hamza Ansari', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  };

  it('pre-fills fields from the existing prompt', () => {
    renderModal({ prompt: existing });
    expect(screen.getByLabelText(/title/i)).toHaveValue('Existing');
    expect(screen.getByLabelText(/prompt text/i)).toHaveValue('Old text');
    expect(screen.getByPlaceholderText(/video link/i)).toHaveValue('https://example.com/a');
  });

  it('calls onDelete with the prompt id after confirming', async () => {
    const onDelete = vi.fn();
    renderModal({ prompt: existing, onDelete });
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click((await screen.findAllByRole('button', { name: /delete/i }))[1]);
    // Second "Delete" is the confirm dialog's own button (ConfirmDialog mounted via ConfirmProvider).
    // onDelete fires after the confirm promise resolves (a microtask), so wait for it.
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('p1'));
  });
});
