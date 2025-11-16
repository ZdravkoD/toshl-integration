import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle GET (list), POST (add), PUT (update), DELETE (remove)
  if (req.method === 'GET') {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('merchants');

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
      const { store_name, category, tags } = req.body;

      if (!store_name || !category) {
        return res.status(400).json({ 
          error: 'Missing required fields: store_name, category' 
        });
      }

      const { db } = await connectToDatabase();
      const collection = db.collection('merchants');

      // Prepare update data
      const updateData: any = {
        store_name,
        category,
        updated_at: new Date()
      };

      // Add tags if provided
      if (tags && Array.isArray(tags) && tags.length > 0) {
        updateData.tags = tags;
      }

      // Upsert - update if exists, insert if not
      const result = await collection.updateOne(
        { store_name },
        { $set: updateData },
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
  } else if (req.method === 'PUT') {
    // Update existing mapping
    try {
      const { _id, category, tags } = req.body;

      if (!_id) {
        return res.status(400).json({ 
          error: 'Missing required field: _id' 
        });
      }

      if (!category) {
        return res.status(400).json({ 
          error: 'Missing required field: category' 
        });
      }

      const { db } = await connectToDatabase();
      const collection = db.collection('merchants');

      // Prepare update data
      const updateData: any = {
        category,
        updated_at: new Date()
      };

      // Update tags if provided (can be empty array to clear tags)
      if (tags !== undefined && Array.isArray(tags)) {
        if (tags.length > 0) {
          updateData.tags = tags;
        } else {
          // If empty array provided, remove tags field
          await collection.updateOne(
            { _id: new ObjectId(_id) },
            { 
              $set: { category, updated_at: new Date() },
              $unset: { tags: "" }
            }
          );
          return res.status(200).json({ 
            success: true,
            message: 'Mapping updated (tags removed)'
          });
        }
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(_id) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Mapping not found' });
      }

      return res.status(200).json({ 
        success: true,
        modified: result.modifiedCount > 0,
        message: 'Mapping updated successfully'
      });
    } catch (error) {
      console.error('Error updating mapping:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    // Delete mapping
    try {
      const { _id } = req.body;

      if (!_id) {
        return res.status(400).json({ 
          error: 'Missing required field: _id' 
        });
      }

      const { db } = await connectToDatabase();
      const collection = db.collection('merchants');

      const result = await collection.deleteOne({ 
        _id: new ObjectId(_id) 
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Mapping not found' });
      }

      return res.status(200).json({ 
        success: true,
        message: 'Mapping deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting mapping:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
