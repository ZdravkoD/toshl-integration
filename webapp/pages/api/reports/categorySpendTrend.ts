import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../lib/mongodb';
import { getCategorySpendTrendReport } from '../../../lib/toshlSync';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const report = await getCategorySpendTrendReport(db, { from, to, limit });

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error building category spend trend report:', error);
    return res.status(500).json({
      error: 'Failed to build category spend trend report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
