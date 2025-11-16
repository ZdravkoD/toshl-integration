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
    const { id, category, tags } = req.body;

    if (!id || !category) {
      return res.status(400).json({ 
        error: 'Missing required fields: id, category' 
      });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Update the category and tags
    const updateData: any = {
      category: category.trim(),
      has_mapping: true,
      mapping_updated_at: new Date()
    };

    if (tags && Array.isArray(tags)) {
      updateData.tags = tags;
    } else {
      updateData.tags = [];
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Mapping updated successfully'
    });

  } catch (error) {
    console.error('Error updating pending mapping:', error);
    return res.status(500).json({ 
      error: 'Failed to update mapping',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
