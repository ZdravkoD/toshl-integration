import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      message_id,
      thread_id,
      subject,
      status,
      transaction_date,
      store_name,
      amount,
      toshl_entry_id
    } = req.body;

    if (!message_id) {
      return res.status(400).json({ error: 'message_id is required' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('processed_messages');
    await collection.createIndex({ message_id: 1 }, { unique: true });

    const result = await collection.updateOne(
      { message_id },
      {
        $set: {
          thread_id: thread_id || null,
          subject: subject || null,
          status: status || 'processed',
          transaction_date: transaction_date || null,
          store_name: store_name || null,
          amount: typeof amount === 'number' ? amount : null,
          toshl_entry_id: toshl_entry_id || null,
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      upserted: result.upsertedCount > 0,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });
  } catch (error) {
    console.error('Error saving processed message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
