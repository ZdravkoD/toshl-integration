import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'id parameter is required' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Mark the transaction as processed
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { processed: true, processed_at: new Date() } }
    );

    return res.status(200).json({ 
      success: result.modifiedCount > 0,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking transaction as processed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
