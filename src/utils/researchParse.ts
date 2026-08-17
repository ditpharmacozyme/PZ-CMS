/**
 * Client-side parsing for Research & Plans uploads. Only CSV (calendar
 * entries) and Markdown (research/plan/brief/notes docs) are parsed — PDF
 * and DOCX are stored as-is with manual metadata, per the feature spec.
 */

import * as Papa from 'papaparse';
import { BRANDS } from '../data/brands';
import { BrandId, Post, Platform, SpecType, PostStatus } from '../types';
import { todayStr, logTimestamp } from './date';

// ─── Type A: Calendar CSV ──────────────────────────────────────────────

export const CALENDAR_CSV_HEADERS = [
  'date', 'brand', 'platform', 'content_type', 'title', 'description', 'status', 'owner'
] as const;

export interface CalendarCsvRow {
  date: string;
  brand: string;
  platform: string;
  content_type: string;
  title: string;
  description: string;
  status: string;
  owner: string;
}

export type CalendarCsvParseResult =
  | { rows: CalendarCsvRow[]; error: null }
  | { rows: null; error: string };

/**
 * Validates the header row matches CALENDAR_CSV_HEADERS exactly (no
 * missing, no extra columns) per the spec's "reject with clear error"
 * requirement, then returns the parsed rows.
 */
export function parseCalendarCsv(text: string): CalendarCsvParseResult {
  // Strip a UTF-8 BOM if present -- Windows Notepad saves one by default,
  // and left in place it silently mangles the first header ("date" becomes
  // "﻿date"), producing a confusing "missing: date" error.
  const stripped = text.replace(/^﻿/, '');
  const result = Papa.parse<CalendarCsvRow>(stripped, { header: true, skipEmptyLines: true });
  const fields = result.meta.fields || [];

  const missing = CALENDAR_CSV_HEADERS.filter((h) => !fields.includes(h));
  const extra = fields.filter((f) => !(CALENDAR_CSV_HEADERS as readonly string[]).includes(f));

  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
    if (extra.length) parts.push(`unexpected: ${extra.join(', ')}`);
    return {
      rows: null,
      error: `CSV headers don't match the required format (${parts.join('; ')}). Expected exactly: ${CALENDAR_CSV_HEADERS.join(',')}`
    };
  }

  if (result.errors.length > 0) {
    return { rows: null, error: `CSV parse error: ${result.errors[0].message}` };
  }

  return { rows: result.data, error: null };
}

// ─── Type B: Markdown frontmatter ──────────────────────────────────────

export interface FrontmatterResult {
  data: Record<string, string | string[]>;
  body: string;
}

/**
 * Hand-rolled instead of gray-matter -- gray-matter is Node-oriented (needs
 * Buffer, pulls in js-yaml) and awkward under Vite. The schema here is
 * small and fixed (title/brand/type/date/owner/tags), so a plain
 * `key: value` parser is lighter and needs no polyfills. Supports bare and
 * quoted string values, plus inline `tags: [a, b, c]` arrays.
 */
