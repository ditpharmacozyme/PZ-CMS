import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { AdsLibrary } from './AdsLibrary';
import type { AdCreative, AdProgram, AdSet, TeamMember } from '../types';

const supa = vi.hoisted(() => ({ configured: true }));
vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: () => supa.configured,
}));

const hook = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../hooks/useAdsLibrary', () => ({
  UNSORTED_ID: 'ads-unsorted',
  useAdsLibrary: () => hook.value,
}));
vi.mock('./ads/AdsUploadZone', () => ({
  AdsUploadZone: ({ setId, folderId, onUploaded }: { setId: string; folderId: string; onUploaded: (i: { name: string; files: unknown[] }[]) => void }) => (
    <button onClick={() => onUploaded([{ name: 'a.png', files: [] }, { name: 'b.png', files: [] }])}>
      zone {setId} {folderId}
    </button>
  ),
}));

const now = '2026-01-01T00:00:00Z';
const program = (o: Partial<AdProgram> = {}): AdProgram => ({
  id: 'p1', name: 'Spring Course', brandId: 'shared', kind: 'course', driveFolderId: 'f', hidden: false,
  createdBy: 'Sarah Connor', createdAt: now, updatedAt: now, ...o,
});
const adSet = (o: Partial<AdSet> = {}): AdSet => ({
  id: 's1', programId: null, name: 'Loose Set', audience: 'Pharmacists', driveFolderId: 'f', hidden: false,
  isSystem: false, createdBy: 'Sarah Connor', createdAt: now, updatedAt: now, ...o,
});
const creative = (o: Partial<AdCreative> = {}): AdCreative => ({
  id: 'c1', setId: 's1', name: 'Hero Ad', format: 'image', sourceUrl: '', hidden: false, uploadedBy: 'John Doe',
  files: [{ driveFileId: 'd1', name: 'hero.png', mimeType: 'image/png', sizeBytes: 1 }],
  createdAt: now, updatedAt: now, ...o,
});
const teammate = (o: Partial<TeamMember> = {}): TeamMember => ({
  id: 'u1', name: 'Sarah Connor', role: 'Designer', userRole: 'Editor', email: 's@x.com',
  avatarInitials: 'SC', color: '#4f46e5', ...o,
});

const makeHook = (over: Record<string, unknown> = {}) => ({
  programs: [], sets: [], creatives: [], audiences: [{ id: 'a1', name: 'Pharmacists', sortOrder: 1 }], shareLinks: [],
  loading: false,
  createProgram: vi.fn().mockResolvedValue(program()),
  updateProgram: vi.fn().mockResolvedValue(undefined),
  deleteProgram: vi.fn().mockResolvedValue({ driveOk: true }),
  createSet: vi.fn().mockResolvedValue(adSet()),
  updateSet: vi.fn().mockResolvedValue(undefined),
  moveSet: vi.fn().mockResolvedValue(undefined),
  deleteSet: vi.fn().mockResolvedValue({ driveOk: true }),
  addCreative: vi.fn().mockResolvedValue(creative()),
  updateCreative: vi.fn().mockResolvedValue(undefined),
  moveCreative: vi.fn().mockResolvedValue(undefined),
  deleteCreative: vi.fn().mockResolvedValue({ driveOk: true }),
  createShareLink: vi.fn().mockResolvedValue({}),
  revokeShareLink: vi.fn().mockResolvedValue(undefined),
  addAudience: vi.fn().mockResolvedValue(undefined),
  removeAudience: vi.fn().mockResolvedValue(undefined),
  ensureSetFolder: vi.fn().mockResolvedValue('folder-1'),
  countCreativesUnder: vi.fn().mockReturnValue(3),
  ...over,
});

const renderLib = (tm: TeamMember | null = teammate(), brand: string = 'all', showToast = vi.fn()) => {
  render(
    <BrandsProvider>
      <ConfirmProvider>
        <AdsLibrary activeTeammate={tm} selectedBrandFilter={brand as never} showToast={showToast} />
      </ConfirmProvider>
    </BrandsProvider>
  );
  return showToast;
};

beforeEach(() => {
  supa.configured = true;
  hook.value = makeHook();
});

