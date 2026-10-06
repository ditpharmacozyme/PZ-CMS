import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { TutorialsLibrary } from './TutorialsLibrary';
import { Tutorial, TutorialCategory, TeamMember } from '../types';

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
    createdBy: 'Sarah Connor',
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
    createdBy: 'John Doe',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z'
  }
];

const mockCategories: TutorialCategory[] = [
  { id: 'cat-1', name: 'Onboarding & SOPs', sortOrder: 0, createdAt: '2026-10-04' },
  { id: 'cat-2', name: 'Video Production', sortOrder: 1, createdAt: '2026-10-04' }
];

const mockUploader: TeamMember = {
  id: 'user-1',
  name: 'Sarah Connor',
  email: 'sarah@example.com',
  role: 'Creative Director',
  userRole: 'Editor',
  avatarInitials: 'SC',
  color: '#4f46e5'
};

const mockOtherTeammate: TeamMember = {
  id: 'user-2',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  role: 'Designer',
  userRole: 'Editor',
  avatarInitials: 'AR',
  color: '#059669'
};

describe('TutorialsLibrary', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
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

  const renderComponent = (brandFilter: any = 'all', activeTeammate: any = mockUploader) => {
    return render(
      <BrandsProvider>
        <ConfirmProvider>
          <TutorialsLibrary selectedBrandFilter={brandFilter} activeTeammate={activeTeammate} />
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

  it('renders tutorial cards from stored data with creator info', () => {
    renderComponent();
    expect(screen.getByText('CapCut Video Editing SOP')).toBeInTheDocument();
    expect(screen.getByText('Pharmacozyme Brand Guidelines')).toBeInTheDocument();
    expect(screen.getByText('By Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('By John Doe')).toBeInTheDocument();
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

  it('navigates to YouTube watch page when Watch Tutorial is clicked', () => {
    renderComponent();
    const watchButtons = screen.getAllByRole('button', { name: /watch tutorial/i });
    fireEvent.click(watchButtons[0]);

    // Renders YouTube-style watch page with video player and back button
    expect(screen.getByRole('button', { name: /back to tutorials/i })).toBeInTheDocument();
    expect(screen.getByTitle('Full Editing Walkthrough')).toBeInTheDocument();
    expect(screen.getByText('Up next')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /share/i }).length).toBeGreaterThan(0);

    // Clicking Back to Tutorials returns to the library grid
    fireEvent.click(screen.getByRole('button', { name: /back to tutorials/i }));
    expect(screen.getByText('Tutorials & Courses')).toBeInTheDocument();
  });

  it('switches to a different tutorial from the Up Next sidebar on the watch page', () => {
    renderComponent();
    const watchButtons = screen.getAllByRole('button', { name: /watch tutorial/i });
    fireEvent.click(watchButtons[0]);

    // In watch page for CapCut, sidebar has Pharmacozyme Brand Guidelines
    const relatedCard = screen.getByRole('heading', { name: 'Pharmacozyme Brand Guidelines' });
    fireEvent.click(relatedCard);

    // Switches watch page to Pharmacozyme Brand Guidelines
    expect(screen.getAllByText('Pharmacozyme Brand Guidelines').length).toBeGreaterThan(0);
  });

  it('only allows the uploader to edit or delete the tutorial', () => {
    // 1. As Sarah Connor (uploader of tut-1), Sarah sees edit and delete buttons for tut-1
    const { unmount } = renderComponent('all', mockUploader);
    const sarahEditButtons = screen.queryAllByTitle(/edit tutorial/i);
    expect(sarahEditButtons.length).toBeGreaterThan(0);

    unmount();

    // 2. As Alex Rivera (NOT the uploader of tut-1 or tut-2), Alex does NOT see edit or delete buttons on either card
    renderComponent('all', mockOtherTeammate);
    const alexEditButtons = screen.queryAllByTitle(/edit tutorial/i);
    const alexDeleteButtons = screen.queryAllByTitle(/delete tutorial/i);
    expect(alexEditButtons.length).toBe(0);
    expect(alexDeleteButtons.length).toBe(0);
  });

  it('shows thumbnail upload option in the editor modal', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /new tutorial/i }));

    expect(screen.getByText(/Course Thumbnail \(Cover Image\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload image/i })).toBeInTheDocument();
  });
});
