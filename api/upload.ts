import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const { fileName, base64Data, mimeType } = req.body ?? {};
    if (!base64Data) {
      return res.status(400).json({ status: 'error', message: 'Missing base64Data in payload' });
    }

    const dataUrl = base64Data.startsWith('data:')
      ? base64Data
      : `data:${mimeType || 'image/png'};base64,${base64Data}`;

    res.json({
      status: 'success',
      message: 'File uploaded successfully',
      fileName: fileName || 'upload.png',
      url: dataUrl,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
