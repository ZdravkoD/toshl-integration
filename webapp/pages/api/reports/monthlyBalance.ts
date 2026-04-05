import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../lib/mongodb';
import { getMonthlyBalanceReport } from '../../../lib/toshlSync';

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
    const report = await getMonthlyBalanceReport(db, { from, to });

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error building monthly balance report:', error);
    return res.status(500).json({
      error: 'Failed to build monthly balance report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
