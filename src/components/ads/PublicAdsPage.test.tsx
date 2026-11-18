import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { AdsSnapshot } from '../../types';

vi.mock('../../utils/adsStorage', () => ({
  fetchPublicLibrary: vi.fn(),
  fetchSharedScope: vi.fn(),
}));

import { fetchPublicLibrary, fetchSharedScope } from '../../utils/adsStorage';
import { PublicAdsPage } from './PublicAdsPage';

const EMPTY: AdsSnapshot = { programs: [], sets: [], creatives: [] };
const ts = '2026-01-01T00:00:00Z';
const set = { id: 's1', programId: 'p1', name: 'Spring Set', audience: 'Nurses', driveFolderId: '', hidden: false, isSystem: false, createdBy: '', createdAt: ts, updatedAt: ts };
const creative = {
  id: 'c1', setId: 's1', name: 'Hero Banner', format: 'image' as const,
  files: [{ driveFileId: 'f1', name: 'hero.png', mimeType: 'image/png', size: 1 }],
  sourceUrl: '', hidden: false, uploadedBy: '', createdAt: ts, updatedAt: ts,
};
const program = { id: 'p1', brandId: 'pharmacozyme', name: 'Enzyme Course', kind: 'course', hidden: false, createdBy: '', createdAt: ts, updatedAt: ts };
const full = { programs: [program], sets: [set], creatives: [creative] } as unknown as AdsSnapshot;

beforeEach(() => {
  vi.mocked(fetchPublicLibrary).mockReset();
  vi.mocked(fetchSharedScope).mockReset();
});

describe('PublicAdsPage', () => {
  it('shows the unavailable copy for an empty share', async () => {
    vi.mocked(fetchSharedScope).mockResolvedValue(EMPTY);
    render(<PublicAdsPage route={{ kind: 'share', token: 'abc12345' }} />);
    expect(await screen.findByText("This link isn't available anymore. Ask the team for a new one.")).toBeTruthy();
    expect(fetchSharedScope).toHaveBeenCalledWith('abc12345');
  });

  it('shows a creative and a Download control for a creative share', async () => {
    vi.mocked(fetchSharedScope).mockResolvedValue({ programs: [], sets: [set], creatives: [creative] } as unknown as AdsSnapshot);
    render(<PublicAdsPage route={{ kind: 'share', token: 'abc12345' }} />);
    expect(await screen.findByText('Hero Banner')).toBeTruthy();
    expect(screen.getByLabelText('Download Hero Banner')).toBeTruthy();
  });

  it('renders the standing library without management controls', async () => {
    vi.mocked(fetchPublicLibrary).mockResolvedValue(full);
    render(<PublicAdsPage route={{ kind: 'standing' }} />);
    expect(await screen.findByText('Enzyme Course')).toBeTruthy();
    expect(screen.getByText('Pharmacozyme Ads')).toBeTruthy();
    expect(screen.queryByText(/share/i)).toBeNull();
    expect(screen.queryByText(/hide/i)).toBeNull();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it('shows the empty standing copy', async () => {
    vi.mocked(fetchPublicLibrary).mockResolvedValue(EMPTY);
    render(<PublicAdsPage route={{ kind: 'standing' }} />);
    await waitFor(() => expect(screen.getByText('No ads are available right now.')).toBeTruthy());
  });
});
