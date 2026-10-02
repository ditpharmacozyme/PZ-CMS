import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionsBar } from './BulkActionsBar';
import { TeamMember } from '../../types';

function makeMember(overrides: Partial<TeamMember>): TeamMember {
  return {
    id: 'tm-1',
    name: 'Hamza Ansari',
    role: 'Lead',
    userRole: 'Admin',
    email: 'hamza@example.com',
    avatarInitials: 'HA',
    color: '#4f46e5',
    ...overrides,
  };
}

const teamMembers: TeamMember[] = [
  makeMember({ id: 'tm-1', name: 'Hamza Ansari', avatarInitials: 'HA' }),
  makeMember({ id: 'tm-2', name: 'Tayyaba Gul', avatarInitials: 'TG' }),
  makeMember({ id: 'tm-3', name: 'Areeba Shahid', avatarInitials: 'AS' }),
];

function renderBar(onApplyBulkAssignees = vi.fn()) {
  render(
    <BulkActionsBar
      selectedCount={3}
      isSelectMode
      setIsSelectMode={() => {}}
      onSelectAll={() => {}}
      onClearSelection={() => {}}
      onApplyBulkAssignees={onApplyBulkAssignees}
      onBulkDelete={() => {}}
      teamMembers={teamMembers}
    />
  );
  return { onApplyBulkAssignees };
}

describe('BulkActionsBar — multi-person assign', () => {
  it('opens a checkbox list of team members from the Assign People button', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: /assign people/i }));
    expect(screen.getByRole('checkbox', { name: /hamza ansari/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /tayyaba gul/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /areeba shahid/i })).toBeInTheDocument();
  });

  it('applies every checked person in one call when Apply is clicked', () => {
    const { onApplyBulkAssignees } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /assign people/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /hamza ansari/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /tayyaba gul/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /areeba shahid/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply to 3/i }));
    expect(onApplyBulkAssignees).toHaveBeenCalledTimes(1);
    expect(onApplyBulkAssignees).toHaveBeenCalledWith(['Hamza Ansari', 'Tayyaba Gul', 'Areeba Shahid']);
  });

  it('does not call apply when nothing is checked', () => {
    const { onApplyBulkAssignees } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /assign people/i }));
    expect(screen.queryByRole('button', { name: /apply to/i })).not.toBeInTheDocument();
    expect(onApplyBulkAssignees).not.toHaveBeenCalled();
  });

  it('unchecking a selected member removes them from the applied set', () => {
    const { onApplyBulkAssignees } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: /assign people/i }));
    const hamzaBox = screen.getByRole('checkbox', { name: /hamza ansari/i });
    fireEvent.click(hamzaBox);
    fireEvent.click(hamzaBox);
    expect(screen.queryByRole('button', { name: /apply to/i })).not.toBeInTheDocument();
    expect(onApplyBulkAssignees).not.toHaveBeenCalled();
  });
});
