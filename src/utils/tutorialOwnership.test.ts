import { describe, it, expect } from 'vitest';
import { canManageTutorial } from './tutorialOwnership';
import { Tutorial, TeamMember } from '../types';

describe('canManageTutorial', () => {
  const mockTeammate: TeamMember = {
    id: 'user-1',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    role: 'Creative Lead',
    userRole: 'Editor',
    avatarInitials: 'SC',
    color: '#4f46e5'
  };

  const otherTeammate: TeamMember = {
    id: 'user-2',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Copywriter',
    userRole: 'Editor',
    avatarInitials: 'JD',
    color: '#059669'
  };

  const tutorial: Tutorial = {
    id: 'tut-1',
    brandId: 'shared',
    title: 'Video Guide',
    description: 'A test guide',
    category: 'Video Production',
    tags: [],
    videos: [],
    links: [],
    prompts: [],
    files: [],
    createdBy: 'Sarah Connor',
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01'
  };

  it('allows the original uploader (matched by name)', () => {
    expect(canManageTutorial(tutorial, mockTeammate)).toBe(true);
  });

  it('denies a different teammate who did not upload it', () => {
    expect(canManageTutorial(tutorial, otherTeammate)).toBe(false);
  });

  it('denies if activeTeammate is null or undefined', () => {
    expect(canManageTutorial(tutorial, null)).toBe(false);
    expect(canManageTutorial(tutorial, undefined)).toBe(false);
  });

  it('allows if createdBy is empty (legacy fallback)', () => {
    const legacyTutorial = { ...tutorial, createdBy: '' };
    expect(canManageTutorial(legacyTutorial, mockTeammate)).toBe(true);
    expect(canManageTutorial(legacyTutorial, otherTeammate)).toBe(true);
  });
});
