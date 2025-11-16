import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'id parameter is required' });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Delete the specific pending transaction
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Pending transaction not found' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Pending transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting pending transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