describe('AdsLibrary', () => {
  it('shows the connection message when supabase is not configured', () => {
    supa.configured = false;
    renderLib();
    expect(screen.getByText('The Ads Library needs the shared database connection.')).toBeInTheDocument();
  });

  it('renders the empty state', () => {
    renderLib();
    expect(screen.getByText('No ads yet — create a course or upload your first ads.')).toBeInTheDocument();
  });

  it('creates a course through the modal', async () => {
    const h = makeHook();
    hook.value = h;
    renderLib();
    fireEvent.click(screen.getByRole('button', { name: /new course/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Autumn Course' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.createProgram).toHaveBeenCalledWith({ name: 'Autumn Course', brandId: 'shared', kind: 'course' }));
  });

  it('hides delete for a non-admin on someone else\'s creative but shows it for the uploader', () => {
    hook.value = makeHook({ sets: [adSet()], creatives: [creative()] });
    renderLib();
    fireEvent.click(screen.getByRole('button', { name: /^Loose Set/ }));
    expect(screen.getByText('Hero Ad')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete hero ad/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share hero ad/i })).toBeInTheDocument();
  });

  it('shows delete to an Admin and warns when Drive files could not be trashed', async () => {
    const h = makeHook({
      sets: [adSet()], creatives: [creative()],
      deleteCreative: vi.fn().mockResolvedValue({ driveOk: false }),
    });
    hook.value = h;
    const toast = renderLib(teammate({ userRole: 'Admin' }));
    fireEvent.click(screen.getByRole('button', { name: /^Loose Set/ }));
    fireEvent.click(screen.getByRole('button', { name: /delete hero ad/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(h.deleteCreative).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      "Removed. Some Drive files couldn't be trashed — an admin can clean them up in Settings."
    ));
  });

  it('deletes a course via the delete dialog with the creative count', async () => {
    const h = makeHook({ programs: [program()], sets: [] });
    hook.value = h;
    const toast = renderLib();
    fireEvent.click(screen.getByRole('button', { name: /delete spring course/i }));
    expect(h.countCreativesUnder).toHaveBeenCalledWith('program', 'p1');
    fireEvent.click(await screen.findByRole('button', { name: /delete everything/i }));
    await waitFor(() => expect(h.deleteProgram).toHaveBeenCalledWith('p1', 'delete-all'));
    await waitFor(() => expect(toast).toHaveBeenCalled());
  });

  it('does not offer delete or edit on the Unsorted system set', () => {
    hook.value = makeHook({ programs: [program()], sets: [adSet({ id: 'ads-unsorted', name: 'Unsorted', isSystem: true, createdBy: '' })] });
    renderLib(teammate({ userRole: 'Admin' }));
    expect(screen.queryByRole('button', { name: /delete unsorted/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit unsorted/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share unsorted/i })).toBeInTheDocument();
  });

  it('hides and unhides via the update mutations and shows the hidden chip', async () => {
    const h = makeHook({ programs: [program({ hidden: true })] });
    hook.value = h;
    renderLib();
    expect(screen.getByText('Hidden from public page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /unhide spring course/i }));
    await waitFor(() => expect(h.updateProgram).toHaveBeenCalledWith('p1', { hidden: false }));
  });

  it('opens the share modal and creates a link labelled with the target name', async () => {
    const h = makeHook({ programs: [program()] });
    hook.value = h;
    renderLib();
    fireEvent.click(screen.getByRole('button', { name: /share spring course/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create new link/i }));
    await waitFor(() => expect(h.createShareLink).toHaveBeenCalledWith('program', 'p1', 'Spring Course'));
  });

  it('uploads into the chosen ad set and toasts the count', async () => {
    const h = makeHook({ sets: [adSet({ id: 'ads-unsorted', name: 'Unsorted', isSystem: true }), adSet()] });
    hook.value = h;
    const toast = renderLib();
    fireEvent.click(screen.getByRole('button', { name: /upload$/i }));
    fireEvent.change(screen.getByLabelText(/ad set/i), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(await screen.findByRole('button', { name: /zone s1 folder-1/i }));
    await waitFor(() => expect(h.addCreative).toHaveBeenCalledTimes(2));
    expect(h.addCreative).toHaveBeenCalledWith({ setId: 's1', name: 'a.png', files: [] });
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Added 2 ads'));
    expect(h.ensureSetFolder).toHaveBeenCalledWith('s1');
  });

  it('filters by the search query', () => {
    hook.value = makeHook({ programs: [program(), program({ id: 'p2', name: 'Winter Webinar' })] });
    renderLib();
    fireEvent.change(screen.getByLabelText('Search ads'), { target: { value: 'winter' } });
    expect(screen.getByText('Winter Webinar')).toBeInTheDocument();
    expect(screen.queryByText('Spring Course')).not.toBeInTheDocument();
  });
});
