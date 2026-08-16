import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

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
    if (!callerRow || callerRow.user_role !== 'Admin') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only an Admin can create new team member accounts.');
    }

    const { name, email, role, color } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim() || typeof role !== 'string' || typeof color !== 'string') {
      return errorResponse(res, 400, 'INVALID_INPUT', 'Missing or invalid name, email, role, or color.');
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    const { data: existingMember, error: existingMemberError } = await adminClient
      .from('team_members')
      .select('id')
      .ilike('email', trimmedEmail)
      .maybeSingle();
    if (existingMemberError) {
      return errorResponse(res, 500, 'MEMBER_LOOKUP_FAILED', existingMemberError.message);
    }
    if (existingMember) {
      return errorResponse(res, 409, 'MEMBER_EXISTS', 'A team member with this email already exists.');
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const redirectTo = `${proto}://${req.headers.host}/`;

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(trimmedEmail, {
      redirectTo,
      data: { name: trimmedName }
    });
    if (inviteError || !inviteData?.user) {
      const alreadyRegistered = inviteError?.message?.toLowerCase().includes('already been registered') || inviteError?.message?.toLowerCase().includes('already registered');
      if (alreadyRegistered) {
        return errorResponse(res, 409, 'AUTH_EXISTS', 'This email already has a Supabase Auth account.');
      }
      return errorResponse(res, 500, 'AUTH_CREATE_FAILED', inviteError?.message || 'Failed to create the Auth account.');
    }

    const newMemberId = `tm-${Date.now()}`;
    const { error: insertError } = await adminClient.from('team_members').insert({
      id: newMemberId,
      name: trimmedName,
      role,
      user_role: 'Editor',
      email: trimmedEmail,
      avatar_initials: getInitials(trimmedName),
      color,
      auth_user_id: inviteData.user.id
    });

    if (insertError) {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(inviteData.user.id);
      if (rollbackError) {
        return errorResponse(res, 500, 'PROFILE_SAVE_FAILED_MANUAL_CLEANUP', `Account was created but the profile save failed, and rollback also failed. Contact an admin to remove auth user ${inviteData.user.id} (${trimmedEmail}) manually.`, {
          orphanedAuthUserId: inviteData.user.id,
          orphanedEmail: trimmedEmail
        });
      }
      return errorResponse(res, 500, 'PROFILE_SAVE_FAILED_ROLLED_BACK', `Failed to save the team member profile (${insertError.message}). No account was left behind -- safe to retry.`);
    }

    return res.status(200).json({
      status: 'success',
      teamMember: {
        id: newMemberId,
        name: trimmedName,
        role,
        userRole: 'Editor',
        email: trimmedEmail,
        avatarInitials: getInitials(trimmedName),
        color,
        authUserId: inviteData.user.id
      }
    });
  } catch (err: any) {
    return errorResponse(res, 500, 'UNEXPECTED_ERROR', err?.message || 'Unexpected server error.');
  }
}
