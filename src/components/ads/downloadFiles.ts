import type { AdFile } from '../../types';
import { downloadUrl } from '../../utils/adsModel';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

let inProgress: Promise<void> | null = null;

/**
 * Triggers one browser download per file via a temporary anchor, spaced out so
 * the browser does not drop them. (Zipping client-side is not possible: Drive
 * blocks cross-origin reads.)
 *
 * Overlapping calls: while a run is in progress a second call is a no-op and
 * returns the in-flight promise, so a double click cannot download files twice.
 */
export function downloadFiles(files: AdFile[], delayMs = 400): Promise<void> {
  if (inProgress) return inProgress;
  const run = (async () => {
    for (let i = 0; i < files.length; i++) {
      const a = document.createElement('a');
      a.href = downloadUrl(files[i]);
      a.download = files[i].name;
      a.rel = 'noopener';
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
