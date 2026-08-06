import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    status: 'ok',
    server: 'Pharmacozyme Vercel Function',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
}
