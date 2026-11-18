import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdsUploadZone } from './AdsUploadZone';
import { uploadToDrive } from '../../utils/adsUpload';
import type { AdFile } from '../../types';

vi.mock('../../utils/adsUpload', () => ({ uploadToDrive: vi.fn() }));
const upload = vi.mocked(uploadToDrive);

const adFile = (f: File): AdFile => ({ driveFileId: `id-${f.name}`, name: f.name, mimeType: f.type, sizeBytes: f.size });
const png = (n: string) => new File(['x'], n, { type: 'image/png' });

const drop = (files: File[]) => {
  fireEvent.drop(screen.getByTestId('ads-drop-zone'), { dataTransfer: { files } });
};

beforeEach(() => {
  upload.mockReset();
  upload.mockImplementation(async (f) => adFile(f));
});

describe('AdsUploadZone', () => {
  it('asks carousel vs separate when 2 images are dropped, and carousel yields one item with 2 files', async () => {
    const onUploaded = vi.fn();
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={onUploaded} />);
    drop([png('a.png'), png('b.png')]);
    expect(screen.getByText(/Save as/i)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /one carousel/i }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    const items = onUploaded.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('a');
    expect(items[0].files.map((f: AdFile) => f.name)).toEqual(['a.png', 'b.png']);
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'f1', expect.any(Function));
  });

  it('separate ads yields one item per file with extension-less names', async () => {
    const onUploaded = vi.fn();
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={onUploaded} />);
    drop([png('a.png'), png('b.png')]);
    fireEvent.click(screen.getByRole('button', { name: /separate ads/i }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(onUploaded.mock.calls[0][0].map((i: { name: string }) => i.name)).toEqual(['a', 'b']);
  });

  it('a single file uploads without the question', async () => {
    const onUploaded = vi.fn();
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={onUploaded} />);
    drop([png('one.png')]);
    expect(screen.queryByText(/Save as/i)).toBeNull();
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
  });

  it('shows Upload failed + Retry, does not call onUploaded, and retry succeeds', async () => {
    upload.mockRejectedValueOnce(new Error('Upload failed — check your connection and try again'));
    const onUploaded = vi.fn();
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={onUploaded} />);
    drop([png('one.png')]);
    expect(await screen.findByText(/Upload failed/)).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('keeps successes when another file fails and reports them on Done', async () => {
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const zip = new File(['x'], 'bad.zip', { type: 'application/zip' });
    upload.mockImplementation(async (f) => {
      if (f.name === 'bad.zip') throw new Error('nope');
      return adFile(f);
    });
    const onUploaded = vi.fn();
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={onUploaded} />);
    drop([pdf, zip]);
    await screen.findByText(/Upload failed/);
    expect(onUploaded).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onUploaded).toHaveBeenCalledTimes(1);
    expect(onUploaded.mock.calls[0][0]).toEqual([{ name: 'doc', files: [adFile(pdf)] }]);
  });

  it('rejects unsupported types with a plain message', () => {
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={vi.fn()} />);
    drop([new File(['x'], 'a.exe', { type: 'application/x-msdownload' })]);
    expect(screen.getByText("That file type isn't supported here.")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('runs at most 3 uploads at a time', async () => {
    let active = 0;
    let peak = 0;
    upload.mockImplementation(async (f) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return adFile(f);
    });
    const onUploaded = vi.fn();
    render(<AdsUploadZone setId="s1" folderId="f1" onUploaded={onUploaded} />);
    drop(Array.from({ length: 5 }, (_, i) => new File(['x'], `d${i}.pdf`, { type: 'application/pdf' })));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(peak).toBe(3);
  });
});
