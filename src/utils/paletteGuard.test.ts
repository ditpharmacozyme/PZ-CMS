// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../', import.meta.url)); // src/

// Retired colours that must not appear in application source after the sweep.
// statusConfig.ts (semantic), brands.ts + brandTypography.ts (customer), and
// *.test.* (this file) are exempt.
const RETIRED = [
  '#bfcab4', '#707a67', '#404a39', '#faf9f5', '#efeeea', '#e5e4de',
  '#f3f2ee', '#e4e2db', '#f7f6f2', '#f0eee6', '#ba1a1a', '#ffdad6', '#935c00', '#ffddb0', '#f7f6f0',
  '#296c00', '#205400', '#1f5700', '#296951', '#aceecf', '#f0fae8', '#78d24b',
  '#e4f5d8', '#90da75',
];
const EXEMPT = ['utils/statusConfig.ts', 'data/brands.ts', 'utils/brandTypography.ts'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return walk(p);
    return ['.ts', '.tsx'].includes(extname(p)) ? [p] : [];
  });
}

describe('palette guard', () => {
  it('no retired hex values remain in src/', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length).replace(/\\/g, '/');
      if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
      if (EXEMPT.some((e) => rel.endsWith(e))) continue;
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const hex of RETIRED) if (text.includes(hex)) offenders.push(`${rel} :: ${hex}`);
    }
    expect(offenders).toEqual([]);
  });
});
