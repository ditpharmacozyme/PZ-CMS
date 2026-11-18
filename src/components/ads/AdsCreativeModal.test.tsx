import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsCreativeModal } from './AdsCreativeModal';
import type { AdCreative, AdSet } from '../../types';

const creative: AdCreative = {
  id: 'c1', setId: 's1', name: 'Hero', format: 'image',
  files: [{ driveFileId: 'd1', name: 'hero.png', mimeType: 'image/png', sizeBytes: 1 }],
  sourceUrl: 'https://canva.com/x', hidden: false, uploadedBy: 'u', createdAt: '', updatedAt: '',
};
const set = (id: string, name: string): AdSet => ({
  id, programId: null, name, audience: 'a', driveFolderId: 'f', hidden: false, isSystem: false, createdBy: '', createdAt: '', updatedAt: '',
});
const sets = [set('s1', 'Set 1'), set('s2', 'Set 2')];

describe('AdsCreativeModal', () => {
  it('saves only changed fields', () => {
    const onSave = vi.fn();
    render(<AdsCreativeModal creative={creative} sets={sets} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hero v2' } });
    fireEvent.change(screen.getByLabelText('Ad set'), { target: { value: 's2' } });
    fireEvent.click(screen.getByLabelText(/Hide from the public ads page/));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Hero v2', setId: 's2', hidden: true });
  });
  it('opens the source link safely in a new tab only for http values', () => {
    const { unmount } = render(<AdsCreativeModal creative={creative} sets={sets} onSave={vi.fn()} onClose={vi.fn()} />);
    const a = screen.getByRole('link', { name: /Open source file/ });
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    unmount();
    render(<AdsCreativeModal creative={{ ...creative, sourceUrl: 'javascript:alert(1)' }} sets={sets} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /Open source file/ })).toBeNull();
  });
  it('Save just closes when nothing changed', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<AdsCreativeModal creative={creative} sets={sets} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
  it('saves a source-link-only change and rejects non-http links', () => {
    const onSave = vi.fn();
    render(<AdsCreativeModal creative={creative} sets={sets} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Source link'), { target: { value: 'ftp://x' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/http/);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Source link'), { target: { value: ' https://x.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ sourceUrl: 'https://x.com' });
  });
  it('tolerates a missing source link and shows a file tile for non-images', () => {
    const video = { ...creative, format: 'video' as const, sourceUrl: undefined as unknown as string,
      files: [{ driveFileId: 'v1', name: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 1 }] };
    render(<AdsCreativeModal creative={video} sets={sets} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('file-tile')).toHaveTextContent('clip.mp4');
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('offers a download per file', () => {
    render(<AdsCreativeModal creative={creative} sets={sets} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Download hero.png/ })).toHaveAttribute('href', expect.stringContaining('id=d1'));
  });
});
