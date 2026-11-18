import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { AdsSnapshot, AdFile } from '../../types';

const downloadSpy = vi.fn(async (_files: AdFile[]) => {});
vi.mock('./downloadFiles', () => ({
  downloadFiles: (files: AdFile[]) => downloadSpy(files),
}));

import { AdsGallery } from './AdsGallery';
import { AdsSearchBar } from './AdsSearchBar';

const file = (id: string, mime = 'image/png', name = `${id}.png`): AdFile => ({
  driveFileId: id, name, mimeType: mime, sizeBytes: 10,
});
const base = { hidden: false, createdBy: 'u', createdAt: '', updatedAt: '' };

const snapshot: AdsSnapshot = {
  programs: [
    { id: 'p1', name: 'Pharma Course', brandId: 'b1', kind: 'course', driveFolderId: 'd', ...base },
  ],
  sets: [
    { id: 's1', programId: 'p1', name: 'Course Set A', audience: 'Doctors', driveFolderId: 'd', isSystem: false, ...base },
    { id: 's2', programId: null, name: 'Loose Set', audience: 'All', driveFolderId: 'd', isSystem: false, ...base },
  ],
  creatives: [
    { id: 'c1', setId: 's1', name: 'Banner One', format: 'image', files: [file('f1')], sourceUrl: '', uploadedBy: 'u', ...base, hidden: false } as never,
    { id: 'c2', setId: 's1', name: 'Carousel Two', format: 'carousel', files: [file('f2'), file('f3'), file('f4')], sourceUrl: '', uploadedBy: 'u', ...base } as never,
    { id: 'c3', setId: 's1', name: 'Empty Three', format: 'other', files: [], sourceUrl: '', uploadedBy: 'u', ...base } as never,
    { id: 'c4', setId: 's2', name: 'Loose Creative', format: 'image', files: [file('f5')], sourceUrl: '', uploadedBy: 'u', ...base } as never,
  ],
};

const brandName = (id: string) => (id === 'b1' ? 'Brand One' : id);

beforeEach(() => downloadSpy.mockClear());

describe('AdsGallery', () => {
  it('top level shows course and loose-set cards', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} />);
    expect(screen.getByText('Pharma Course')).toBeTruthy();
    expect(screen.getByText('Loose Set')).toBeTruthy();
    expect(screen.queryByText('Course Set A')).toBeNull();
  });

  it('clicking a course shows only its sets', () => {
    const onOpenProgram = vi.fn();
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} onOpenProgram={onOpenProgram} />);
    fireEvent.click(screen.getByText('Pharma Course'));
    expect(onOpenProgram).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Course Set A')).toBeTruthy();
    expect(screen.queryByText('Loose Set')).toBeNull();
  });

  it('selecting 2 creatives enables Download 2 selected and downloads all their files', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable />);
    fireEvent.click(screen.getByText('Pharma Course'));
    fireEvent.click(screen.getByText('Course Set A'));
    expect(screen.queryByRole('button', { name: /Download \d+ selected/ })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banner One' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Carousel Two' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download 2 selected' }));
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.mock.calls[0][0].map(f => f.driveFileId)).toEqual(['f1', 'f2', 'f3', 'f4']);
  });

  it('a carousel creative download button includes all slide files', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} />);
    fireEvent.click(screen.getByText('Pharma Course'));
    fireEvent.click(screen.getByText('Course Set A'));
    expect(screen.getByText('3 slides')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download Carousel Two' }));
    expect(downloadSpy.mock.calls[0][0].map(f => f.driveFileId)).toEqual(['f2', 'f3', 'f4']);
  });

  it('shows an empty message when nothing matches', () => {
    render(<AdsGallery snapshot={{ programs: [], sets: [], creatives: [] }} brandName={brandName} selectable={false} searching />);
    expect(screen.getByText('No ads match your search.')).toBeTruthy();
  });

  it('a creative with zero files renders a placeholder tile, not an image', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} />);
    fireEvent.click(screen.getByText('Pharma Course'));
    fireEvent.click(screen.getByText('Course Set A'));
    const card = screen.getByText('Empty Three').closest('[data-testid="creative-card"]') as HTMLElement;
    expect(within(card).queryByRole('img')).toBeNull();
    expect(within(card).getByTestId('creative-placeholder')).toBeTruthy();
  });

  it('searching shows a flat list of courses, sets and creatives', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} searching />);
    expect(screen.getByText('Pharma Course')).toBeTruthy();
    expect(screen.getByText('Course Set A')).toBeTruthy();
    expect(screen.getByText('Banner One')).toBeTruthy();
  });

  it('renders renderActions output per item', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false}
      renderActions={(kind, id) => <button>act-{kind}-{id}</button>} />);
    expect(screen.getByText('act-program-p1')).toBeTruthy();
    expect(screen.getByText('act-set-s2')).toBeTruthy();
  });
});

