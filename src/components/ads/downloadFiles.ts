import type { AdFile } from '../../types';
import { downloadUrl } from '../../utils/adsModel';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Triggers one browser download per file via a temporary anchor, spaced out so
 * the browser does not drop them. (Zipping client-side is not possible: Drive
 * blocks cross-origin reads.)
 */
export async function downloadFiles(files: AdFile[], delayMs = 400): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const a = document.createElement('a');
    a.href = downloadUrl(files[i]);
    a.download = files[i].name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (i < files.length - 1) await sleep(delayMs);
  }
}
