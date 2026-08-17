import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { TeamMember } from '../types';
import {
  getStoredTeam,
  saveStoredTeam,
  fetchRemoteTeam,
  upsertRemoteTeamMember,
  removeTeamMemberAccount,
  subscribeRemoteTeam,
  linkTeamMemberAuthUser,
  isSupabaseConfigured
} from '../utils/storage';
import { supabase } from '../lib/supabase';
import { logAuditEvent, buildAuditEvent, clearSessionId } from '../utils/audit';

export function useTeamAndAuth(showToast: (msg: string) => void) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => getStoredTeam());
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(!supabase);
  const [mustSetPassword, setMustSetPassword] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hashType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
    const queryType = new URLSearchParams(window.location.search).get('type');
    const type = hashType || queryType;
    return type === 'invite' || type === 'recovery';
  });

  // Load team members from Supabase on mount (only when configured)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    fetchRemoteTeam().then((remote) => {
      if (remote && remote.length > 0) setTeamMembers(remote);
    });
    const unsub = subscribeRemoteTeam((updated) => setTeamMembers(updated));
    return () => unsub();
  }, []);

  // Save to local storage on change
  useEffect(() => {
    saveStoredTeam(teamMembers);
  }, [teamMembers]);

  // Handle Supabase Auth sessions
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // Handle invite / recovery link tokens
  useEffect(() => {
    if (!supabase) return;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (tokenHash && (type === 'invite' || type === 'recovery')) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
        if (!error) setMustSetPassword(true);
        window.history.replaceState({}, '', window.location.pathname);
      });
    } else if (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const authEmail = session?.user?.email?.toLowerCase() || null;
  const matchedTeammate = authEmail
    ? teamMembers.find((m) => m.email.toLowerCase() === authEmail) || null
    : null;
  const activeTeammate = supabase ? matchedTeammate : (teamMembers[0] || null);
  const noProfileMatch = !!supabase && !!session && !matchedTeammate;

  // Auto-link authenticated account to team member row
  useEffect(() => {
    if (!supabase || !session?.user || !matchedTeammate || matchedTeammate.authUserId) return;
    const authUserId = session.user.id;
    linkTeamMemberAuthUser(matchedTeammate.id);
    setTeamMembers((prev) => prev.map((m) => (m.id === matchedTeammate.id ? { ...m, authUserId } : m)));
  }, [session, matchedTeammate]);

  // Announce & audit login once per session
  const hasAnnouncedLoginRef = useRef(false);
  useEffect(() => {
    if (!supabase) return;
    if (!session) {
      hasAnnouncedLoginRef.current = false;
      return;
    }
    if (activeTeammate && !hasAnnouncedLoginRef.current) {
      hasAnnouncedLoginRef.current = true;
      showToast(`Welcome back, ${activeTeammate.name}`);
      logAuditEvent(
        buildAuditEvent({
          actorId: activeTeammate.id,
          actorName: activeTeammate.name,
          actionType: 'login',
          entityType: 'session',
          entityId: activeTeammate.id,
          entityTitle: `Signed in as ${activeTeammate.name} (${activeTeammate.userRole || 'Editor'})`
        })
      );
    }
  }, [session, activeTeammate, showToast]);

  const handleLogout = async () => {
    if (activeTeammate) {
      logAuditEvent(
        buildAuditEvent({
          actorId: activeTeammate.id,
          actorName: activeTeammate.name,
          actionType: 'logout',
          entityType: 'session',
          entityId: activeTeammate.id,
          entityTitle: `Signed out ${activeTeammate.name}`
        })
      );
    }
    clearSessionId();
    if (supabase) await supabase.auth.signOut();
    showToast('Logged out.');
  };

  const handleSaveTeamMember = (member: TeamMember) => {
    setTeamMembers((prev) => {
      const exists = prev.some((m) => m.id === member.id);
      return exists ? prev.map((m) => (m.id === member.id ? member : m)) : [...prev, member];
    });
    upsertRemoteTeamMember(member);
  };

  const handleRemoveTeamMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    removeTeamMemberAccount(id);
  };

  return {
    teamMembers,
    setTeamMembers,
    session,
    authChecked,
    mustSetPassword,
    setMustSetPassword,
    activeTeammate,
    noProfileMatch,
    handleLogout,
    handleSaveTeamMember,
    handleRemoveTeamMember
  };
}
