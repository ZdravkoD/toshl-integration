import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Get all unprocessed pending transactions
    const documents = await collection
      .find({ processed: false })
      .sort({ created_at: -1 })
      .toArray();

    // Convert ObjectId to string for JSON serialization
    const serializedDocs = documents.map(doc => ({
      ...doc,
      _id: doc._id.toString()
    }));

    return res.status(200).json({ documents: serializedDocs });
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
