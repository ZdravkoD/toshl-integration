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
    const { message_id } = req.query;

    if (!message_id || typeof message_id !== 'string') {
      return res.status(400).json({ error: 'message_id parameter is required' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('processed_messages');
    await collection.createIndex({ message_id: 1 }, { unique: true });

    const document = await collection.findOne({ message_id });

    return res.status(200).json({
      exists: !!document,
      document
    });
  } catch (error) {
    console.error('Error fetching processed message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
