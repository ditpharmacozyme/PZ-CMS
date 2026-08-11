import { AuditEvent } from '../types';
import { supabase } from '../lib/supabase';

const LOCAL_KEY = 'pharmacozyme_audit_log';
const SESSION_KEY = 'pharmacozyme_session_id';

/** Get or create a session ID for the current login session. */
export function getOrCreateSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/** Clear session ID on logout. */
export function clearSessionId(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/** Write an audit event to Supabase + localStorage fallback. */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  // Always write to localStorage as fast path / fallback
  try {
    const stored = getLocalAuditLog();
    // Keep at most 500 entries locally
    const updated = [event, ...stored].slice(0, 500);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  } catch {
    // Quota exceeded — ignore
  }

  // Also write to Supabase if configured
  if (!supabase) return;
  try {
    await supabase.from('audit_log').insert([{
      id: event.id,
      actor_id: event.actorId,
      actor_name: event.actorName,
      action_type: event.actionType,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      entity_title: event.entityTitle ?? null,
      before_value: event.beforeValue ?? null,
      after_value: event.afterValue ?? null,
      session_id: event.sessionId ?? null,
      created_at: event.timestamp
    }]);
  } catch {
    // Supabase unavailable — localStorage already has it
  }
}

/** Get audit events from Supabase with localStorage fallback. */
export async function getAuditLog(limit = 200): Promise<AuditEvent[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data.map(rowToEvent);
      }
    } catch {
      // fall through to localStorage
    }
  }
  return getLocalAuditLog().slice(0, limit);
}

function getLocalAuditLog(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditEvent[];
  } catch {
    return [];
  }
}

function rowToEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: row.id as string,
    actorId: (row.actor_id as string) ?? '',
    actorName: (row.actor_name as string) ?? '',
    actionType: row.action_type as AuditEvent['actionType'],
    entityType: row.entity_type as AuditEvent['entityType'],
    entityId: (row.entity_id as string) ?? undefined,
    entityTitle: (row.entity_title as string) ?? undefined,
    beforeValue: row.before_value as Record<string, unknown> ?? undefined,
    afterValue: row.after_value as Record<string, unknown> ?? undefined,
    sessionId: (row.session_id as string) ?? undefined,
    timestamp: (row.created_at as string) ?? ''
  };
}

/** Build an AuditEvent stub with common fields pre-filled. */
export function buildAuditEvent(
  partial: Omit<AuditEvent, 'id' | 'sessionId' | 'timestamp'>
): AuditEvent {
  return {
    ...partial,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId: getOrCreateSessionId(),
    timestamp: new Date().toISOString()
  };
}
