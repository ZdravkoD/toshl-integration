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

export default function Home() {
  const router = useRouter();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        setPendingTransactions(data.documents || []);
      } else {
        setError(data.error || 'Failed to fetch pending transactions');
      }
    } catch (err) {
      setError('Network error: Failed to fetch pending transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Toshl Integration</h1>
          <p className={styles.subtitle}>Manage store categories and pending transactions</p>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navButton} onClick={() => router.push('/pending')}>
            Pending Transactions ({pendingTransactions.length})
          </button>
          <button className={`${styles.navButton} ${styles.secondary}`} onClick={() => router.push('/mappings')}>
            Store Mappings
          </button>
        </nav>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Recent Pending Transactions</h2>

          {error && (
            <div className={`${styles.message} ${styles.error}`}>
              {error}
            </div>
          )}

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : pendingTransactions.length === 0 ? (
            <div className={styles.emptyState}>
              No pending transactions. All caught up! 🎉
            </div>
          ) : (
            <div>
              {pendingTransactions.slice(0, 5).map((transaction) => (
                <div key={transaction._id} className={styles.transaction}>
                  <div className={styles.transactionHeader}>
                    <div className={styles.storeName}>{transaction.store_name}</div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  <div className={styles.transactionDetails}>
                    Date: {transaction.date}
                  </div>
                  <div className={styles.transactionDetails}>
                    Created: {new Date(transaction.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              
              {pendingTransactions.length > 5 && (
                <button 
                  className={styles.button}
                  onClick={() => router.push('/pending')}
                  style={{ marginTop: '1rem' }}
                >
                  View All {pendingTransactions.length} Pending Transactions
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              className={styles.button}
              onClick={() => router.push('/mappings')}
            >
              Add New Store Mapping
            </button>
            <button 
              className={styles.button}
              onClick={fetchPendingTransactions}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Pending'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
