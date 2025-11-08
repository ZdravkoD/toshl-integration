import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle both GET (list mappings) and POST (add mapping)
  if (req.method === 'GET') {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('store_collections');

      const mappings = await collection
        .find({})
        .sort({ store_name: 1 })
        .toArray();

      const serializedMappings = mappings.map(doc => ({
        ...doc,
        _id: doc._id.toString()
      }));

      return res.status(200).json({ mappings: serializedMappings });
    } catch (error) {
      console.error('Error fetching mappings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { store_name, category } = req.body;

      if (!store_name || !category) {
        return res.status(400).json({ 
          error: 'Missing required fields: store_name, category' 
        });
      }

      const { db } = await connectToDatabase();
      const collection = db.collection('store_collections');

      // Upsert - update if exists, insert if not
      const result = await collection.updateOne(
        { store_name },
        { $set: { store_name, category, updated_at: new Date() } },
        { upsert: true }
      );

      return res.status(200).json({ 
        success: true, 
        upsertedId: result.upsertedId?.toString(),
        modified: result.modifiedCount > 0
      });
    } catch (error) {
      console.error('Error adding mapping:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
