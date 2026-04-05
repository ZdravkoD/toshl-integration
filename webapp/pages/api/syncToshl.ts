import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';
import { syncToshlMirror } from '../../lib/toshlSync';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const startDate = typeof req.body?.start_date === 'string' ? req.body.start_date : undefined;
    const endDate = typeof req.body?.end_date === 'string' ? req.body.end_date : undefined;
    const reconcileDays = typeof req.body?.reconcile_days === 'number'
      ? req.body.reconcile_days
      : undefined;

    const result = await syncToshlMirror(db, {
      startDate,
      endDate,
      reconcileDays
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error syncing Toshl mirror:', error);
    return res.status(500).json({
      error: 'Failed to sync Toshl mirror',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

