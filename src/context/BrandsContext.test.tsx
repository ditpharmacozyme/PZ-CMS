import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrandsProvider, useBrands } from './BrandsContext';
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

function Probe() {
  const { brands, getBrand } = useBrands();
  return (
    <div>
      <span data-testid="pz">{brands.pharmacozyme.name}</span>
      <span data-testid="all">{getBrand('all').id}</span>
    </div>
  );
}

describe('useBrands', () => {
  it('provides SEED_BRANDS before any remote load', () => {
    render(<BrandsProvider><Probe /></BrandsProvider>);
    expect(screen.getByTestId('pz').textContent).toBe('Pharmacozyme');
    expect(screen.getByTestId('all').textContent).toBe('pharmacozyme');
  });

  it('updateBrand patches the in-context value', async () => {
    function Editor() {
      const { brands, updateBrand } = useBrands();
      return <button onClick={() => updateBrand('med-q', { primaryColor: '#000000' })}>
        {brands['med-q'].primaryColor}
      </button>;
    }
    render(<BrandsProvider><Editor /></BrandsProvider>);
    const btn = screen.getByRole('button');
    await act(async () => { btn.click(); });
    expect(btn.textContent).toBe('#000000');
    expect(upsertRemoteBrand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'med-q', primaryColor: '#000000' }),
    );
  });
});
