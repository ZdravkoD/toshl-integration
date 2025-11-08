import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { categories } = req.body;

    if (!categories || !Array.isArray(categories)) {
      return res.status(400).json({ error: 'Invalid categories data' });
    }

    const { db } = await connectToDatabase();

    // Clear existing categories and insert new ones
    const collection = db.collection('toshl_categories');
    
    // Delete all existing categories
    await collection.deleteMany({});
    
    // Insert categories with timestamps
    const categoriesWithTimestamp = categories.map(cat => ({
      ...cat,
      synced_at: new Date()
    }));
    
    const result = await collection.insertMany(categoriesWithTimestamp);

    console.log(`Synced ${result.insertedCount} Toshl categories to MongoDB`);

    res.status(200).json({
      success: true,
      count: result.insertedCount,
      message: `Synced ${result.insertedCount} categories`
    });
  } catch (error) {
    console.error('Error syncing categories:', error);
    res.status(500).json({ 
      error: 'Failed to sync categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
