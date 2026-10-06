import { Tutorial, TeamMember } from '../types';

/**
 * Checks if the active teammate is the original uploader/creator of the tutorial.
 * Per business rules, only the person who uploaded the tutorial can edit or delete it.
 */
export function canManageTutorial(
  tutorial: Tutorial | null | undefined,
  activeTeammate: TeamMember | null | undefined
): boolean {
  if (!tutorial || !activeTeammate) return false;

  const creator = (tutorial.createdBy || '').trim().toLowerCase();
  if (!creator) {
    // If createdBy is unset (legacy data), allow the current user to manage
    return true;
  }

  const teammateName = (activeTeammate.name || '').trim().toLowerCase();
  const teammateId = (activeTeammate.id || '').trim().toLowerCase();
  const teammateEmail = (activeTeammate.email || '').trim().toLowerCase();

  return (
    creator === teammateName ||
    creator === teammateId ||
    (Boolean(teammateEmail) && creator === teammateEmail)
  );
}
