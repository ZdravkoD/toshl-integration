import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();

    // Get tags sorted by usage count (descending)
    const tags = await db
      .collection('toshl_tags')
      .find({})
      .sort({ usage_count: -1 })
      .limit(20) // Get top 20 most used tags
      .toArray();

    // Return just the tag names
    const tagNames = tags.map(tag => tag.name);

    res.status(200).json({
      tags: tagNames,
      count: tagNames.length
    });
  } catch (error) {
    console.error('Error fetching common tags:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tags',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
