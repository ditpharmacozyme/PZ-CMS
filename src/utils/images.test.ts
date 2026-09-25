import { describe, it, expect } from 'vitest';
import { coverOf, MAX_CAROUSEL_IMAGES } from './images';

describe('coverOf', () => {
  it('returns an empty string for an empty array', () => {
    expect(coverOf([])).toBe('');
  });

  it('returns the first element for a non-empty array', () => {
    expect(coverOf(['https://a.png', 'https://b.png'])).toBe('https://a.png');
  });
});

describe('MAX_CAROUSEL_IMAGES', () => {
  it('is 10, matching the Instagram carousel limit the spec targets', () => {
    expect(MAX_CAROUSEL_IMAGES).toBe(10);
  });
});
