// One-shot literal hex replacement across src/. Case-insensitive match,
// lowercase output. Excludes files whose colours are semantic (status map),
// customer-owned (brands), or tooling.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

const EXCLUDE = [
  'utils/statusConfig.ts',
  'data/brands.ts',
  'utils/brandTypography.ts',
];
const isExcluded = (rel) =>
  EXCLUDE.some((e) => rel.endsWith(e)) || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx');

// Phase B — neutral / warn / danger. (Phase C appends greens in Task 7.)
export const MAPPINGS = [
  ['#bfcab4', '#e9e9e7'],
  ['#707a67', '#5f5f5b'],
  ['#404a39', '#57574f'],
  ['#faf9f5', '#f4f4f3'],
  ['#efeeea', '#f1f1f0'],
  ['#e5e4de', '#efefed'],
  ['#f3f2ee', '#f1f1f0'],
  ['#e4e2db', '#e9e9e7'],
  ['#f7f6f2', '#f4f4f3'],
  ['#f0eee6', '#efefed'],
  ['#ba1a1a', '#dc2626'],
  ['#ffdad6', '#fcebeb'],
  ['#935c00', '#b45309'],
  ['#ffddb0', '#fbf0e1'],
  ['#f7f6f0', '#fbfbfa'],
  ['#296c00', '#4f46e5'],
  ['#205400', '#4338ca'],
  ['#1f5700', '#4338ca'],
  ['#296951', '#4338ca'],
  ['#aceecf', '#eef2ff'],
  ['#f0fae8', '#eef2ff'],
  ['#78d24b', '#15803d'],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(SRC)) {
  const rel = file.slice(SRC.length).replace(/\\/g, '/');
  if (isExcluded(rel)) continue;
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of MAPPINGS) {
    text = text.replace(new RegExp(from, 'gi'), to); // hex has no regex metachars
  }
  if (text !== before) { writeFileSync(file, text); changed++; }
}
console.log(`palette-sweep: rewrote ${changed} files`);
