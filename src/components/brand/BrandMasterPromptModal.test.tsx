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

import { BrandMasterPromptModal } from './BrandMasterPromptModal';
import { BrandConfig } from '../../types';

const mockBrand: BrandConfig = {
  id: 'pillz',
  name: 'PillZ',
  shortCode: 'PZ',
  tagline: 'High-Density Packaging & Flux',
  primaryColor: '#00DC82',
  secondaryColor: '#0A0A0A',
  accentColor: '#36E4DA',
  surfaceColor: '#FFFFFF',
  icon: 'medication',
  description: 'Precision capsule engineering.',
  voiceRules: ['Technical rigor and clinical clarity.', 'No marketing fluff.'],
  fonts: { display: 'Inter', headline: 'Inter', code: 'monospace', body: 'Inter' }
};

const defaultPromptText = 'Act as the official copywriter for PillZ. Default system prompt text.';

describe('BrandMasterPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchRemoteSetting.mockResolvedValue(null);
    subscribeRemoteSetting.mockReturnValue(() => {});
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders nothing when closed', () => {
    render(
      <BrandMasterPromptModal
        isOpen={false}
        onClose={() => {}}
        brand={mockBrand}
        defaultPrompt={defaultPromptText}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the default brand-generated prompt when no custom override exists', async () => {
    render(
      <BrandMasterPromptModal
        isOpen={true}
        onClose={() => {}}
        brand={mockBrand}
        defaultPrompt={defaultPromptText}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Master System Prompt — PillZ/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto-generated from Brand Kit/i)).toBeInTheDocument();
    expect(screen.getByText(defaultPromptText)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to brand default/i })).not.toBeInTheDocument();
  });

  it('loads custom override when present', async () => {
    fetchRemoteSetting.mockResolvedValue('Custom customized PillZ prompt');

    render(
      <BrandMasterPromptModal
        isOpen={true}
        onClose={() => {}}
        brand={mockBrand}
        defaultPrompt={defaultPromptText}
      />
    );

    expect(await screen.findByText('Custom customized PillZ prompt')).toBeInTheDocument();
    expect(screen.getByText(/Customized for this brand/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to brand default/i })).toBeInTheDocument();
  });

  it('copies the active prompt to clipboard', async () => {
    render(
      <BrandMasterPromptModal
        isOpen={true}
        onClose={() => {}}
        brand={mockBrand}
        defaultPrompt={defaultPromptText}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultPromptText);
  });

  it('allows editing and saving a custom prompt', async () => {
    const onSaved = vi.fn();
    render(
      <BrandMasterPromptModal
        isOpen={true}
        onClose={() => {}}
        brand={mockBrand}
        defaultPrompt={defaultPromptText}
        onCustomPromptSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /edit prompt/i }));

    const textarea = screen.getByLabelText(/edit master system prompt/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Newly updated prompt for PillZ.' } });
    fireEvent.click(screen.getByRole('button', { name: /save prompt/i }));

    await waitFor(() => {
      expect(upsertRemoteSetting).toHaveBeenCalledWith('master_system_prompt_pillz', 'Newly updated prompt for PillZ.');
      expect(onSaved).toHaveBeenCalledWith('Newly updated prompt for PillZ.');
    });

    expect(screen.getByText('Newly updated prompt for PillZ.')).toBeInTheDocument();
    expect(screen.getByText(/Customized for this brand/i)).toBeInTheDocument();
  });

  it('resets a custom prompt back to default when clicking Reset', async () => {
    fetchRemoteSetting.mockResolvedValue('Custom override text');
    const onSaved = vi.fn();

    render(
      <BrandMasterPromptModal
        isOpen={true}
        onClose={() => {}}
        brand={mockBrand}
        defaultPrompt={defaultPromptText}
        onCustomPromptSaved={onSaved}
      />
    );

    await screen.findByText('Custom override text');
    fireEvent.click(screen.getByRole('button', { name: /reset to brand default/i }));

    await waitFor(() => {
      expect(deleteRemoteSetting).toHaveBeenCalledWith('master_system_prompt_pillz');
      expect(onSaved).toHaveBeenCalledWith(null);
    });

    expect(screen.getByText(defaultPromptText)).toBeInTheDocument();
    expect(screen.getByText(/Auto-generated from Brand Kit/i)).toBeInTheDocument();
  });
});
