import type { AdFile } from '../../types';
import { downloadUrl, viewUrl } from '../../utils/adsModel';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Above ~100MB Drive's direct-download link returns an HTML virus-scan page
 * instead of the file, so large files open Drive's own page in a new tab.
 */
export const LARGE_FILE_BYTES = 90 * 1024 * 1024;

/** Where a file's download link points, and whether it is a large file (opens Drive's page). */
export function fileLink(file: AdFile): { href: string; large: boolean } {
  const large = (file.sizeBytes ?? 0) > LARGE_FILE_BYTES;
  return { href: large ? viewUrl(file) : downloadUrl(file), large };
}

let inProgress: Promise<void> | null = null;

/**
 * Triggers one browser download per file via a temporary anchor, spaced out so
 * the browser does not drop them. (Zipping client-side is not possible: Drive
 * blocks cross-origin reads.) Large files and single-file downloads use a new
 * tab so the current page is never navigated away.
 *
 * Overlapping calls: while a run is in progress a second call is a no-op and
 * returns the in-flight promise, so a double click cannot download files twice.
 */
export function downloadFiles(files: AdFile[], delayMs = 400): Promise<void> {
  if (inProgress) return inProgress;
  const run = (async () => {
    for (let i = 0; i < files.length; i++) {
      const { href, large } = fileLink(files[i]);
      const a = document.createElement('a');
      a.href = href;
      if (!large) a.download = files[i].name;
      if (large || files.length === 1) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.rel = 'noopener';
      }
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
      }
      if (i < files.length - 1) await sleep(delayMs);
    }
  })().finally(() => { inProgress = null; });
  inProgress = run;
  return run;
}
