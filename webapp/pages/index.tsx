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
  has_mapping?: boolean;
  processed?: boolean;
}

interface SyncResourceState {
  resource: string;
  last_successful_to?: string;
  last_successful_from?: string;
  updated_at?: string;
}

interface SyncStatusResponse {
  resources: SyncResourceState[];
  active_sync: boolean;
}

export default function Home() {
  const router = useRouter();
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [syncStartDate, setSyncStartDate] = useState('2025-01-01');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter transactions that need action (no mapping and not processed)
  const transactionsNeedingAction = pendingTransactions.filter(
    t => !t.has_mapping && !t.processed
  );

  useEffect(() => {
    fetchPendingTransactions();
    fetchSyncStatus();
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

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/syncStatus');
      const data = await response.json();

      if (response.ok) {
        setSyncStatus(data);
      } else {
        setSyncError(data.error || 'Failed to fetch sync status');
      }
    } catch (_err) {
      setSyncError('Network error: Failed to fetch sync status');
    }
  };

  const runToshlSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    setSyncError('');

    try {
      const response = await fetch('/api/syncToshl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start_date: syncStartDate
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setSyncError(data.error || 'Failed to sync Toshl data');
        return;
      }

      const entryResource = (data.resources || []).find((resource: { resource: string }) => resource.resource === 'entries');
      setSyncMessage(
        entryResource
          ? `Sync completed. Entries fetched: ${entryResource.fetched}, updated: ${entryResource.modified + entryResource.upserted}, deleted: ${entryResource.deleted}.`
          : 'Sync completed successfully.'
      );

      await fetchSyncStatus();
    } catch (_err) {
      setSyncError('Network error: Failed to sync Toshl data');
    } finally {
      setSyncing(false);
    }
  };

  const lastEntriesSync = syncStatus?.resources?.find(resource => resource.resource === 'entries');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Toshl Integration</h1>
          <p className={styles.subtitle}>Manage store categories and pending transactions</p>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navButton} onClick={() => router.push('/pending')}>
            Pending Transactions ({transactionsNeedingAction.length})
          </button>
          <button className={`${styles.navButton} ${styles.secondary}`} onClick={() => router.push('/mappings')}>
            + Add Mapping
          </button>
          <button className={`${styles.navButton} ${styles.secondary}`} onClick={() => router.push('/merchants')}>
            Manage Mappings
          </button>
          <button className={`${styles.navButton} ${styles.secondary}`} onClick={() => router.push('/reports')}>
            Reports
          </button>
        </nav>

        {/* Only show if there are transactions needing action */}
        {!loading && transactionsNeedingAction.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Recent Pending Transactions</h2>

            {error && (
              <div className={`${styles.message} ${styles.error}`}>
                {error}
              </div>
            )}

            <div>
              {transactionsNeedingAction.slice(0, 5).map((transaction) => (
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
              
              {transactionsNeedingAction.length > 5 && (
                <button 
                  className={styles.button}
                  onClick={() => router.push('/pending')}
                  style={{ marginTop: '1rem' }}
                >
                  View All {transactionsNeedingAction.length} Pending Transactions
                </button>
              )}
            </div>
          </div>
        )}

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
              onClick={() => router.push('/merchants')}
            >
              Manage Existing Mappings
            </button>
            <button 
              className={styles.button}
              onClick={fetchPendingTransactions}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Pending'}
            </button>
            <button
              className={styles.button}
              onClick={() => router.push('/reports')}
            >
              Open Reports
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Toshl Mirror Sync</h2>

          {syncMessage && (
            <div className={`${styles.message} ${styles.success}`}>
              {syncMessage}
            </div>
          )}

          {syncError && (
            <div className={`${styles.message} ${styles.error}`}>
              {syncError}
            </div>
          )}

          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="sync-start-date">
                Backfill Start Date
              </label>
              <input
                id="sync-start-date"
                className={styles.input}
                type="date"
                value={syncStartDate}
                onChange={(event) => setSyncStartDate(event.target.value)}
              />
            </div>

            <div className={styles.syncMeta}>
              <div>
                Active sync: <strong>{syncStatus?.active_sync ? 'Yes' : 'No'}</strong>
              </div>
              <div>
                Last entry sync window:{' '}
                <strong>
                  {lastEntriesSync?.last_successful_from && lastEntriesSync?.last_successful_to
                    ? `${lastEntriesSync.last_successful_from} to ${lastEntriesSync.last_successful_to}`
                    : 'Not synced yet'}
                </strong>
              </div>
            </div>

            <button
              className={styles.button}
              onClick={runToshlSync}
              disabled={syncing || syncStatus?.active_sync}
            >
              {syncing ? 'Syncing...' : 'Sync Toshl Mirror'}
            </button>

            <button
              className={styles.button}
              onClick={fetchSyncStatus}
              disabled={syncing}
            >
              Refresh Sync Status
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
