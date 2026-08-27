import React, { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Popover } from './Popover';

/** Toggleable host with a real anchor button, matching how a card's assignee
 * chip will use this in Phase 2. */
function ToggleHarness() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchorRef} onClick={() => setOpen(true)}>Open popover</button>
      {open && (
        <Popover isOpen={open} onClose={() => setOpen(false)} anchorRef={anchorRef} ariaLabel="Test popover">
          <button>Inside option</button>
        </Popover>
      )}
      <div data-testid="outside">Outside content</div>
    </>
  );
}

describe('Popover', () => {
  it('renders into document.body via a portal when open', () => {
    render(<ToggleHarness />);
    fireEvent.click(screen.getByText('Open popover'));
    const dialog = screen.getByRole('dialog', { name: 'Test popover' });
    expect(dialog.closest('body')).not.toBeNull();
  });

  it('renders nothing when closed', () => {
    render(<ToggleHarness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on Escape', () => {
    render(<ToggleHarness />);
    fireEvent.click(screen.getByText('Open popover'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose on an outside pointerdown', () => {
    render(<ToggleHarness />);
    fireEvent.click(screen.getByText('Open popover'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not close on a pointerdown inside the panel', () => {
    render(<ToggleHarness />);
    fireEvent.click(screen.getByText('Open popover'));
    fireEvent.pointerDown(screen.getByText('Inside option'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not close on a pointerdown on the anchor itself', () => {
    render(<ToggleHarness />);
    fireEvent.click(screen.getByText('Open popover'));
    fireEvent.pointerDown(screen.getByText('Open popover'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose exactly once per outside click, not per re-render', () => {
    const onClose = vi.fn();
    const anchorRef = { current: document.createElement('button') };
    document.body.appendChild(anchorRef.current);
    render(<Popover isOpen onClose={onClose} anchorRef={anchorRef}><button>Item</button></Popover>);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
