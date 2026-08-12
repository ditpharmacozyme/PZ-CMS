import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function errorResponse(res: VercelResponse, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return res.status(status).json({ status: 'error', code, message, ...extra });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return errorResponse(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(res, 500, 'SERVER_NOT_CONFIGURED', 'Server is missing required Supabase environment variables.');
  }

  // Verification client (anon key) -- validates the caller's JWT server-side.
  const verifyClient = createClient(supabaseUrl, anonKey);
  // Privileged client (service-role key) -- bypasses RLS entirely. Never
  // exposed to the browser; only this function ever holds this key.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) {
      return errorResponse(res, 401, 'UNAUTHENTICATED', 'Missing Authorization header.');
    }

    const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return errorResponse(res, 401, 'UNAUTHENTICATED', 'Invalid or expired session.');
    }

    const { data: callerRow, error: callerError } = await adminClient
      .from('team_members')
      .select('user_role')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (callerError) {
      return errorResponse(res, 500, 'CALLER_LOOKUP_FAILED', callerError.message);
    }
    if (!callerRow || callerRow.user_role !== 'Owner') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only the Owner can remove team members.');
    }

    const { id } = req.body ?? {};
    if (typeof id !== 'string' || !id.trim()) {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Missing or invalid id.');
    }

    const { data: targetRow, error: targetError } = await adminClient
      .from('team_members')
      .select('id, user_role, auth_user_id')
      .eq('id', id)
      .maybeSingle();
    if (targetError) {
      return errorResponse(res, 500, 'MEMBER_LOOKUP_FAILED', targetError.message);
    }
    if (!targetRow) {
      return errorResponse(res, 404, 'MEMBER_NOT_FOUND', 'No team member with this id.');
    }
    if (targetRow.user_role === 'Owner') {
      return errorResponse(res, 403, 'CANNOT_REMOVE_OWNER', 'Owners cannot be removed.');
    }

    // Revoke the Auth account (and any live session) before touching the
    // profile row -- if this fails, abort with nothing changed so it's safe
    // to retry, rather than leaving an orphaned Auth account like before.
    if (targetRow.auth_user_id) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetRow.auth_user_id);
      if (authDeleteError) {
        return errorResponse(res, 500, 'AUTH_DELETE_FAILED', authDeleteError.message);
      }
    }

    const { error: deleteError } = await adminClient.from('team_members').delete().eq('id', id);
    if (deleteError) {
      return errorResponse(res, 500, 'PROFILE_DELETE_FAILED_MANUAL_CLEANUP', `The Auth account was revoked, but removing the team_members row failed (${deleteError.message}). Contact an admin to remove team_members id ${id} manually.`, {
        orphanedTeamMemberId: id
      });
    }

    return res.status(200).json({ status: 'success' });
  } catch (err: any) {
    return errorResponse(res, 500, 'UNEXPECTED_ERROR', err?.message || 'Unexpected server error.');
  }
}
