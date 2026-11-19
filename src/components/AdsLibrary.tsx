import React, { useMemo, useState } from 'react';
import type { AdShareLink, AdsSnapshot, BrandId, TeamMember } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { useBrands } from '../context/BrandsContext';
import { UNSORTED_ID, useAdsLibrary, type DeleteResult } from '../hooks/useAdsLibrary';
import { canManageAd, searchAds, type AdsFilters } from '../utils/adsModel';
import { Button } from './ui/Button';
import { useConfirm } from './ui/ConfirmDialog';
import { AdsGallery, type AdsItemKind } from './ads/AdsGallery';
import { AdsSearchBar } from './ads/AdsSearchBar';
import { AdsFolderModal } from './ads/AdsFolderModal';
import { AdsCreativeModal } from './ads/AdsCreativeModal';
import { AdsShareModal } from './ads/AdsShareModal';
import { AdsDeleteDialog } from './ads/AdsDeleteDialog';
import { AdsItemActions } from './ads/AdsItemActions';
import { AdsUploadPicker } from './ads/AdsUploadPicker';

interface AdsLibraryProps {
  activeTeammate: TeamMember | null | undefined;
  selectedBrandFilter: BrandId | 'all';
  showToast: (message: string) => void;
}

const DRIVE_WARNING =
  "Removed. Some files in Google Drive couldn't be moved to the trash — ask an admin to check the Ads Library folder.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Messages the app wrote itself (Drive helper and hook errors are plain Error
 * instances with a purpose-written message) are shown as-is. Raw database
 * failures (ADS_DB_ERROR), network TypeErrors and anything else get the
 * generic text.
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error && err.name === 'Error' && err.message.trim()) return err.message;
  return GENERIC_ERROR;
}

type Editing = { kind: AdsItemKind; id: string } | null;

export const AdsLibrary: React.FC<AdsLibraryProps> = (props) =>
  isSupabaseConfigured() ? (
    <AdsLibraryInner {...props} />
  ) : (
    <div className="p-6 text-sm text-[#5f5f5b]">The Ads Library needs the shared database connection.</div>
  );

