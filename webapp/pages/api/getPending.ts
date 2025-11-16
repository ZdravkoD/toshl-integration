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
    const { db } = await connectToDatabase();
    const pendingCollection = db.collection('pending_transactions');
    const merchantsCollection = db.collection('merchants');

    // Get all pending transactions (both processed and unprocessed)
    const allPending = await pendingCollection
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    // Get all merchant mappings
    const merchants = await merchantsCollection.find({}).toArray();
    const merchantMap = new Map(merchants.map(m => [m.store_name, m]));

    // Categorize transactions and add mapping info
    const categorized = allPending.map(doc => {
      const hasMapping = merchantMap.has(doc.store_name);
      const mapping = hasMapping ? merchantMap.get(doc.store_name) : null;
      return {
        ...doc,
        _id: doc._id.toString(),
        has_mapping: hasMapping,
        category: mapping?.category || null,
        tags: mapping?.tags || null
      };
    });

    return res.status(200).json({ documents: categorized });
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
