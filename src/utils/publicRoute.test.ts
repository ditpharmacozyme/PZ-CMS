import { describe, it, expect } from 'vitest';
import { parsePublicRoute } from './publicRoute';

describe('parsePublicRoute', () => {
  it('maps /ads and /ads/ to standing', () => {
    expect(parsePublicRoute('/ads')).toEqual({ kind: 'standing' });
    expect(parsePublicRoute('/ads/')).toEqual({ kind: 'standing' });
  });
  it('maps /s/<token> to share, tolerating a trailing slash', () => {
    expect(parsePublicRoute('/s/abc12345')).toEqual({ kind: 'share', token: 'abc12345' });
    expect(parsePublicRoute('/s/abc12345/')).toEqual({ kind: 'share', token: 'abc12345' });
    expect(parsePublicRoute('/s/Ab_-9xyZ12')).toEqual({ kind: 'share', token: 'Ab_-9xyZ12' });
  });
  it('rejects bad tokens and other paths', () => {
    expect(parsePublicRoute('/s/x')).toBeNull();
    expect(parsePublicRoute('/s/' + 'a'.repeat(65))).toBeNull();
    expect(parsePublicRoute('/s/abc12345/extra')).toBeNull();
    expect(parsePublicRoute('/s/abc$1234')).toBeNull();
    expect(parsePublicRoute('/')).toBeNull();
    expect(parsePublicRoute('/api/health')).toBeNull();
    expect(parsePublicRoute('/ads/other')).toBeNull();
  });
});