const AdsLibraryInner: React.FC<AdsLibraryProps> = ({ activeTeammate, selectedBrandFilter, showToast }) => {
  const ads = useAdsLibrary(activeTeammate?.name ?? '');
  const { brands } = useBrands();
  const confirm = useConfirm();
  const isAdmin = activeTeammate?.userRole === 'Admin';

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<AdsFilters>({});
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [folderModal, setFolderModal] = useState<'program' | 'set' | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [sharing, setSharing] = useState<{ level: AdShareLink['level']; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'program' | 'set'; id: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const brandOptions = useMemo(
    () => [{ id: 'shared', name: 'Shared' }, ...Object.values(brands).map((b) => ({ id: b.id as string, name: b.name }))],
    [brands]
  );
  const brandName = (id: string) => brandOptions.find((b) => b.id === id)?.name ?? id;

  const base: AdsSnapshot = useMemo(() => {
    const { programs, sets, creatives } = ads;
    if (selectedBrandFilter === 'all') return { programs, sets, creatives };
    const keep = programs.filter((p) => p.brandId === selectedBrandFilter || p.brandId === 'shared');
    const keepIds = new Set(keep.map((p) => p.id));
    const keptSets = sets.filter((s) => s.programId === null || keepIds.has(s.programId));
    const setIds = new Set(keptSets.map((s) => s.id));
    return { programs: keep, sets: keptSets, creatives: creatives.filter((c) => setIds.has(c.setId)) };
  }, [ads.programs, ads.sets, ads.creatives, selectedBrandFilter]);

  const searching = query.trim() !== '' || Object.values(filters).some(Boolean);
  const snapshot = useMemo(() => searchAds(base, query, filters, brandName), [base, query, filters, brandOptions]);

  const isEmpty = ads.programs.length === 0 && ads.creatives.length === 0 && ads.sets.every((s) => s.isSystem);

  /** Runs a mutation and reports failure with a plain toast. */
  const attempt = async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    try {
      await fn();
      if (success) showToast(success);
      return true;
    } catch (err) {
      showToast(errorMessage(err));
      return false;
    }
  };
  const afterDelete = (r: DeleteResult) => showToast(r.driveOk ? 'Removed.' : DRIVE_WARNING);

  const findHidden = (kind: AdsItemKind, id: string): boolean =>
    kind === 'program' ? !!ads.programs.find((p) => p.id === id)?.hidden
      : kind === 'set' ? !!ads.sets.find((s) => s.id === id)?.hidden
        : !!ads.creatives.find((c) => c.id === id)?.hidden;

  const nameOf = (kind: AdsItemKind, id: string): string =>
    (kind === 'program' ? ads.programs.find((p) => p.id === id)?.name
      : kind === 'set' ? ads.sets.find((s) => s.id === id)?.name
        : ads.creatives.find((c) => c.id === id)?.name) ?? '';

  const toggleHidden = (kind: AdsItemKind, id: string) => {
    const hidden = !findHidden(kind, id);
    const call = kind === 'program' ? ads.updateProgram : kind === 'set' ? ads.updateSet : ads.updateCreative;
    void attempt(() => call(id, { hidden }));
  };

  const removeCreative = async (id: string) => {
    const name = nameOf('creative', id);
    const ok = await confirm({
      title: `Delete "${name}"?`,
      body: 'This removes the ad and its files. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      afterDelete(await ads.deleteCreative(id));
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const renderActions = (kind: AdsItemKind, id: string): React.ReactNode => {
    const name = nameOf(kind, id);
    const hidden = findHidden(kind, id);
    const isSystem = kind === 'set' && (id === UNSORTED_ID || !!ads.sets.find((s) => s.id === id)?.isSystem);
    const owner =
      kind === 'program' ? ads.programs.find((p) => p.id === id)?.createdBy
        : kind === 'set' ? ads.sets.find((s) => s.id === id)?.createdBy
          : ads.creatives.find((c) => c.id === id)?.uploadedBy;
    const canDelete = !isSystem && canManageAd(owner ?? '', activeTeammate);
    return (
      <AdsItemActions
        name={name}
        hidden={hidden}
        onShare={() => setSharing({ level: kind, id, name })}
        onToggleHidden={() => toggleHidden(kind, id)}
        onEdit={isSystem ? undefined : () => setEditing({ kind, id })}
        onDelete={
          !canDelete ? undefined
            : kind === 'creative' ? () => void removeCreative(id)
              : () => setDeleting({ kind, id })
        }
      />
    );
  };

  const onUploaded = async (setId: string, items: { name: string; files: import('../types').AdFile[] }[]) => {
    let added = 0;
    let failure: unknown = null;
    for (const it of items) {
      try {
        await ads.addCreative({ setId, name: it.name, files: it.files });
        added++;
      } catch (err) {
        failure = err; // surfaced as a toast once
      }
    }
    if (added < items.length) showToast(errorMessage(failure));
    if (added > 0) showToast(`Added ${added} ad${added === 1 ? '' : 's'}`);
  };

  const editProgram = editing?.kind === 'program' ? ads.programs.find((p) => p.id === editing.id) : undefined;
  const editSet = editing?.kind === 'set' ? ads.sets.find((s) => s.id === editing.id) : undefined;
  const editCreative = editing?.kind === 'creative' ? ads.creatives.find((c) => c.id === editing.id) : undefined;
  const deletingName = deleting ? nameOf(deleting.kind, deleting.id) : '';

  const uploadDefault = openSetId && ads.sets.some((s) => s.id === openSetId)
    ? openSetId
    : ads.sets.some((s) => s.id === UNSORTED_ID) ? UNSORTED_ID : ads.sets[0]?.id ?? UNSORTED_ID;

  const programOptions = useMemo(() => ads.programs.map((p) => ({ id: p.id, name: p.name })), [ads.programs]);
  const folderShared = {
    audiences: ads.audiences,
    brands: brandOptions.filter((b) => b.id !== 'shared'),
    programs: programOptions,
    canManageAudiences: isAdmin,
    onAddAudience: ads.addAudience,
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#0f0f0f]">Ads Library</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon="add" onClick={() => setFolderModal('program')}>New course</Button>
          <Button variant="secondary" icon="create_new_folder" onClick={() => setFolderModal('set')}>New ad set</Button>
          <Button variant="primary" icon="upload" onClick={() => setUploading(true)}>Upload</Button>
        </div>
      </div>

      <AdsSearchBar
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFiltersChange={setFilters}
        brands={brandOptions}
        audiences={ads.audiences.map((a) => a.name)}
      />

      {ads.loading ? (
        <p className="text-sm text-[#5f5f5b] text-center py-12">Loading ads…</p>
      ) : isEmpty && !searching ? (
        <p className="text-sm text-[#5f5f5b] text-center py-12">No ads yet — create a course or upload your first ads.</p>
      ) : (
        <AdsGallery
          snapshot={snapshot}
          brandName={brandName}
          selectable
          searching={searching}
          onOpenProgram={() => setOpenSetId(null)}
          onOpenSet={setOpenSetId}
          onOpenCreative={(id) => setEditing({ kind: 'creative', id })}
          renderActions={renderActions}
        />
      )}

      {folderModal === 'program' && (
        <AdsFolderModal
          mode="program"
          {...folderShared}
          onClose={() => setFolderModal(null)}
          onSave={async (v) => {
            if (await attempt(() => ads.createProgram(v), 'Course created')) setFolderModal(null);
          }}
        />
      )}
      {folderModal === 'set' && (
        <AdsFolderModal
          mode="set"
          {...folderShared}
          onClose={() => setFolderModal(null)}
          onSave={async (v) => {
            if (await attempt(() => ads.createSet(v), 'Ad set created')) setFolderModal(null);
          }}
        />
      )}
      {editProgram && (
        <AdsFolderModal
          mode="program"
          {...folderShared}
          initial={{ name: editProgram.name, brandId: editProgram.brandId, kind: editProgram.kind }}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (await attempt(() => ads.updateProgram(editProgram.id, v), 'Saved')) setEditing(null);
          }}
        />
      )}
      {editSet && (
        <AdsFolderModal
          mode="set"
          {...folderShared}
          initial={{ name: editSet.name, audience: editSet.audience, programId: editSet.programId }}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const ok = await attempt(async () => {
              if (v.name !== editSet.name || v.audience !== editSet.audience) {
                await ads.updateSet(editSet.id, { name: v.name, audience: v.audience });
              }
              if (v.programId !== editSet.programId) await ads.moveSet(editSet.id, v.programId);
            }, 'Saved');
            if (ok) setEditing(null);
          }}
        />
      )}
      {editCreative && (
        <AdsCreativeModal
          creative={editCreative}
          sets={ads.sets}
          programs={programOptions}
          onClose={() => setEditing(null)}
          onSave={async ({ setId, ...rest }) => {
            const ok = await attempt(async () => {
              if (Object.keys(rest).length) await ads.updateCreative(editCreative.id, rest);
              if (setId !== undefined) await ads.moveCreative(editCreative.id, setId);
            }, 'Saved');
            if (ok) setEditing(null);
          }}
        />
      )}
      {sharing && (
        <AdsShareModal
          level={sharing.level}
          targetId={sharing.id}
          targetName={sharing.name}
          links={ads.shareLinks}
          onCreate={() => ads.createShareLink(sharing.level, sharing.id, sharing.name)}
          onRevoke={ads.revokeShareLink}
          onClose={() => setSharing(null)}
        />
      )}
      {deleting && (
        <AdsDeleteDialog
          kind={deleting.kind}
          name={deletingName}
          count={ads.countCreativesUnder(deleting.kind, deleting.id)}
          onClose={() => setDeleting(null)}
          onChoose={async (mode) => {
            try {
              afterDelete(
                deleting.kind === 'program'
                  ? await ads.deleteProgram(deleting.id, mode)
                  : await ads.deleteSet(deleting.id, mode)
              );
            } catch (err) {
              showToast(errorMessage(err));
            }
            setDeleting(null);
          }}
        />
      )}
      {uploading && (
        <AdsUploadPicker
          sets={ads.sets}
          programs={programOptions}
          defaultSetId={uploadDefault}
          ensureSetFolder={ads.ensureSetFolder}
          onUploaded={(setId, items) => void onUploaded(setId, items)}
          onClose={() => setUploading(false)}
        />
      )}
    </div>
  );
};
