import {
  identifyFile,
  isFileStillReferenced,
  scheduleFileDelete,
  cascadeFileDelete,
  type CleanupRecords,
} from './fileCleanup';

export type CascadeFor = (
  file: Parameters<typeof identifyFile>[0],
  recordId: string,
  opts?: { deferMs?: number },
) => void;

/**
 * Build the per-record "delete the backing file unless another record still
 * points at it" helper, closing over a live records accessor. Extracted from
 * App.tsx so the decision logic is unit-testable without a full App render.
 */
export function makeCascadeFor(getRecords: () => CleanupRecords): CascadeFor {
  return (file, recordId, opts) => {
    const ref = identifyFile(file);
    if (!ref) return;
    if (opts?.deferMs) {
      // Deferred (post delete): re-check at fire time with NO exclusion, so an
      // Undo restore -- which puts the post back under its original id -- or the
      // same image reused on a new post within the window cancels the delete.
      scheduleFileDelete(ref, opts.deferMs, () => !isFileStillReferenced(ref, getRecords(), ''));
    } else if (!isFileStillReferenced(ref, getRecords(), recordId)) {
      // Immediate (template/asset/research): the just-deleted record's React
      // state hasn't flushed yet, so it must still be excluded by its own id.
      void cascadeFileDelete(ref);
    }
  };
}
