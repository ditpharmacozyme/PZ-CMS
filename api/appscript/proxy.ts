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
