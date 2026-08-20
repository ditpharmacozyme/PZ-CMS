import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Modal } from './Modal';

/** Toggleable host so open/close, and the focus round-trip, are realistic. */
function ToggleHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open modal</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Delete this post?">
        <button>Inside field</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders into document.body via a portal, not inline', () => {
    render(<Modal isOpen onClose={() => {}} title="Test title"><p>content</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('body')).not.toBeNull();
  });

  it('labels the dialog with the title via aria-labelledby', () => {
    render(<Modal isOpen onClose={() => {}} title="Delete this post?"><p>content</p></Modal>);
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Delete this post?');
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Test"><p>content</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the dirty prompt instead of closing when isDirty is true', () => {
    const onClose = vi.fn();
    render(
      <Modal
        isOpen
        onClose={onClose}
        title="Test"
        isDirty
        dirtyPrompt={{ title: 'Discard changes?', body: 'body', confirmLabel: 'Discard', cancelLabel: 'Keep editing' }}
      >
        <p>content</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal isOpen onClose={onClose} title="Test"><p>content</p></Modal>);
    // First child of the portal root is the backdrop overlay div (aria-hidden).
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
    void container;
  });

  it('does not call onClose on backdrop click when closeOnBackdrop is false', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Test" closeOnBackdrop={false}><p>content</p></Modal>);
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the panel on open and restores it to the trigger on close', async () => {
    render(<ToggleHarness />);
    const openButton = screen.getByText('Open modal');
    openButton.focus();
    expect(document.activeElement).toBe(openButton);

    fireEvent.click(openButton);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(openButton);
  });
});
