import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { moveImage, ImageCarouselField } from './ImageCarouselField';

describe('moveImage', () => {
  it('moves an element from one index to another, shifting the rest', () => {
    expect(moveImage(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveImage(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    expect(moveImage(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });
});

vi.mock('../../utils/uploadImage', () => ({
  uploadImages: vi.fn(),
}));
import { uploadImages } from '../../utils/uploadImage';

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('ImageCarouselField', () => {
  it('renders a thumbnail per image with its 1-based slide number', () => {
    render(<ImageCarouselField images={['https://a', 'https://b']} onChange={() => {}} />);
    expect(screen.getByAltText('Slide 1')).toBeTruthy();
    expect(screen.getByAltText('Slide 2')).toBeTruthy();
  });

  it('removing a slide calls onChange with that slide filtered out', () => {
    const onChange = vi.fn();
    render(<ImageCarouselField images={['https://a', 'https://b']} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove slide 1'));
    expect(onChange).toHaveBeenCalledWith(['https://b']);
  });

  it('uploads selected files and appends the results to images', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: [{ url: 'https://new', fileName: 'new.png' }],
      failed: [],
    });
    const onChange = vi.fn();
    render(<ImageCarouselField images={['https://a']} onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('new.png')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://a', 'https://new']));
  });

  it('shows failed filenames without discarding successful uploads', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: [{ url: 'https://ok', fileName: 'ok.png' }],
      failed: [{ file: makeFile('bad.png'), error: 'boom' }],
    });
    const onChange = vi.fn();
    render(<ImageCarouselField images={[]} onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('ok.png'), makeFile('bad.png')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://ok']));
    expect(await screen.findByText(/Failed to upload: bad.png/)).toBeTruthy();
  });

  it('disables the add button and shows the cap message at 10 images', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `https://img${i}`);
    render(<ImageCarouselField images={ten} onChange={() => {}} />);
    expect(screen.getByText(/10\/10 — remove a slide/)).toBeTruthy();
    expect(screen.getByText(/10\/10 — remove a slide/).closest('button')).toBeDisabled();
  });

  it('calls onUploadingChange(true) then onUploadingChange(false) around an upload', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({ succeeded: [{ url: 'https://ok', fileName: 'ok.png' }], failed: [] });
    const onUploadingChange = vi.fn();
    render(<ImageCarouselField images={[]} onChange={() => {}} onUploadingChange={onUploadingChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('ok.png')] } });

    await waitFor(() => expect(onUploadingChange).toHaveBeenLastCalledWith(false));
    expect(onUploadingChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('caps a multi-file selection to the remaining slots', async () => {
    (uploadImages as ReturnType<typeof vi.fn>).mockResolvedValue({
      succeeded: [{ url: 'https://new1', fileName: 'n1.png' }],
      failed: [],
    });
    const nine = Array.from({ length: 9 }, (_, i) => `https://img${i}`);
    render(<ImageCarouselField images={nine} onChange={() => {}} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile('n1.png'), makeFile('n2.png')] } });

    await waitFor(() => expect(uploadImages).toHaveBeenCalledWith([expect.objectContaining({ name: 'n1.png' })], expect.any(Function)));
  });
});
