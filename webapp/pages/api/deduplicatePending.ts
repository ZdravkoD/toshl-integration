import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('pending_transactions');

    // Get all pending transactions
    const allTransactions = await collection.find({}).toArray();

    if (allTransactions.length === 0) {
      return res.status(200).json({ 
        success: true, 
        deletedCount: 0,
        message: 'No transactions to deduplicate'
      });
    }

    // Group by unique key (store_name, amount, currency, date)
    const transactionMap = new Map<string, any[]>();

    allTransactions.forEach((transaction: any) => {
      const key = `${transaction.store_name}|${transaction.amount}|${transaction.currency}|${transaction.date}`;
      
      if (!transactionMap.has(key)) {
        transactionMap.set(key, []);
      }
      
      transactionMap.get(key)!.push(transaction);
    });

    // Find duplicates (keep the oldest one, delete the rest)
    const idsToDelete: any[] = [];

    transactionMap.forEach((transactions) => {
      if (transactions.length > 1) {
        // Sort by created_at (oldest first)
        transactions.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateA - dateB;
        });

        // Keep the first (oldest) one, delete the rest
        for (let i = 1; i < transactions.length; i++) {
          idsToDelete.push(transactions[i]._id);
        }
      }
    });

    if (idsToDelete.length === 0) {
      return res.status(200).json({ 
        success: true, 
        deletedCount: 0,
        message: 'No duplicates found'
      });
    }

    // Delete duplicates
    const deleteResult = await collection.deleteMany({
      _id: { $in: idsToDelete }
    });

    return res.status(200).json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      message: `Removed ${deleteResult.deletedCount} duplicate transaction(s)`
    });

  } catch (error) {
    console.error('Error deduplicating pending transactions:', error);
    return res.status(500).json({ 
      error: 'Failed to deduplicate pending transactions',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
