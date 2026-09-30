import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MasterPromptModal } from './MasterPromptModal';
import { MASTER_PROMPT, MASTER_PROMPT_STEPS } from '../../data/masterPrompt';

describe('MasterPromptModal', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders nothing when closed', () => {
    render(<MasterPromptModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the how-to-use steps and the full prompt text when open', () => {
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    MASTER_PROMPT_STEPS.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
    expect(screen.getByText(/OUTPUT FORMAT/)).toBeInTheDocument();
  });

  it('copies the prompt to the clipboard and confirms it on the button', async () => {
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    const copyButton = screen.getByRole('button', { name: /copy prompt/i });
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MASTER_PROMPT);
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('calls showToast on copy when provided', async () => {
    const showToast = vi.fn();
    render(<MasterPromptModal isOpen onClose={() => {}} showToast={showToast} />);
    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }));
    await screen.findByRole('button', { name: /copied/i });
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/copied/i));
  });
});
