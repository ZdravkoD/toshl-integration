import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const [resources, activeLock] = await Promise.all([
      db.collection('sync_state')
        .find({})
        .sort({ resource: 1 })
        .toArray(),
      db.collection('sync_locks').findOne({
        key: 'toshl-full-sync',
        expires_at: { $gt: now }
      })
    ]);

    return res.status(200).json({
      resources,
      active_sync: Boolean(activeLock)
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return res.status(500).json({
      error: 'Failed to fetch sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
