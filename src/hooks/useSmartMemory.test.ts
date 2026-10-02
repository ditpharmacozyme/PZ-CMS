import { describe, it, expect } from 'vitest';
import { remapLegacyTab } from './useSmartMemory';

describe('remapLegacyTab', () => {
  it('remaps the legacy telemetry id to dashboard', () => {
    expect(remapLegacyTab('telemetry')).toBe('dashboard');
  });

  it('remaps the legacy appscript id to integrations', () => {
    expect(remapLegacyTab('appscript')).toBe('integrations');
  });

  it('passes through ids that were never renamed', () => {
    expect(remapLegacyTab('calendar')).toBe('calendar');
    expect(remapLegacyTab('my-work')).toBe('my-work');
  });

  it('keeps the prompts tab valid across a reload', () => {
    expect(remapLegacyTab('prompts')).toBe('prompts');
  });

  it('returns null for a missing stored value', () => {
    expect(remapLegacyTab(null)).toBeNull();
  });
});
