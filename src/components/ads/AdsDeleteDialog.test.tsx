import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AdsDeleteDialog } from './AdsDeleteDialog';

describe('AdsDeleteDialog', () => {
  it('states the count and passes the chosen mode', async () => {
    const onChoose = vi.fn();
    render(<AdsDeleteDialog kind="program" name="Spring" count={12} onChoose={onChoose} onClose={vi.fn()} />);
    expect(screen.getByText(/12 ads/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything inside' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Move ads to Unsorted' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Move ads to Unsorted' }));
    expect(onChoose.mock.calls).toEqual([['delete-all'], ['move-to-unsorted']]);
  });
  it('uses singular for 1 and still shows both buttons for 0', () => {
    const { rerender } = render(<AdsDeleteDialog kind="set" name="X" count={1} onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('This will affect 1 ad.')).toBeInTheDocument();
    rerender(<AdsDeleteDialog kind="set" name="X" count={0} onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('This will affect 0 ads.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete everything inside' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move ads to Unsorted' })).toBeInTheDocument();
  });
  it('ignores a second click while the first choice is in flight', () => {
    const onChoose = vi.fn(() => new Promise<void>(() => {}));
    render(<AdsDeleteDialog kind="set" name="X" count={3} onChoose={onChoose} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything inside' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything inside' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move ads to Unsorted' }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Delete everything inside' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move ads to Unsorted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
  it('while moving: spinner on the clicked button, status text, Cancel disabled, close blocked; then re-enabled', async () => {
    let resolve!: () => void;
    const onChoose = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    const onClose = vi.fn();
    render(<AdsDeleteDialog kind="program" name="X" count={3} onChoose={onChoose} onClose={onClose} />);
    const move = screen.getByRole('button', { name: 'Move ads to Unsorted' });
    fireEvent.click(move);
    expect(move.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Delete everything inside' }).querySelector('.animate-spin')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Moving 3 ads to Unsorted… this can take a minute.');
    expect(screen.getByRole('button', { name: 'Delete everything inside' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { resolve(); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Move ads to Unsorted' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
  it('uses singular for one ad while moving', () => {
    render(<AdsDeleteDialog kind="set" name="X" count={1} onChoose={() => new Promise<void>(() => {})} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move ads to Unsorted' }));
    expect(screen.getByRole('status')).toHaveTextContent('Moving 1 ad to Unsorted… this can take a minute.');
  });
  it('shows its own status for delete-all', () => {
    render(<AdsDeleteDialog kind="set" name="X" count={2} onChoose={() => new Promise<void>(() => {})} onClose={vi.fn()} />);
    const del = screen.getByRole('button', { name: 'Delete everything inside' });
    fireEvent.click(del);
    expect(del.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Deleting the ads and their files from Google Drive… this can take a minute.');
  });
  it('focuses Cancel, not a destructive button', () => {
    render(<AdsDeleteDialog kind="set" name="X" count={3} onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
});
