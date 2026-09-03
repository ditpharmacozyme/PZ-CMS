import { describe, it, expect } from 'vitest';
import { rowToBrand, brandToRow } from './storage';
import { SEED_BRANDS } from '../data/brands';

describe('rowToBrand', () => {
  it('maps a full row', () => {
    const b = rowToBrand({
      id: 'med-q', name: 'MED-Q X', short_code: 'MQ', tagline: 't', description: 'd',
      primary_color: '#111', secondary_color: '#222', accent_color: '#333', surface_color: '#444',
      icon: 'biotech', logo_url: '/x.png', voice_rules: ['a', 'b'],
      fonts: { display: 'D', headline: 'H', code: 'C', body: 'B' }, sort_order: 2,
    });
    expect(b.name).toBe('MED-Q X');
    expect(b.primaryColor).toBe('#111');
    expect(b.voiceRules).toEqual(['a', 'b']);
    expect(b.fonts.display).toBe('D');
  });

  it('falls back to SEED_BRANDS for null columns', () => {
    const b = rowToBrand({ id: 'med-q', name: 'MED-Q', short_code: 'MED_Q',
      primary_color: '#111', secondary_color: '#222', accent_color: '#333', surface_color: '#444',
      icon: null, logo_url: null, voice_rules: null, fonts: null, tagline: null, description: null, sort_order: 0 });
    expect(b.icon).toBe(SEED_BRANDS['med-q'].icon);
    expect(b.logoUrl).toBe(SEED_BRANDS['med-q'].logoUrl);
    expect(b.voiceRules).toEqual(SEED_BRANDS['med-q'].voiceRules);
    expect(b.fonts).toEqual(SEED_BRANDS['med-q'].fonts);
  });
});

describe('brandToRow', () => {
  it('round-trips through rowToBrand', () => {
    const original = SEED_BRANDS.pharmacozyme;
    expect(rowToBrand(brandToRow(original))).toEqual(original);
  });
});