describe('AdsSearchBar', () => {
  it('reports query changes, filter changes and clears', () => {
    const onQueryChange = vi.fn();
    const onFiltersChange = vi.fn();
    render(<AdsSearchBar query="x" onQueryChange={onQueryChange} filters={{ kind: 'course' }}
      onFiltersChange={onFiltersChange} brands={[{ id: 'b1', name: 'Brand One' }]} audiences={['Doctors']} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'abc' } });
    expect(onQueryChange).toHaveBeenCalledWith('abc');
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'b1' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: 'course', brandId: 'b1' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onQueryChange).toHaveBeenCalledWith('');
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('hides Clear when nothing is set', () => {
    render(<AdsSearchBar query="" onQueryChange={() => {}} filters={{}} onFiltersChange={() => {}} brands={[]} audiences={[]} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });
});

describe('AdsGallery behaviour (fix round 1)', () => {
  const openSetA = () => {
    fireEvent.click(screen.getByText('Pharma Course'));
    fireEvent.click(screen.getByText('Course Set A'));
  };

  it('search-mode folder clicks notify the parent but do not change internal navigation', () => {
    const onOpenProgram = vi.fn();
    const onOpenSet = vi.fn();
    const { rerender } = render(
      <AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} searching
        onOpenProgram={onOpenProgram} onOpenSet={onOpenSet} />,
    );
    fireEvent.click(screen.getByText('Pharma Course'));
    fireEvent.click(screen.getByText('Loose Set'));
    expect(onOpenProgram).toHaveBeenCalledWith('p1');
    expect(onOpenSet).toHaveBeenCalledWith('s2');
    rerender(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false}
      onOpenProgram={onOpenProgram} onOpenSet={onOpenSet} />);
    // Back at the top level, not jumped into a course or set.
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(screen.getByText('Loose Set')).toBeTruthy();
    expect(screen.getByText('Pharma Course')).toBeTruthy();
  });

  it('selection persists across navigation', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable />);
    openSetA();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banner One' }));
    fireEvent.click(screen.getByRole('button', { name: 'All ads' }));
    fireEvent.click(screen.getByText('Loose Set'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Loose Creative' }));
    expect(screen.getByRole('button', { name: 'Download 2 selected' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All ads' }));
    fireEvent.click(screen.getByText('Pharma Course'));
    fireEvent.click(screen.getByText('Course Set A'));
    expect((screen.getByRole('checkbox', { name: 'Select Banner One' }) as HTMLInputElement).checked).toBe(true);
  });

  it('Select all toggles visible creatives on and off, skipping creatives with no files', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable />);
    openSetA();
    expect(screen.queryByRole('checkbox', { name: 'Select Empty Three' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByRole('button', { name: 'Download 2 selected' })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.queryByRole('button', { name: /Download \d+ selected/ })).toBeNull();
  });

  it('drops selected creatives that vanish from the snapshot', () => {
    const { rerender } = render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable />);
    openSetA();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Banner One' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Carousel Two' }));
    expect(screen.getByRole('button', { name: 'Download 2 selected' })).toBeTruthy();
    rerender(<AdsGallery selectable brandName={brandName}
      snapshot={{ ...snapshot, creatives: snapshot.creatives.filter(c => c.id !== 'c1') }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download 1 selected' }));
    expect(downloadSpy.mock.calls[0][0].map(f => f.driveFileId)).toEqual(['f2', 'f3', 'f4']);
  });

  it('falls back to a tile when the thumbnail fails to load', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} />);
    openSetA();
    const img = screen.getByAltText('Banner One');
    expect(img.getAttribute('loading')).toBe('lazy');
    fireEvent.error(img);
    expect(screen.queryByAltText('Banner One')).toBeNull();
    const card = screen.getByText('Banner One').closest('[data-testid="creative-card"]') as HTMLElement;
    expect(within(card).getByTestId('creative-placeholder')).toBeTruthy();
    expect(within(card).getByText('Preview unavailable')).toBeTruthy();
  });

  it('shows format badges and a generic tile (no thumbnail attempt) for zip files', () => {
    const zipSnap: AdsSnapshot = {
      programs: [],
      sets: [snapshot.sets[1]],
      creatives: [
        { ...snapshot.creatives[3], id: 'z1', name: 'Zip Pack', format: 'zip', files: [file('z', 'application/zip', 'pack.zip')] },
        { ...snapshot.creatives[3], id: 'v1', name: 'Video Ad', format: 'video', files: [file('v', 'video/mp4', 'v.mp4')] },
        { ...snapshot.creatives[3], id: 'o1', name: 'Other Doc', format: 'other', files: [file('o', 'application/pdf', 'd.pdf')] },
      ],
    };
    render(<AdsGallery snapshot={zipSnap} brandName={brandName} selectable={false} />);
    fireEvent.click(screen.getByText('Loose Set'));
    const zipCard = screen.getByText('Zip Pack').closest('[data-testid="creative-card"]') as HTMLElement;
    expect(within(zipCard).queryByRole('img')).toBeNull();
    expect(within(zipCard).getByText('Zip')).toBeTruthy();
    expect(within(zipCard).getByTestId('creative-placeholder')).toBeTruthy();
    const videoCard = screen.getByText('Video Ad').closest('[data-testid="creative-card"]') as HTMLElement;
    expect(within(videoCard).getByText('Video')).toBeTruthy();
    const otherCard = screen.getByText('Other Doc').closest('[data-testid="creative-card"]') as HTMLElement;
    expect(within(otherCard).getByText('File')).toBeTruthy();
  });

  it('current-location crumb is not a button and is marked as current', () => {
    render(<AdsGallery snapshot={snapshot} brandName={brandName} selectable={false} />);
    fireEvent.click(screen.getByText('Pharma Course'));
    const current = within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Pharma Course');
    expect(current.tagName).toBe('SPAN');
    expect(current.getAttribute('aria-current')).toBe('page');
  });
});

