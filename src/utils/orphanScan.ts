import { isFileStillReferenced, type FileRef, type CleanupRecords } from './fileCleanup';

export interface ManagedFile {
  ref: FileRef;
  name: string;
  location: string;
  createdMs?: number;
  sizeBytes?: number;
}

/**
 * A managed file is an orphan when no live record — post, template, asset,
 * research item, or brand logo — references it. Brand-logo protection lives
 * inside isFileStillReferenced via records.logoUrls. '' is the "exclude
 * nothing" sentinel: the scan itself establishes non-reference.
 */
export function findOrphans(files: ManagedFile[], records: CleanupRecords): ManagedFile[] {
  return files.filter((f) => !isFileStillReferenced(f.ref, records, ''));
}
