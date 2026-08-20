import { describe, it, expect } from 'vitest';
import { isMine } from './postOwnership';
import { Post, TeamMember } from '../types';

function makePost(overrides: Partial<Post>): Post {
  return {
    id: 'p1',
    brandId: 'pharmacozyme',
    title: 'Test post',
    caption: '',
    platform: 'instagram',
    specType: 'feed-post',
    scheduledDate: '',
    scheduledTime: '',
    status: 'not-started',
    assignees: [],
    visualUrl: '',
    approved: false,
    comments: [],
    activityLog: [],
    tags: [],
    ...overrides
  } as Post;
}

function makeTeammate(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'tm1',
    name: 'Bob the Designer',
    role: 'Designer',
    userRole: 'Editor',
    email: 'bob@example.com',
    avatarInitials: 'BD',
    color: '#000000',
    ...overrides
  };
}

describe('isMine', () => {
  it('is true when the teammate is a plain assignee', () => {
    const teammate = makeTeammate({ name: 'Alice' });
    const post = makePost({ assignees: ['Alice'] });
    expect(isMine(post, teammate)).toBe(true);
  });

  it('is true when the teammate is only the taskRoles designer, not an assignee', () => {
    const teammate = makeTeammate({ name: 'Bob the Designer' });
    const post = makePost({ assignees: [], taskRoles: { designer: 'Bob the Designer' } });
    expect(isMine(post, teammate)).toBe(true);
  });

  it('is true when the teammate is only the taskRoles publisher, not an assignee', () => {
    const teammate = makeTeammate({ name: 'Priya' });
    const post = makePost({ assignees: [], taskRoles: { publisher: 'Priya' } });
    expect(isMine(post, teammate)).toBe(true);
  });

  it('is true when the teammate is only the taskRoles engagementLead, not an assignee', () => {
    const teammate = makeTeammate({ name: 'Sam' });
    const post = makePost({ assignees: [], taskRoles: { engagementLead: 'Sam' } });
    expect(isMine(post, teammate)).toBe(true);
  });

  it('is false when the teammate is in neither assignees nor taskRoles', () => {
    const teammate = makeTeammate({ name: 'Nobody Here' });
    const post = makePost({ assignees: ['Alice'], taskRoles: { designer: 'Bob the Designer' } });
    expect(isMine(post, teammate)).toBe(false);
  });

  it('is false when no teammate is given', () => {
    const post = makePost({ assignees: ['Alice'] });
    expect(isMine(post, null)).toBe(false);
  });
});
