import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();

    // Get categories sorted by usage count (descending)
    const categories = await db
      .collection('toshl_categories')
      .find({})
      .sort({ usage_count: -1 })
      .limit(20) // Get top 20 most used categories
      .toArray();

    // Return just the category names
    const categoryNames = categories.map(cat => cat.name);

    res.status(200).json({
      categories: categoryNames,
      count: categoryNames.length
    });
  } catch (error) {
    console.error('Error fetching common categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
