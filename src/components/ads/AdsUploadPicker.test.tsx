import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { ConfirmProvider } from '../ui/ConfirmDialog';
import { AdsUploadPicker } from './AdsUploadPicker';
import type { AdSet } from '../../types';

const zone = vi.hoisted(() => ({ busy: false }));
vi.mock('./AdsUploadZone', async () => {
  const { useEffect } = await import('react');
  return {
    AdsUploadZone: ({ onBusyChange }: { onBusyChange?: (b: boolean) => void }) => {
      useEffect(() => { onBusyChange?.(zone.busy); }, [onBusyChange]);
      return <div>zone</div>;
    },
  };
});

const set = (id: string, name: string, programId: string | null): AdSet => ({
  id, programId, name, audience: '', driveFolderId: 'f', hidden: false, isSystem: false, createdBy: '', createdAt: '', updatedAt: '',
});
const sets = [set('s1', 'Module 1', 'p2'), set('s2', 'Module 1', 'p1'), set('ads-unsorted', 'Unsorted', null)];
const programs = [{ id: 'p1', name: 'Biology' }, { id: 'p2', name: 'Anatomy' }];

const renderPicker = (onClose = vi.fn()) => {
  render(
    <ConfirmProvider>
      <AdsUploadPicker
        sets={sets}
        programs={programs}
        defaultSetId="ads-unsorted"
        ensureSetFolder={vi.fn().mockResolvedValue('folder-1')}
        onUploaded={vi.fn()}
        onClose={onClose}
      />
    </ConfirmProvider>
  );
  return onClose;
};

/** The footer button (the header X is also named "Close" but shows the "close" icon). */
const footerClose = () =>
  screen.getAllByRole('button', { name: 'Close' }).find((b) => b.textContent?.trim() === 'Close')!;

describe('AdsUploadPicker', () => {
  it('labels ad sets "Course / Set", sorted by course then set', () => {
    renderPicker();
    const labels = within(screen.getByLabelText('Ad set')).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['No course / Unsorted', 'Anatomy / Module 1', 'Biology / Module 1']);
  });

  it('footer reads Close after Continue and closes straight away when nothing is uploading', async () => {
    zone.busy = false;
    const onClose = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText('zone');
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    fireEvent.click(footerClose());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('asks before closing while files are uploading (footer and Escape)', async () => {
    zone.busy = true;
    const onClose = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByText('zone');
    await act(async () => {});
    fireEvent.click(footerClose());
    expect(await screen.findByText('Close while uploading?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep uploading' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(await screen.findByText('Close while uploading?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    const prompts = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(prompts[prompts.length - 1]);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