describe('downloadFiles', () => {
  const hrefOf = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;

  it('clicks one anchor per file in order, with download attr, removing each anchor', async () => {
    const actual = await vi.importActual<typeof import('./downloadFiles')>('./downloadFiles');
    const seen: { href: string; download: string; inDom: boolean }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ href: this.href, download: this.getAttribute('download') ?? '', inDom: document.body.contains(this) });
    });
    const append = vi.spyOn(document.body, 'appendChild');
    await actual.downloadFiles([file('a'), file('b')], 0);
    expect(seen.map(s => s.href)).toEqual([hrefOf('a'), hrefOf('b')]);
    expect(seen.map(s => s.download)).toEqual(['a.png', 'b.png']);
    expect(seen.every(s => s.inDom)).toBe(true);
    expect(append).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('a[download]').length).toBe(0);
    click.mockRestore();
    append.mockRestore();
  });

  it('removes the anchor even when click throws', async () => {
    const actual = await vi.importActual<typeof import('./downloadFiles')>('./downloadFiles');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });
    await expect(actual.downloadFiles([file('a')], 0)).rejects.toThrow('blocked');
    expect(document.querySelectorAll('a[download]').length).toBe(0);
    click.mockRestore();
  });

  it('ignores an overlapping call while a run is in progress', async () => {
    const actual = await vi.importActual<typeof import('./downloadFiles')>('./downloadFiles');
    const clicks: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.href);
    });
    const first = actual.downloadFiles([file('a'), file('b')], 5);
    const second = actual.downloadFiles([file('c')], 5);
    expect(second).toBe(first);
    await first;
    expect(clicks).toEqual([hrefOf('a'), hrefOf('b')]);
    // A new run is allowed once the previous one finished.
    await actual.downloadFiles([file('c')], 0);
    expect(clicks[2]).toBe(hrefOf('c'));
    click.mockRestore();
  });
});
