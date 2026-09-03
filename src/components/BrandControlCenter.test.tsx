import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { BrandControlCenter } from './BrandControlCenter';
import { upsertRemoteBrand } from '../utils/storage';

vi.mock('../utils/storage', async (orig) => {
  const actual = await orig<typeof import('../utils/storage')>();
  return {
    ...actual,
    fetchRemoteBrands: vi.fn().mockResolvedValue(null),
    subscribeRemoteBrands: vi.fn().mockReturnValue(() => {}),
    upsertRemoteBrand: vi.fn().mockResolvedValue(undefined),
  };
});

beforeEach(() => {
  localStorage.clear();
});

describe('BrandControlCenter — edit brand kit panel', () => {
  it('edits a brand colour through the panel and it persists after Save', async () => {
    render(
      <BrandsProvider>
        <BrandControlCenter selectedBrandFilter="pharmacozyme" onSelectBrandFilter={() => {}} />
      </BrandsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));

    const hex = screen.getByLabelText(/primary colour hex/i);
    fireEvent.change(hex, { target: { value: '#123456' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    expect(screen.getByLabelText(/primary colour hex/i)).toHaveValue('#123456');
    expect(upsertRemoteBrand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pharmacozyme', primaryColor: '#123456' }),
    );
  });

  it('Cancel discards the draft', async () => {
    render(
      <BrandsProvider>
        <BrandControlCenter selectedBrandFilter="pharmacozyme" onSelectBrandFilter={() => {}} />
      </BrandsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));
    fireEvent.change(screen.getByLabelText(/primary colour hex/i), { target: { value: '#abcdef' } });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    // Re-open: the draft was thrown away, so the field is back to the seed value.
    fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));
    expect(screen.getByLabelText(/primary colour hex/i)).toHaveValue('#78D24B');
  });

  it('reorders a voice rule via the move buttons (voiceRulesReducer)', async () => {
    render(
      <BrandsProvider>
        <BrandControlCenter selectedBrandFilter="pharmacozyme" onSelectBrandFilter={() => {}} />
      </BrandsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));

    const firstRuleBefore = (screen.getByLabelText(/^voice rule 1 text$/i) as HTMLInputElement).value;
    const secondRuleBefore = (screen.getByLabelText(/^voice rule 2 text$/i) as HTMLInputElement).value;

    fireEvent.click(screen.getByRole('button', { name: /move voice rule 2 up/i }));

    expect((screen.getByLabelText(/^voice rule 1 text$/i) as HTMLInputElement).value).toBe(secondRuleBefore);
    expect((screen.getByLabelText(/^voice rule 2 text$/i) as HTMLInputElement).value).toBe(firstRuleBefore);
  });
});
