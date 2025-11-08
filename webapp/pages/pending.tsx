import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

interface PendingTransaction {
  _id: string;
  store_name: string;
  amount: number;
  currency: string;
  date: string;
  email_id: string;
  created_at: string;
}

export default function PendingPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  const fetchPendingTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/getPending');
      const data = await response.json();
      
      if (response.ok) {
        setTransactions(data.documents || []);
      } else {
        setError(data.error || 'Failed to fetch pending transactions');
      }
    } catch (err) {
      setError('Network error: Failed to fetch pending transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = (storeName: string) => {
    router.push(`/mappings?store=${encodeURIComponent(storeName)}`);
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Pending Transactions</h1>
          <p className={styles.subtitle}>
            Add category mappings for these stores to process transactions
          </p>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navButton} onClick={() => router.push('/')}>
            ← Back to Dashboard
          </button>
          <button 
            className={styles.navButton}
            onClick={fetchPendingTransactions}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </nav>

        {error && (
          <div className={`${styles.message} ${styles.error}`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`${styles.message} ${styles.success}`}>
            {success}
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Pending Transactions ({transactions.length})
          </h2>

          {loading ? (
            <div className={styles.loading}>Loading pending transactions...</div>
          ) : transactions.length === 0 ? (
            <div className={styles.emptyState}>
              No pending transactions! All stores have been mapped. 🎉
            </div>
          ) : (
            <div>
              {transactions.map((transaction) => (
                <div key={transaction._id} className={styles.transaction}>
                  <div className={styles.transactionHeader}>
                    <div className={styles.storeName}>{transaction.store_name}</div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  <div className={styles.transactionDetails}>
                    Date: {transaction.date} | Created: {new Date(transaction.created_at).toLocaleString()}
                  </div>
                  <button 
                    className={styles.button}
                    onClick={() => handleAddMapping(transaction.store_name)}
                    style={{ marginTop: '0.75rem', width: '100%' }}
                  >
                    Add Category Mapping
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.card} ${styles.message} ${styles.info}`}>
          <strong>How it works:</strong>
          <ol style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>Click "Add Category Mapping" for a store</li>
            <li>Select the appropriate Toshl category</li>
            <li>The Google Apps Script will automatically reprocess this transaction</li>
            <li>Future transactions from this store will be automatically categorized</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
