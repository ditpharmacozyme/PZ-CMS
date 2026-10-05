import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { TutorialsLibrary } from './TutorialsLibrary';
import { Tutorial, TutorialCategory } from '../types';

vi.mock('../utils/tutorialStorage', async (orig) => {
  const actual = await orig<typeof import('../utils/tutorialStorage')>();
  return {
    ...actual,
    fetchRemoteTutorialCategories: vi.fn().mockResolvedValue(null),
    subscribeRemoteTutorialCategories: vi.fn().mockReturnValue(() => {}),
    upsertRemoteTutorialCategory: vi.fn().mockResolvedValue(undefined),
    deleteRemoteTutorialCategory: vi.fn().mockResolvedValue(undefined),
    fetchRemoteTutorials: vi.fn().mockResolvedValue(null),
    subscribeRemoteTutorials: vi.fn().mockReturnValue(() => {}),
    upsertRemoteTutorial: vi.fn().mockResolvedValue(undefined),
    deleteRemoteTutorial: vi.fn().mockResolvedValue(undefined)
  };
});

const mockTutorials: Tutorial[] = [
  {
    id: 'tut-1',
    brandId: 'shared',
    title: 'CapCut Video Editing SOP',
    description: 'Complete guide to editing short-form reels in CapCut.',
    category: 'Video Production',
    tags: ['editing', 'capcut', 'reels'],
    videos: [
      { title: 'Full Editing Walkthrough', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ],
    links: [
      { title: 'Project Assets Drive', url: 'https://drive.google.com/drive/folders/123' }
    ],
    prompts: [
      { title: 'Video Hook Prompt', promptText: 'Write 3 attention-grabbing hooks for this reel.' }
    ],
    files: [
      { name: 'Preset.bundle', url: 'https://drive.google.com/file/d/preset' }
    ],
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z'
  },
  {
    id: 'tut-2',
    brandId: 'pharmacozyme',
    title: 'Pharmacozyme Brand Guidelines',
    description: 'Internal voice rules and typography specifications.',
    category: 'Onboarding & SOPs',
    tags: ['brand', 'guidelines'],
    videos: [],
    links: [],
    prompts: [],
    files: [],
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z'
  }
];

const mockCategories: TutorialCategory[] = [
  { id: 'cat-1', name: 'Onboarding & SOPs', sortOrder: 0, createdAt: '2026-10-04' },
  { id: 'cat-2', name: 'Video Production', sortOrder: 1, createdAt: '2026-10-04' }
];

describe('TutorialsLibrary', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'pharmacozyme_brandops_tutorials_v1',
      JSON.stringify(mockTutorials)
    );
    localStorage.setItem(
      'pharmacozyme_brandops_tutorial_categories_v1',
      JSON.stringify(mockCategories)
    );
  });

  const renderComponent = (brandFilter: any = 'all') => {
    return render(
      <BrandsProvider>
        <ConfirmProvider>
          <TutorialsLibrary selectedBrandFilter={brandFilter} />
        </ConfirmProvider>
      </BrandsProvider>
    );
  };

  it('renders header, title, and action buttons', () => {
    renderComponent();
    expect(screen.getByText('Tutorials & Courses')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new tutorial/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage categories/i })).toBeInTheDocument();
  });

  it('renders tutorial cards from stored data', () => {
    renderComponent();
    expect(screen.getByText('CapCut Video Editing SOP')).toBeInTheDocument();
    expect(screen.getByText('Pharmacozyme Brand Guidelines')).toBeInTheDocument();
  });

  it('filters tutorials by search query', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText(/search tutorials/i);

    fireEvent.change(searchInput, { target: { value: 'CapCut' } });
    expect(screen.getByText('CapCut Video Editing SOP')).toBeInTheDocument();
    expect(screen.queryByText('Pharmacozyme Brand Guidelines')).not.toBeInTheDocument();
  });

  it('filters tutorials by category pill', () => {
    renderComponent();
    const videoProdPills = screen.getAllByText('Video Production');
    // Click category pill (the first one)
    fireEvent.click(videoProdPills[0]);

    expect(screen.getByText('CapCut Video Editing SOP')).toBeInTheDocument();
    expect(screen.queryByText('Pharmacozyme Brand Guidelines')).not.toBeInTheDocument();
  });

  it('opens New Tutorial editor modal when New Tutorial button is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /new tutorial/i }));
    expect(screen.getByText('Add New Tutorial / Course')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Master Video Editing/i)).toBeInTheDocument();
  });

  it('opens Manage Categories modal when Manage Categories button is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /manage categories/i }));
    expect(screen.getByRole('heading', { name: 'Manage Categories' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/new category name/i)).toBeInTheDocument();
  });

  it('opens detail modal with video player when View Tutorial is clicked', () => {
    renderComponent();
    const viewButtons = screen.getAllByRole('button', { name: /view tutorial/i });
    fireEvent.click(viewButtons[0]);

    // Detail modal opens with title and embedded video iframe
    expect(screen.getByTitle('Full Editing Walkthrough')).toBeInTheDocument();
    expect(screen.getByText(/Notes & Overview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Prompts/i).length).toBeGreaterThan(0);
  });
});
