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
  processed: boolean;
  has_mapping: boolean;
  category?: string;
  tags?: string[];
}

export default function PendingPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deduplicating, setDeduplicating] = useState(false);

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

  const handleClearProcessed = async () => {
    if (!confirm('Are you sure you want to clear all processed transactions? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/clearProcessed', {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Processed transactions cleared');
        fetchPendingTransactions();
      } else {
        setError(data.error || 'Failed to clear processed transactions');
      }
    } catch (err) {
      setError('Network error: Failed to clear processed transactions');
    }
  };

  const handleDeletePending = async (id: string, storeName: string) => {
    if (!confirm(`Are you sure you want to delete the pending transaction for "${storeName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/deletePending?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(`Deleted pending transaction for "${storeName}"`);
        fetchPendingTransactions();
      } else {
        setError(data.error || 'Failed to delete pending transaction');
      }
    } catch (err) {
      setError('Network error: Failed to delete pending transaction');
    }
  };

  const handleDeduplicate = async () => {
    if (!confirm('Are you sure you want to remove duplicate pending transactions? This will keep the oldest occurrence of each duplicate and remove the rest.')) {
      return;
    }

    setDeduplicating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/deduplicatePending', {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || `Removed ${data.deletedCount} duplicate(s)`);
        fetchPendingTransactions();
      } else {
        setError(data.error || 'Failed to deduplicate pending transactions');
      }
    } catch (err) {
      setError('Network error: Failed to deduplicate pending transactions');
    } finally {
      setDeduplicating(false);
    }
  };

  // Categorize transactions
  const notProcessedNoMapping = transactions.filter(t => !t.processed && !t.has_mapping);
  const notProcessedHasMapping = transactions.filter(t => !t.processed && t.has_mapping);
  const processedTransactions = transactions.filter(t => t.processed).slice(0, 5);

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
          <button className={styles.navButton} onClick={() => router.push('/merchants')}>
            Manage Mappings
          </button>
          <button 
            className={styles.navButton}
            onClick={fetchPendingTransactions}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            className={styles.navButton}
            onClick={handleDeduplicate}
            disabled={deduplicating || loading}
            style={{
              backgroundColor: deduplicating ? '#ccc' : '#9c27b0',
              cursor: deduplicating || loading ? 'not-allowed' : 'pointer'
            }}
          >
            {deduplicating ? 'Deduplicating...' : '🔄 Remove Duplicates'}
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

        {/* Section 1: Not Processed & No Mapping - ACTION REQUIRED */}
        <div className={styles.card} style={{ borderLeft: '4px solid #f44336' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className={styles.cardTitle}>
              ⚠️ Action Required - No Category Mapping ({notProcessedNoMapping.length})
            </h2>
          </div>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
            These transactions need category mappings before they can be processed.
          </p>

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : notProcessedNoMapping.length === 0 ? (
            <div className={styles.emptyState}>
              ✓ All transactions have category mappings!
            </div>
          ) : (
            <div>
              {notProcessedNoMapping.map((transaction) => (
                <div key={transaction._id} className={styles.transaction} style={{ borderLeft: '3px solid #f44336' }}>
                  <div className={styles.transactionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#ffebee',
                        color: '#c62828',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        NO MAPPING
                      </span>
                      <div className={styles.storeName}>{transaction.store_name}</div>
                    </div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  <div className={styles.transactionDetails}>
                    Date: {transaction.date} | Created: {new Date(transaction.created_at).toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '0.75rem' }}>
                    <button 
                      className={styles.button}
                      onClick={() => handleAddMapping(transaction.store_name)}
                      style={{ flex: 1, backgroundColor: '#f44336' }}
                    >
                      Add Category Mapping
                    </button>
                    <button 
                      onClick={() => handleDeletePending(transaction._id, transaction.store_name)}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#757575',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '14px'
                      }}
                      title="Delete this pending transaction"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Not Processed & Has Mapping - WAITING */}
        <div className={styles.card} style={{ borderLeft: '4px solid #ff9800' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className={styles.cardTitle}>
              ⏳ Waiting for Processing ({notProcessedHasMapping.length})
            </h2>
          </div>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
            These transactions have mappings and will be processed by the Google Apps Script (runs hourly).
          </p>

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : notProcessedHasMapping.length === 0 ? (
            <div className={styles.emptyState}>
              No transactions waiting for processing.
            </div>
          ) : (
            <div>
              {notProcessedHasMapping.map((transaction) => (
                <div key={transaction._id} className={styles.transaction} style={{ borderLeft: '3px solid #ff9800' }}>
                  <div className={styles.transactionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#fff3e0',
                        color: '#e65100',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        WAITING
                      </span>
                      <div className={styles.storeName}>{transaction.store_name}</div>
                    </div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 10px',
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #90caf9',
                      borderRadius: '16px',
                      fontSize: '13px',
                      color: '#1976d2',
                      fontWeight: 500
                    }}>
                      → {transaction.category}
                    </span>
                    {transaction.tags && transaction.tags.length > 0 && (
                      transaction.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#f3e5f5',
                            border: '1px solid #ce93d8',
                            borderRadius: '16px',
                            fontSize: '12px',
                            color: '#6a1b9a'
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                  <div className={styles.transactionDetails}>
                    Date: {transaction.date} | Created: {new Date(transaction.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Processed - HISTORY */}
        <div className={styles.card} style={{ borderLeft: '4px solid #4caf50' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className={styles.cardTitle}>
              ✓ Processed (Latest 5 of {transactions.filter(t => t.processed).length})
            </h2>
            {processedTransactions.length > 0 && (
              <button
                onClick={handleClearProcessed}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e57373',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Clear All Processed
              </button>
            )}
          </div>
          <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
            These transactions have been successfully processed and sent to Toshl.
          </p>

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : processedTransactions.length === 0 ? (
            <div className={styles.emptyState}>
              No processed transactions yet.
            </div>
          ) : (
            <div>
              {processedTransactions.map((transaction) => (
                <div key={transaction._id} className={styles.transaction} style={{ borderLeft: '3px solid #4caf50', opacity: 0.8 }}>
                  <div className={styles.transactionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#e8f5e9',
                        color: '#2e7d32',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        PROCESSED ✓
                      </span>
                      <div className={styles.storeName}>{transaction.store_name}</div>
                    </div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 10px',
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #90caf9',
                      borderRadius: '16px',
                      fontSize: '13px',
                      color: '#1976d2',
                      fontWeight: 500
                    }}>
                      → {transaction.category}
                    </span>
                    {transaction.tags && transaction.tags.length > 0 && (
                      transaction.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#f3e5f5',
                            border: '1px solid #ce93d8',
                            borderRadius: '16px',
                            fontSize: '12px',
                            color: '#6a1b9a'
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                  <div className={styles.transactionDetails}>
                    Date: {transaction.date} | Created: {new Date(transaction.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.card} ${styles.message} ${styles.info}`}>
          <strong>How it works:</strong>
          <ol style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>Add category mappings for transactions with <span style={{ color: '#f44336', fontWeight: 'bold' }}>NO MAPPING</span></li>
            <li>Once mapped, transactions move to <span style={{ color: '#ff9800', fontWeight: 'bold' }}>WAITING</span> status</li>
            <li>Google Apps Script automatically processes waiting transactions every hour</li>
            <li><span style={{ color: '#4caf50', fontWeight: 'bold' }}>PROCESSED</span> transactions are sent to Toshl Finance</li>
            <li>Clear processed transactions when you want to clean up the history</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
