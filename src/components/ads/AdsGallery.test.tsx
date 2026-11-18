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
import { downloadFiles as realDownload } from './downloadFiles';

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

describe('downloadFiles', () => {
  it('clicks one anchor per file', async () => {
    const actual = await vi.importActual<typeof import('./downloadFiles')>('./downloadFiles');
    expect(realDownload).toBeDefined();
    const clicks: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.href);
    });
    await actual.downloadFiles([file('a'), file('b')], 0);
    expect(clicks).toEqual([
      'https://drive.google.com/uc?export=download&id=a',
      'https://drive.google.com/uc?export=download&id=b',
    ]);
    spy.mockRestore();
  });
});
