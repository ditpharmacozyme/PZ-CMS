import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const { scriptUrl, payload } = req.body ?? {};
    if (!scriptUrl) {
      return res.status(400).json({ status: 'error', message: 'Missing Google Apps Script URL' });
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
