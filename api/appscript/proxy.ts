import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Only ever relay to a real Google Apps Script web app -- without this, an
// authenticated-but-malicious caller could still point this server at an
// arbitrary internal or external URL and read back the response.
const ALLOWED_SCRIPT_URL_PREFIX = 'https://script.google.com/macros/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  // Require a real Supabase session before relaying anything. Before this,
  // the proxy was a public open relay: any unauthenticated request on the
  // internet could make this server fetch a caller-chosen URL (SSRF). Fails
  // closed (matches api/team/*.ts) rather than skipping auth if these are
  // somehow unset -- an unauthenticated open relay is worse than a 500.
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ status: 'error', message: 'Server is missing required Supabase environment variables.' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Missing Authorization header.' });
  }
  const verifyClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired session.' });
  }

  try {
    const { scriptUrl: clientScriptUrl, payload } = req.body ?? {};

    // ── Direct Brevo Transactional Email Option ──────────────────────────────
    if (payload?.action === 'sendEmailReminder' && process.env.BREVO_API_KEY) {
      const post = payload.post || {};
      const recipient = payload.recipientEmail || post.reminderEmail || '';
      const brandName = post.brandId || 'Pharmacozyme';
      const platform = post.platform || 'Instagram';
      const scheduledTime = post.scheduledTime || '10:00';
      const scheduledDate = post.scheduledDate || 'Today';

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #bfcab4; border-radius: 8px; overflow: hidden;">
          <div style="background: #1b1c1a; padding: 20px 24px; color: #ffffff;">
            <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #78d24b; margin: 0 0 4px 0; font-weight: 700;">Pharmacozyme Brand-Ops</p>
            <h1 style="font-size: 18px; margin: 0; color: #ffffff;">Scheduled Post Cue: ${post.title || 'Untitled Post'}</h1>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 13px; color: #404a39; margin: 0 0 16px 0;">This is your scheduled cue to post on <strong>${platform}</strong> for <strong>${brandName}</strong>.</p>
            <div style="background: #faf9f5; border: 1px solid #bfcab4; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #707a67; text-transform: uppercase; font-weight: 700;">Scheduled Time: <strong style="color: #1b1c1a;">${scheduledDate} at ${scheduledTime}</strong></p>
              <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1b1c1a;">${post.title || ''}</p>
              <div style="font-size: 12px; color: #1b1c1a; white-space: pre-wrap; background: #ffffff; padding: 12px; border: 1px solid #e5e4de; border-radius: 4px;">${post.caption || 'No caption entered.'}</div>
            </div>
            ${post.visualUrl ? `<div style="margin-bottom: 20px;"><img src="${post.visualUrl}" style="max-width: 100%; border-radius: 6px; border: 1px solid #bfcab4;" /></div>` : ''}
            <p style="font-size: 11px; color: #707a67; margin: 20px 0 0 0;">Sent via Pharmacozyme Brand-Ops Studio • Verified Brevo Mailer</p>
          </div>
        </div>
      `;

      const recipients = recipient
        .split(',')
        .map((e: string) => ({ email: e.trim() }))
        .filter((r: { email: string }) => Boolean(r.email));

      if (recipients.length > 0) {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'Pharmacozyme Brand-Ops', email: 'notifications@cms.pharmacozyme.com' },
            to: recipients,
            subject: `[Cue Reminder] Post on ${platform} for ${brandName}: "${post.title || 'Untitled'}"`,
            htmlContent
          })
        });

        const brevoData = await brevoRes.json();
        if (brevoRes.ok) {
          return res.json({
            status: 'success',
            data: { status: 'success', message: 'Email sent via Brevo', messageId: brevoData.messageId }
          });
        }
      }
    }

    // A caller-supplied scriptUrl is only meant for the Integrations tab's
    // "test my deployment" flow (a candidate URL not yet promoted to the
    // shared env var). Everyone else omits it and gets the shared one, so
    // ordinary uploads/emails work without every teammate pasting a URL.
    const scriptUrl = clientScriptUrl || process.env.APPS_SCRIPT_URL;
    if (!scriptUrl) {
      return res.status(400).json({ status: 'error', message: 'No Google Apps Script URL configured. An Owner needs to set APPS_SCRIPT_URL, or paste one to test in Integrations.' });
    }
    if (!scriptUrl.startsWith(ALLOWED_SCRIPT_URL_PREFIX)) {
      return res.status(400).json({ status: 'error', message: `scriptUrl must start with ${ALLOWED_SCRIPT_URL_PREFIX}` });
    }

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {}),
      redirect: 'follow'
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { text: responseText };
    }

    res.json({
      status: 'success',
      proxyStatus: response.status,
      data: responseData
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
