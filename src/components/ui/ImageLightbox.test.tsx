import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageLightbox } from './ImageLightbox';

const images = ['https://example.com/a.png', 'https://example.com/b.png', 'https://example.com/c.png'];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ImageLightbox', () => {
  it('renders nothing when closed or empty', () => {
    const { container, rerender } = render(
      <ImageLightbox isOpen={false} onClose={() => {}} images={images} />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    rerender(<ImageLightbox isOpen onClose={() => {}} images={[]} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the current image and a counter, and navigates with the arrow buttons', () => {
    render(<ImageLightbox isOpen onClose={() => {}} images={images} title="Test Template" />);

    expect(screen.getByText('Image 1 of 3')).toBeTruthy();
    expect(screen.getByAltText('Test Template 1')).toHaveAttribute('src', images[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('Image 2 of 3')).toBeTruthy();
    expect(screen.getByAltText('Test Template 2')).toHaveAttribute('src', images[1]);

    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByText('Image 1 of 3')).toBeTruthy();
  });

  it('wraps from the last image to the first with Next', () => {
    render(<ImageLightbox isOpen onClose={() => {}} images={images} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('Image 3 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('Image 1 of 3')).toBeTruthy();
  });

  it('jumps to an image via its thumbnail', () => {
    render(<ImageLightbox isOpen onClose={() => {}} images={images} />);
    fireEvent.click(screen.getByRole('button', { name: 'View image 3' }));
    expect(screen.getByText('Image 3 of 3')).toBeTruthy();
  });

  it('does not show navigation controls for a single image', () => {
    render(<ImageLightbox isOpen onClose={() => {}} images={[images[0]]} />);
    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
    expect(screen.queryByText(/Image 1 of/)).toBeNull();
  });

  it('copies the current image to the clipboard and shows confirmation', async () => {
    const blob = new Blob(['bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));
    vi.stubGlobal('ClipboardItem', function ClipboardItem(items: unknown) { return items; });
    const write = vi.fn(async ([item]: Record<string, Promise<Blob>>[]) => { await Promise.all(Object.values(item)); });
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } });

    render(<ImageLightbox isOpen onClose={() => {}} images={images} />);
    fireEvent.click(screen.getByRole('button', { name: /copy image/i }));

    await waitFor(() => expect(screen.getByText('Image copied!')).toBeTruthy());
    expect(write).toHaveBeenCalledTimes(1);
  });
});
