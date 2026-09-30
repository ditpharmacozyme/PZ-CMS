import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fetchRemoteSetting = vi.fn();
const upsertRemoteSetting = vi.fn().mockResolvedValue(undefined);
const deleteRemoteSetting = vi.fn().mockResolvedValue(undefined);
const subscribeRemoteSetting = vi.fn().mockReturnValue(() => {});

vi.mock('../../utils/storage', () => ({
  fetchRemoteSetting: (...args: unknown[]) => fetchRemoteSetting(...args),
  upsertRemoteSetting: (...args: unknown[]) => upsertRemoteSetting(...args),
  deleteRemoteSetting: (...args: unknown[]) => deleteRemoteSetting(...args),
  subscribeRemoteSetting: (...args: unknown[]) => subscribeRemoteSetting(...args),
}));

import { MasterPromptModal } from './MasterPromptModal';
import { MASTER_PROMPT, MASTER_PROMPT_STEPS, MASTER_PROMPT_SETTING_KEY } from '../../data/masterPrompt';

describe('MasterPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRemoteSetting.mockResolvedValue(null);
    subscribeRemoteSetting.mockReturnValue(() => {});
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders nothing when closed', () => {
    render(<MasterPromptModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the how-to-use steps and the default prompt when no team override exists', async () => {
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    MASTER_PROMPT_STEPS.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
    await waitFor(() => expect(fetchRemoteSetting).toHaveBeenCalledWith(MASTER_PROMPT_SETTING_KEY));
    expect(screen.getByText(/OUTPUT FORMAT/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to default/i })).not.toBeInTheDocument();
  });

  it("loads the team's saved override instead of the default when one exists", async () => {
    fetchRemoteSetting.mockResolvedValue('Custom team prompt text');
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    expect(await screen.findByText('Custom team prompt text')).toBeInTheDocument();
    expect(screen.queryByText(/OUTPUT FORMAT/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument();
  });

  it('copies whatever prompt is currently displayed', async () => {
    fetchRemoteSetting.mockResolvedValue('Custom team prompt text');
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    await screen.findByText('Custom team prompt text');
    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Custom team prompt text');
  });

  it('lets the user edit and save a new team-wide prompt', async () => {
    const showToast = vi.fn();
    render(<MasterPromptModal isOpen onClose={() => {}} showToast={showToast} />);
    await waitFor(() => expect(fetchRemoteSetting).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'New shared prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(upsertRemoteSetting).toHaveBeenCalledWith(MASTER_PROMPT_SETTING_KEY, 'New shared prompt');
    });
    expect(await screen.findByText('New shared prompt')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/updated/i));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('discards edits on cancel without saving', async () => {
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetchRemoteSetting).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Should not be saved' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(upsertRemoteSetting).not.toHaveBeenCalled();
    expect(screen.getByText(/OUTPUT FORMAT/)).toBeInTheDocument();
    expect(screen.queryByText('Should not be saved')).not.toBeInTheDocument();
  });

  it('resets to the default prompt and clears the team override', async () => {
    fetchRemoteSetting.mockResolvedValue('Custom team prompt text');
    const showToast = vi.fn();
    render(<MasterPromptModal isOpen onClose={() => {}} showToast={showToast} />);
    await screen.findByText('Custom team prompt text');

    fireEvent.click(screen.getByRole('button', { name: /reset to default/i }));

    await waitFor(() => {
      expect(deleteRemoteSetting).toHaveBeenCalledWith(MASTER_PROMPT_SETTING_KEY);
    });
    expect(screen.getByText(/OUTPUT FORMAT/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to default/i })).not.toBeInTheDocument();
  });

  it('updates live when another teammate changes the prompt via the realtime subscription', async () => {
    let pushChange: (value: string | null) => void = () => {};
    subscribeRemoteSetting.mockImplementation((_key: string, onChange: (value: string | null) => void) => {
      pushChange = onChange;
      return () => {};
    });
    render(<MasterPromptModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetchRemoteSetting).toHaveBeenCalled());

    pushChange('Teammate edited this remotely');
    expect(await screen.findByText('Teammate edited this remotely')).toBeInTheDocument();
  });
});
