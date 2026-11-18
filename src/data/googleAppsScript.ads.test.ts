import { describe, it, expect } from 'vitest';
import { GOOGLE_APPS_SCRIPT_CODE as code } from './googleAppsScript';

const ACTIONS: Array<[string, string]> = [
  ['adsEnsureFolder', 'handleAdsEnsureFolder'],
  ['adsRenameFolder', 'handleAdsRenameFolder'],
  ['adsMoveFolder', 'handleAdsMoveFolder'],
  ['adsMoveFile', 'handleAdsMoveFile'],
  ['adsCreateUploadSession', 'handleAdsCreateUploadSession'],
  ['adsFinalizeFile', 'handleAdsFinalizeFile'],
  ['adsTrashFile', 'handleAdsTrashFile'],
  ['adsTrashFolder', 'handleAdsTrashFolder'],
];

function fnBody(name: string): string {
  const start = code.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = code.indexOf('\nfunction ', start + 1);
  const nextDoc = code.indexOf('\n/**', start + 1);
  const nextSection = code.indexOf('\n// ----', start + 1);
  const ends = [next, nextDoc, nextSection].filter((i) => i > -1);
  return code.slice(start, Math.min(...ends));
}

describe('Apps Script Ads Library actions', () => {
  it.each(ACTIONS)('dispatches %s to %s', (action, handler) => {
    expect(code).toContain(`action === "${action}"`);
    expect(code).toContain(`function ${handler}(`);
  });

  it('has the root id property and guard', () => {
    expect(code).toContain('ADS_ROOT_FOLDER_ID');
    expect(code).toContain('function isUnderAdsRoot(');
  });

  it('isUnderManagedFolder accepts Ads Library files by id, not by name', () => {
    const body = fnBody('isUnderManagedFolder');
    expect(body).toContain('isUnderAdsRoot(file)');
    expect(body).not.toContain('"Ads Library"');
  });

  it('root name fallback only adopts an owned, top-level folder', () => {
    const body = fnBody('getAdsRootFolder');
    expect(body).toContain('getOwner()');
    expect(body).toContain('Session.getEffectiveUser()');
    expect(body).toContain('getRootFolder()');
  });

  it('documents the redeploy step', () => {
    expect(code).toContain(' * 16. ');
  });
});
