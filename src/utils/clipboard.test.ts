import { describe, it, expect, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  it('writes to navigator.clipboard and returns true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('https://example.com/x.png')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.com/x.png');
    vi.unstubAllGlobals();
  });

  it('returns false when clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('x')).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});
