import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Invalid tags data' });
    }

    const { db } = await connectToDatabase();

    // Clear existing tags and insert new ones
    const collection = db.collection('toshl_tags');
    
    // Delete all existing tags
    await collection.deleteMany({});
    
    // Insert tags with timestamps
    const tagsWithTimestamp = tags.map(tag => ({
      ...tag,
      synced_at: new Date()
    }));
    
    const result = await collection.insertMany(tagsWithTimestamp);

    console.log(`Synced ${result.insertedCount} Toshl tags to MongoDB`);

    res.status(200).json({
      success: true,
      count: result.insertedCount,
      message: `Synced ${result.insertedCount} tags`
    });
  } catch (error) {
    console.error('Error syncing tags:', error);
    res.status(500).json({ 
      error: 'Failed to sync tags',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
