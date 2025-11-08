import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { store_name, amount, currency, date, email_id } = req.body;

    if (!store_name || !amount || !currency || !date || !email_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: store_name, amount, currency, date, email_id' 
      });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Save the pending transaction
    const result = await collection.insertOne({
      store_name,
      amount: parseFloat(amount),
      currency,
      date,
      email_id,
      created_at: new Date(),
      processed: false
    });

    return res.status(200).json({ 
      success: true, 
      insertedId: result.insertedId.toString() 
    });
  } catch (error) {
    console.error('Error saving pending transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
