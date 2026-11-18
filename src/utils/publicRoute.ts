export type PublicRoute = { kind: 'standing' } | { kind: 'share'; token: string };

const SHARE = /^\/s\/([A-Za-z0-9_-]{8,64})\/?$/;

/** Maps a pathname to a public (no-login) route, or null for the normal app. */
export function parsePublicRoute(pathname: string): PublicRoute | null {
  if (pathname === '/ads' || pathname === '/ads/') return { kind: 'standing' };
  const m = SHARE.exec(pathname);
  return m ? { kind: 'share', token: m[1] } : null;
}
