import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdsShareModal } from './AdsShareModal';
import type { AdShareLink } from '../../types';

const link = (token: string, revokedAt: string | null = null): AdShareLink => ({
  token, level: 'set', targetId: 's1', label: '', createdBy: 'u', createdAt: '2026-01-01', revokedAt,
});
let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

describe('AdsShareModal', () => {
  it('copies the share link url and shows Copied', async () => {
    render(<AdsShareModal level="set" targetId="s1" targetName="Set" links={[link('abc123')]} onCreate={vi.fn()} onRevoke={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy share link abc123/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abc123`));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });
  it('shows the standing link with its own Copy', async () => {
    render(<AdsShareModal level="set" targetId="s1" targetName="Set" links={[]} onCreate={vi.fn()} onRevoke={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy standing link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/ads`));
  });
  it('greys revoked links with no Copy; Revoke and Create call back', () => {
    const onRevoke = vi.fn();
    const onCreate = vi.fn();
    render(<AdsShareModal level="set" targetId="s1" targetName="Set" links={[link('live'), link('dead', '2026-02-01')]} onCreate={onCreate} onRevoke={onRevoke} onClose={vi.fn()} />);
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy share link dead/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /revoke share link live/i }));
    expect(onRevoke).toHaveBeenCalledWith('live');
    fireEvent.click(screen.getByRole('button', { name: /create new link/i }));
    expect(onCreate).toHaveBeenCalled();
  });
});