export function parseFrontmatter(text: string): FrontmatterResult {
  const stripped = text.replace(/^﻿/, ''); // strip BOM if present
  const lines = stripped.split(/\r?\n/);

  if (lines[0]?.trim() !== '---') {
    return { data: {}, body: stripped };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { data: {}, body: stripped };
  }

  const data: Record<string, string | string[]> = {};
  for (let i = 1; i < endIndex; i++) {
    const match = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const rawValue = match[2].trim();

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      data[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((v) => stripQuotes(v.trim()))
        .filter(Boolean);
    } else {
      data[key] = stripQuotes(rawValue);
    }
  }

  const body = lines.slice(endIndex + 1).join('\n').replace(/^\n+/, '');
  return { data, body };
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

// ─── Brand name mapping ─────────────────────────────────────────────────

/** Maps a display name ("PZ Academy") or slug ("pz-academy") to a BrandId, falling back to 'shared'. */
export function mapBrandNameToId(name: string): BrandId | 'shared' {
  const normalized = name.trim().toLowerCase();
  const match = Object.values(BRANDS).find(
    (b) => b.name.toLowerCase() === normalized || b.id.toLowerCase() === normalized
  );
  return match ? match.id : 'shared';
}

// ─── Convert CSV Rows to Posts ──────────────────────────────────────────

const VALID_PLATFORMS: Platform[] = ['instagram', 'linkedin', 'twitter', 'web', 'email'];
const VALID_SPECS: SpecType[] = ['feed-post', 'story', 'reel', 'carousel', 'newsletter', 'bio-report'];
const VALID_STATUSES: PostStatus[] = ['not-started', 'in-progress', 'ready-to-post', 'posted'];

function normalizePlatform(p: string): Platform {
  const norm = p.trim().toLowerCase();
  if (VALID_PLATFORMS.includes(norm as Platform)) return norm as Platform;
  if (norm.includes('insta')) return 'instagram';
  if (norm.includes('linked')) return 'linkedin';
  if (norm.includes('tweet') || norm.includes('x')) return 'twitter';
  if (norm.includes('mail') || norm.includes('news')) return 'email';
  return 'instagram';
}

function normalizeSpecType(s: string): SpecType {
  const norm = s.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (VALID_SPECS.includes(norm as SpecType)) return norm as SpecType;
  if (norm.includes('feed') || norm.includes('image') || norm.includes('post')) return 'feed-post';
  if (norm.includes('story')) return 'story';
  if (norm.includes('reel') || norm.includes('video')) return 'reel';
  if (norm.includes('caro') || norm.includes('slide')) return 'carousel';
  if (norm.includes('letter') || norm.includes('email')) return 'newsletter';
  return 'feed-post';
}

function normalizeStatus(s: string): PostStatus {
  const norm = s.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (VALID_STATUSES.includes(norm as PostStatus)) return norm as PostStatus;
  if (norm === 'not-started' || norm === 'notstarted' || norm === 'todo' || norm === 'draft') return 'not-started';
  if (norm.includes('progress') || norm.includes('working')) return 'in-progress';
  if (norm.includes('ready') || norm.includes('review') || norm.includes('approved')) return 'ready-to-post';
  if (norm.includes('posted') || norm.includes('done') || norm.includes('published')) return 'posted';
  return 'not-started';
}

function normalizeDate(dStr: string): string {
  const trimmed = dStr.trim();
  if (!trimmed) return todayStr();
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return trimmed;
}

/** Converts parsed Calendar CSV rows into fully-editable Post objects for the Content Calendar. */
export function convertCsvRowsToPosts(
  rows: CalendarCsvRow[],
  fallbackBrand?: BrandId | 'shared',
  defaultOwner?: string,
  defaultOwnerEmail?: string
): Post[] {
  const now = Date.now();
  const timestamp = logTimestamp();

  return rows.map((row, idx) => {
    let brandId: BrandId = 'pharmacozyme';
    const mappedRowBrand = mapBrandNameToId(row.brand);
    if (mappedRowBrand !== 'shared') {
      brandId = mappedRowBrand;
    } else if (fallbackBrand && fallbackBrand !== 'shared') {
      brandId = fallbackBrand;
    }

    const ownerName = row.owner?.trim() || defaultOwner || '';
    const assignees = ownerName ? [ownerName] : [];
    const scheduledDate = normalizeDate(row.date || '');

    const post: Post = {
      id: `post-csv-${now}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      brandId,
      title: row.title?.trim() || `Calendar Post #${idx + 1}`,
      caption: row.description?.trim() || '',
      platform: normalizePlatform(row.platform || ''),
      specType: normalizeSpecType(row.content_type || ''),
      scheduledDate,
      scheduledTime: '10:00',
      status: normalizeStatus(row.status || ''),
      assignees,
      visualUrl: '',
      approved: row.status?.toLowerCase().includes('posted') || false,
      emailReminderEnabled: !!scheduledDate,
      reminderEmail: defaultOwnerEmail || '',
      comments: [],
      activityLog: [
        {
          id: `act-${now}-${idx}`,
          actor: ownerName || 'AI Import',
          action: 'Imported from AI Calendar CSV',
          timestamp
        }
      ],
      tags: ['AI-Calendar']
    };

    return post;
  });
}
