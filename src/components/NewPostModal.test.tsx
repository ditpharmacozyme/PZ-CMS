import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrandsProvider } from '../context/BrandsContext';
import { ConfirmProvider } from './ui/ConfirmDialog';
import { NewPostModal } from './NewPostModal';
import { TeamMember } from '../types';

// BrandsProvider opens a Supabase realtime subscription on mount; the real
// client isn't configured in tests, so this keeps that from leaving a stray
// websocket connection behind after the test finishes (same pattern as
// TemplateLibrary.test.tsx).
vi.mock('../utils/storage', async (orig) => {
  const actual = await orig<typeof import('../utils/storage')>();
  return {
    ...actual,
    fetchRemoteBrands: vi.fn().mockResolvedValue(null),
    subscribeRemoteBrands: vi.fn().mockReturnValue(() => {}),
  };
});

const alice: TeamMember = {
  id: 't1', name: 'Alice', role: 'Lead', userRole: 'Admin',
  email: 'alice@x.com', avatarInitials: 'AL', color: '#4f46e5',
};
const bob: TeamMember = {
  id: 't2', name: 'Bob', role: 'CS', userRole: 'Manager',
  email: 'bob@x.com', avatarInitials: 'BO', color: '#0A66C2',
};

function renderModal() {
  render(
    <BrandsProvider>
      <ConfirmProvider>
        <NewPostModal
          initialDate="2026-10-01"
          teamMembers={[alice, bob]}
          activeTeammate={alice}
          onAddPost={() => {}}
          onClose={() => {}}
        />
      </ConfirmProvider>
    </BrandsProvider>,
  );
}

// Advance from step 1 ("What") to step 3 ("When and who"), where the
// assignees + reminder-email fields live.
async function goToWhenAndWhoStep() {
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Test post' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /next/i })); });
}

beforeEach(() => localStorage.clear());

describe('NewPostModal — reminder email auto-fill from assignees', () => {
  it('defaults the reminder recipient to the default assignee (the active teammate), not a hardcoded fallback', async () => {
    renderModal();
    await goToWhenAndWhoStep();
    expect((screen.getByPlaceholderText('e.g. name@example.com') as HTMLInputElement).value).toBe('alice@x.com');
  });

  it('updates the reminder recipient when the assignee list changes to someone else', async () => {
    renderModal();
    await goToWhenAndWhoStep();

    // Regression test: this auto-sync used to only run once while the field
    // was still empty, but the field started out already seeded with the
    // creator's own email -- so it never picked up a change in assignees,
    // and every reminder went to whoever created the post instead of who it
    // was assigned to.
    await act(async () => { fireEvent.click(screen.getByText('Alice')); }); // un-assign Alice
    await act(async () => { fireEvent.click(screen.getByText('Bob')); }); // assign Bob

    expect((screen.getByPlaceholderText('e.g. name@example.com') as HTMLInputElement).value).toBe('bob@x.com');
  });

  it('stops auto-syncing once the user types into the recipient field directly', async () => {
    renderModal();
    await goToWhenAndWhoStep();

    const input = screen.getByPlaceholderText('e.g. name@example.com') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'custom@example.com' } });

    await act(async () => { fireEvent.click(screen.getByText('Bob')); }); // assign Bob too

    expect(input.value).toBe('custom@example.com');
  });
});
