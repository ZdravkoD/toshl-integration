import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Delete all processed transactions
    const result = await collection.deleteMany({ processed: true });

    return res.status(200).json({ 
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} processed transaction(s)`
    });
  } catch (error) {
    console.error('Error clearing processed transactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
