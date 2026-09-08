import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { BrandControlCenter } from './BrandControlCenter';
import { upsertRemoteBrand } from '../utils/storage';
import { logAuditEvent } from '../utils/audit';

vi.mock('../utils/storage', async (orig) => {
  const actual = await orig<typeof import('../utils/storage')>();
  return {
    ...actual,
    fetchRemoteBrands: vi.fn().mockResolvedValue(null),
    subscribeRemoteBrands: vi.fn().mockReturnValue(() => {}),
    upsertRemoteBrand: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../utils/audit', async (orig) => {
  const actual = await orig<typeof import('../utils/audit')>();
  return {
    ...actual,
    logAuditEvent: vi.fn().mockResolvedValue(undefined),
  };
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(logAuditEvent).mockClear();
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

  it('closes the editor when the brand tab is switched mid-edit', async () => {
    render(
      <BrandsProvider>
        <BrandControlCenter selectedBrandFilter="pharmacozyme" onSelectBrandFilter={() => {}} />
      </BrandsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));
    expect(screen.getByLabelText(/primary colour hex/i)).toBeInTheDocument();

    // Switch to another brand while the editor is open.
    fireEvent.click(screen.getByRole('button', { name: /MED-Q/i }));

    expect(screen.queryByLabelText(/primary colour hex/i)).toBeNull();
  });

  it('emits a brand_edited audit event on Save', async () => {
    render(
      <BrandsProvider>
        <BrandControlCenter selectedBrandFilter="pharmacozyme" onSelectBrandFilter={() => {}} />
      </BrandsProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit brand kit/i }));
    fireEvent.change(screen.getByLabelText(/primary colour hex/i), { target: { value: '#123456' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'brand_edited', entityType: 'brand', entityId: 'pharmacozyme' }),
    );
  });
});
