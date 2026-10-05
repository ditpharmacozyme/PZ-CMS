import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InAppVideoPlayer } from './InAppVideoPlayer';
import { TutorialVideo } from '../../types';

describe('InAppVideoPlayer', () => {
  it('renders placeholder when no videos provided', () => {
    render(<InAppVideoPlayer videos={[]} />);
    expect(screen.getByText('No video attached to this tutorial.')).toBeInTheDocument();
  });

  it('renders iframe for YouTube video', () => {
    const videos: TutorialVideo[] = [
      { title: 'Intro Lesson', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    ];
    render(<InAppVideoPlayer videos={videos} />);
    const iframe = screen.getByTitle('Intro Lesson');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('renders iframe for Google Drive video', () => {
    const videos: TutorialVideo[] = [
      { title: 'Drive Masterclass', url: 'https://drive.google.com/file/d/test12345/view' }
    ];
    render(<InAppVideoPlayer videos={videos} />);
    const iframe = screen.getByTitle('Drive Masterclass');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://drive.google.com/file/d/test12345/preview');
  });

  it('renders multi-video selector tabs and switches video on click', () => {
    const videos: TutorialVideo[] = [
      { title: 'Part 1', url: 'https://youtu.be/video111111' },
      { title: 'Part 2', url: 'https://youtu.be/video222222' }
    ];
    render(<InAppVideoPlayer videos={videos} />);
    const tab1 = screen.getByRole('button', { name: /Part 1/i });
    const tab2 = screen.getByRole('button', { name: /Part 2/i });
    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    // Starts on Part 1
    let iframe = screen.getByTitle('Part 1');
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/video111111');

    // Switch to Part 2
    fireEvent.click(tab2);
    iframe = screen.getByTitle('Part 2');
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/video222222');
  });

  it('renders fallback card for non-embeddable external URLs', () => {
    const videos: TutorialVideo[] = [
      { title: 'Coursera Course', url: 'https://coursera.org/learn/specialization' }
    ];
    render(<InAppVideoPlayer videos={videos} />);
    expect(screen.getByText('Watch on External Site')).toBeInTheDocument();
  });
});
