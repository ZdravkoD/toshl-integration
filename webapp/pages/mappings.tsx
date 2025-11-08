import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

interface StoreMapping {
  _id: string;
  store_name: string;
  category: string;
  updated_at?: string;
}

export default function MappingsPage() {
  const router = useRouter();
  const { store } = router.query;
  
  const [mappings, setMappings] = useState<StoreMapping[]>([]);
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMappings();
  }, []);

  useEffect(() => {
    if (store && typeof store === 'string') {
      setStoreName(store);
    }
  }, [store]);

  const fetchMappings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/mappings');
      const data = await response.json();
      
      if (response.ok) {
        setMappings(data.mappings || []);
      } else {
        setError(data.error || 'Failed to fetch mappings');
      }
    } catch (err) {
      setError('Network error: Failed to fetch mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeName.trim() || !category.trim()) {
      setError('Both store name and category are required');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          store_name: storeName.trim(),
          category: category.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully added mapping for "${storeName}" → "${category}"`);
        setStoreName('');
        setCategory('');
        fetchMappings();
        
        // Redirect back to pending page if we came from there
        if (store) {
          setTimeout(() => router.push('/pending'), 1500);
        }
      } else {
        setError(data.error || 'Failed to add mapping');
      }
    } catch (err) {
      setError('Network error: Failed to add mapping');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Store Mappings</h1>
          <p className={styles.subtitle}>
            Map store names to Toshl Finance categories
          </p>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navButton} onClick={() => router.push('/')}>
            ← Back to Dashboard
          </button>
        </nav>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Add New Mapping</h2>

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

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="storeName">
                Store Name
              </label>
              <input
                id="storeName"
                type="text"
                className={styles.input}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g., MR. BRICOLAGE SOFIA 3"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="category">
                Toshl Category
              </label>
              <input
                id="category"
                type="text"
                className={styles.input}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Groceries, Transportation, Entertainment"
                required
              />
              <small style={{ color: '#666', fontSize: '0.85rem' }}>
                Enter the exact category name as it appears in Toshl Finance
              </small>
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Mapping'}
            </button>
          </form>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Existing Mappings ({mappings.length})
          </h2>

          {loading ? (
            <div className={styles.loading}>Loading mappings...</div>
          ) : mappings.length === 0 ? (
            <div className={styles.emptyState}>
              No mappings yet. Add your first mapping above!
            </div>
          ) : (
            <div>
              {mappings.map((mapping) => (
                <div key={mapping._id} className={styles.transaction}>
                  <div className={styles.transactionHeader}>
                    <div className={styles.storeName}>{mapping.store_name}</div>
                    <div style={{ fontWeight: 500, color: '#0070f3' }}>
                      {mapping.category}
                    </div>
                  </div>
                  {mapping.updated_at && (
                    <div className={styles.transactionDetails}>
                      Updated: {new Date(mapping.updated_at).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.card} ${styles.message} ${styles.info}`}>
          <strong>Common Toshl Categories:</strong>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {['Groceries', 'Transportation', 'Entertainment', 'Shopping', 'Dining', 'Health', 'Bills', 'General'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
