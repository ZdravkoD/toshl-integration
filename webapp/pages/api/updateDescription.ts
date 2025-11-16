import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, description } = req.body;

    if (!id || description === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: id, description' 
      });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Update the description
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          description: description.trim(),
          description_added_at: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Description updated successfully'
    });

  } catch (error) {
    console.error('Error updating description:', error);
    return res.status(500).json({ 
      error: 'Failed to update description',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
