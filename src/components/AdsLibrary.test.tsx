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
  AdsUploadZone: ({ folderId, onUploaded }: { folderId: string; onUploaded: (i: { name: string; files: unknown[] }[]) => void }) => (
    <button onClick={() => onUploaded([{ name: 'a.png', files: [] }, { name: 'b.png', files: [] }])}>
      zone {folderId}
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
      "Removed. Some files in Google Drive couldn't be moved to the trash — ask an admin to check the Ads Library folder.",
      undefined, 8000, 'error'
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
    fireEvent.click(await screen.findByRole('button', { name: /zone folder-1/i }));
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

  it('shows purpose-written error messages but hides raw database errors', async () => {
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint'), { name: 'AdsDbError' });
    const h = makeHook({
      programs: [program()],
      updateProgram: vi.fn()
        .mockRejectedValueOnce(new Error('Google Apps Script returned an unexpected reply — redeploy the script.'))
        .mockRejectedValueOnce(dbError)
        .mockRejectedValueOnce(new TypeError('Failed to fetch')),
    });
    hook.value = h;
    const toast = renderLib();
    const hide = () => fireEvent.click(screen.getByRole('button', { name: /^hide spring course/i }));
    hide();
    await waitFor(() => expect(toast).toHaveBeenLastCalledWith('Google Apps Script returned an unexpected reply — redeploy the script.', undefined, 8000, 'error'));
    hide();
    await waitFor(() => expect(toast).toHaveBeenLastCalledWith('Something went wrong. Please try again.', undefined, 8000, 'error'));
    toast.mockClear();
    hide();
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Something went wrong. Please try again.', undefined, 8000, 'error'));
  });

  describe('error toasts', () => {
    const RAW =
      'Exception: You do not have permission to call Session.getEffectiveUser. Required permissions: https://www.googleapis.com/auth/userinfo.email. For more information, see https://developers.google.com/apps-script/guides/support/troubleshooting#authorization-is';
    const hideWith = (err: unknown) => {
      hook.value = makeHook({ programs: [program()], updateProgram: vi.fn().mockRejectedValue(err) });
      const toast = renderLib();
      fireEvent.click(screen.getByRole('button', { name: /^hide spring course/i }));
      return toast;
    };

    it('translates an Apps Script authorization error and styles it as an error', async () => {
      const err = new Error(RAW);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toast = hideWith(err);
      const auth = 'Google Drive needs to be re-approved by an admin. Ask an admin to open the Apps Script, run any function once, click Allow, and redeploy.';
      await waitFor(() => expect(toast).toHaveBeenCalled());
      const call = toast.mock.calls[0];
      expect(call[0]).toBe(auth);
      expect(call[2]).toBeGreaterThanOrEqual(8000);
      expect(call[3]).toBe('error');
      expect(spy).toHaveBeenCalledWith(err);
      spy.mockRestore();
    });

    it('translates other Apps Script exceptions', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toast = hideWith(new Error('Exception: boom'));
      await waitFor(() => expect(toast).toHaveBeenCalledWith(
        "Google Drive couldn't complete that. Please try again, or ask an admin to check the Apps Script.",
        undefined, 8000, 'error'
      ));
      spy.mockRestore();
    });

    it('still shows purpose-written app errors as written', async () => {
      const msg = 'Target program has no Drive folder yet. Open it once first.';
      const toast = hideWith(new Error(msg));
      await waitFor(() => expect(toast).toHaveBeenCalledWith(msg, undefined, 8000, 'error'));
    });

    it('leaves success toasts unchanged', async () => {
      hook.value = makeHook({ sets: [adSet()] });
      const toast = renderLib();
      fireEvent.click(screen.getByRole('button', { name: /upload$/i }));
      fireEvent.change(screen.getByLabelText(/ad set/i), { target: { value: 's1' } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      fireEvent.click(await screen.findByRole('button', { name: /zone folder-1/i }));
      await waitFor(() => expect(toast).toHaveBeenCalledWith('Added 2 ads'));
    });
  });

  it('reports failed ad saves after an upload instead of claiming success', async () => {
    const h = makeHook({
      sets: [adSet()],
      addCreative: vi.fn().mockResolvedValueOnce(creative()).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AdsDbError' })),
    });
    hook.value = h;
    const toast = renderLib();
    fireEvent.click(screen.getByRole('button', { name: /upload$/i }));
    fireEvent.change(screen.getByLabelText(/ad set/i), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(await screen.findByRole('button', { name: /zone folder-1/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Added 1 ad'));
    expect(toast).toHaveBeenCalledWith('Something went wrong. Please try again.', undefined, 8000, 'error');
  });
});
