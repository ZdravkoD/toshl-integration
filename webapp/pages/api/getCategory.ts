import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { store_name } = req.query;

    if (!store_name || typeof store_name !== 'string') {
      return res.status(400).json({ error: 'store_name parameter is required' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('store_collections');

    // Look up the category for this store
    const mapping = await collection.findOne({ store_name });

    if (mapping && mapping.category) {
      return res.status(200).json({ category: mapping.category });
    } else {
      return res.status(200).json({ category: null });
    }
  } catch (error) {
    console.error('Error fetching category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
