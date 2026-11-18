import { describe, it, expect } from 'vitest';
import { GOOGLE_APPS_SCRIPT_CODE as code } from './googleAppsScript';

describe('Apps Script Ads Library actions', () => {
  it.each([
    'adsEnsureFolder', 'adsRenameFolder', 'adsMoveFolder', 'adsMoveFile',
    'adsCreateUploadSession', 'adsFinalizeFile', 'adsTrashFile', 'adsTrashFolder',
  ])('contains %s', (name) => {
    expect(code).toContain(name);
  });

  it('has the root id property and guard', () => {
    expect(code).toContain('ADS_ROOT_FOLDER_ID');
    expect(code).toContain('isUnderAdsRoot');
  });

  it('isUnderManagedFolder accepts "Ads Library"', () => {
    const start = code.indexOf('function isUnderManagedFolder');
    const end = code.indexOf('function handleListManagedFiles');
    expect(code.slice(start, end)).toContain('"Ads Library"');
  });

  it('documents the redeploy step', () => {
    expect(code).toContain(' * 16. ');
  });
});
