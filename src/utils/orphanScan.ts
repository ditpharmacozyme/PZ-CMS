import { identifyFile, isFileStillReferenced, fileRefsEqual, type FileRef, type CleanupRecords } from './fileCleanup';

export interface ManagedFile {
  ref: FileRef;
  name: string;
  location: string;
  createdMs?: number;
  sizeBytes?: number;
}

export function findOrphans(
  files: ManagedFile[],
  records: CleanupRecords,
  logoUrls: string[],
): ManagedFile[] {
  const logoRefs = logoUrls
    .map((u) => identifyFile({ url: u }))
    .filter((r): r is FileRef => r !== null);

  return files.filter((f) => {
    // The scan itself establishes non-reference, so we want NO record excluded.
    // '' is the "exclude nothing" sentinel Task 6 settled on (no record id is empty).
    if (isFileStillReferenced(f.ref, records, '')) return false;
    if (logoRefs.some((r) => fileRefsEqual(r, f.ref))) return false;
    return true;
  });
}
