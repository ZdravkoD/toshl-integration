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
  needs_description?: boolean;
  description?: string;
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
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [editingMapping, setEditingMapping] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  
  // Category and tag autocomplete states for editing
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [showEditCategorySuggestions, setShowEditCategorySuggestions] = useState(false);
  const [filteredEditCategories, setFilteredEditCategories] = useState<string[]>([]);
  const [showEditTagSuggestions, setShowEditTagSuggestions] = useState(false);
  const [filteredEditTags, setFilteredEditTags] = useState<string[]>([]);

  useEffect(() => {
    fetchPendingTransactions();
    fetchCategoriesAndTags();
  }, []);

  const fetchCategoriesAndTags = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/getCommonCategories'),
        fetch('/api/getCommonTags')
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setTags(tagsData.tags || []);
      }
    } catch (err) {
      console.error('Error fetching categories and tags:', err);
    }
  };

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

  const handleSaveDescription = async (transactionId: string) => {
    if (!descriptionValue.trim()) {
      setError('Description cannot be empty');
      return;
    }

    try {
      const response = await fetch('/api/updateDescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: transactionId,
          description: descriptionValue
        })
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess('Description saved successfully');
        setEditingDescription(null);
        setDescriptionValue('');
        fetchPendingTransactions();
      } else {
        setError(data.error || 'Failed to save description');
      }
    } catch (err) {
      setError('Network error: Failed to save description');
    }
  };

  const handleStartEditDescription = (transaction: PendingTransaction) => {
    setEditingDescription(transaction._id);
    setDescriptionValue(transaction.description || '');
  };

  const handleCancelEditDescription = () => {
    setEditingDescription(null);
    setDescriptionValue('');
  };

  const handleStartEditMapping = (transaction: PendingTransaction) => {
    setEditingMapping(transaction._id);
    setEditCategory(transaction.category || '');
    setEditTags(transaction.tags || []);
    setEditTagInput('');
  };

  const handleCancelEditMapping = () => {
    setEditingMapping(null);
    setEditCategory('');
    setEditTags([]);
    setEditTagInput('');
    setShowEditCategorySuggestions(false);
    setShowEditTagSuggestions(false);
  };

  const handleSaveMapping = async (transactionId: string) => {
    if (!editCategory.trim()) {
      setError('Category cannot be empty');
      return;
    }

    try {
      const response = await fetch('/api/updatePendingMapping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: transactionId,
          category: editCategory,
          tags: editTags
        })
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess('Mapping updated successfully');
        setEditingMapping(null);
        setEditCategory('');
        setEditTags([]);
        setEditTagInput('');
        fetchPendingTransactions();
      } else {
        setError(data.error || 'Failed to update mapping');
      }
    } catch (err) {
      setError('Network error: Failed to update mapping');
    }
  };

  const handleEditCategoryInputChange = (value: string) => {
    setEditCategory(value);
    
    if (value.trim() === '') {
      setFilteredEditCategories(categories);
      setShowEditCategorySuggestions(true);
    } else {
      const filtered = categories.filter(cat =>
        cat.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredEditCategories(filtered);
      setShowEditCategorySuggestions(true);
    }
  };

  const handleEditCategorySelect = (category: string) => {
    setEditCategory(category);
    setShowEditCategorySuggestions(false);
  };

  const handleEditTagInputChange = (value: string) => {
    setEditTagInput(value);
    
    if (value.trim() === '') {
      const availableTags = tags.filter(t => !editTags.includes(t));
      setFilteredEditTags(availableTags);
      setShowEditTagSuggestions(true);
    } else {
      const filtered = tags.filter(tag =>
        tag.toLowerCase().includes(value.toLowerCase()) && !editTags.includes(tag)
      );
      setFilteredEditTags(filtered);
      setShowEditTagSuggestions(true);
    }
  };

  const handleEditTagSelect = (tag: string) => {
    if (!editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
    }
    setEditTagInput('');
    setShowEditTagSuggestions(false);
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
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
                      {transaction.needs_description && (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#fff3e0',
                          color: '#e65100',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          📦 COURIER
                        </span>
                      )}
                      <div className={styles.storeName}>{transaction.store_name}</div>
                    </div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  
                  {/* Description input for courier services */}
                  {transaction.needs_description && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff8e1', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#f57c00', fontWeight: 500 }}>
                        📦 This is a courier service. Please add a description (e.g., "Books from Amazon", "Laptop repair parts"):
                      </p>
                      {editingDescription === transaction._id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={descriptionValue}
                            onChange={(e) => setDescriptionValue(e.target.value)}
                            placeholder="Enter description..."
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              border: '2px solid #ff9800',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveDescription(transaction._id)}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#4caf50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '14px'
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditDescription}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#757575',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '14px'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : transaction.description ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            padding: '8px 12px',
                            backgroundColor: '#e8f5e9',
                            border: '1px solid #4caf50',
                            borderRadius: '4px',
                            fontSize: '14px',
                            color: '#2e7d32',
                            flex: 1
                          }}>
                            ✓ {transaction.description}
                          </span>
                          <button
                            onClick={() => handleStartEditDescription(transaction)}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#2196f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '14px'
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditDescription(transaction)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '14px'
                          }}
                        >
                          + Add Description
                        </button>
                      )}
                    </div>
                  )}
                  
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
                        {transaction.needs_description && !transaction.description ? 'NEEDS DESCRIPTION' : 'WAITING'}
                      </span>
                      {transaction.needs_description && (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#fff3e0',
                          color: '#e65100',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          📦 COURIER
                        </span>
                      )}
                      <div className={styles.storeName}>{transaction.store_name}</div>
                    </div>
                    <div className={styles.amount}>
                      {transaction.amount.toFixed(2)} {transaction.currency}
                    </div>
                  </div>
                  
                  {/* Show description if it's a courier service */}
                  {transaction.needs_description && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: transaction.description ? '#e8f5e9' : '#fff8e1', borderRadius: '4px' }}>
                      {transaction.description ? (
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#2e7d32', fontWeight: 500 }}>
                            📦 Courier delivery description:
                          </p>
                          {editingDescription === transaction._id ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                              <input
                                type="text"
                                value={descriptionValue}
                                onChange={(e) => setDescriptionValue(e.target.value)}
                                placeholder="Enter description..."
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  border: '2px solid #4caf50',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveDescription(transaction._id)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  fontSize: '14px'
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEditDescription}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#757575',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  fontSize: '14px'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                              <span style={{ fontSize: '14px', color: '#1b5e20', fontWeight: 500 }}>
                                "{transaction.description}"
                              </span>
                              <button
                                onClick={() => handleStartEditDescription(transaction)}
                                style={{
                                  padding: '4px 12px',
                                  backgroundColor: '#2196f3',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  fontSize: '12px'
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#f57c00', fontWeight: 500 }}>
                            ⚠️ Missing description! Add one before processing:
                          </p>
                          {editingDescription === transaction._id ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={descriptionValue}
                                onChange={(e) => setDescriptionValue(e.target.value)}
                                placeholder="Enter description..."
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  border: '2px solid #ff9800',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveDescription(transaction._id)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  fontSize: '14px'
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEditDescription}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#757575',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  fontSize: '14px'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEditDescription(transaction)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '14px'
                              }}
                            >
                              + Add Description
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Category and Tags - with edit capability */}
                  {editingMapping === transaction._id ? (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 500 }}>
                        Edit Category & Tags:
                      </p>
                      
                      {/* Category Input */}
                      <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#666' }}>
                          Category *
                        </label>
                        <input
                          type="text"
                          value={editCategory}
                          onChange={(e) => handleEditCategoryInputChange(e.target.value)}
                          onFocus={() => {
                            setFilteredEditCategories(categories);
                            setShowEditCategorySuggestions(true);
                          }}
                          onBlur={() => setTimeout(() => setShowEditCategorySuggestions(false), 200)}
                          placeholder="Enter category..."
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '2px solid #2196f3',
                            borderRadius: '4px',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                          }}
                        />
                        {showEditCategorySuggestions && filteredEditCategories.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}>
                            {filteredEditCategories.map((cat) => (
                              <div
                                key={cat}
                                onClick={() => handleEditCategorySelect(cat)}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  color: '#333'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#e3f2fd';
                                  e.currentTarget.style.color = '#1976d2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.color = '#333';
                                }}
                              >
                                {cat}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tags Input */}
                      <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#666' }}>
                          Tags (optional)
                        </label>
                        {editTags.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            {editTags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#f3e5f5',
                                  border: '1px solid #ce93d8',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  color: '#6a1b9a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {tag}
                                <button
                                  onClick={() => handleRemoveEditTag(tag)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#6a1b9a',
                                    cursor: 'pointer',
                                    padding: '0',
                                    fontSize: '14px',
                                    lineHeight: '1'
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          value={editTagInput}
                          onChange={(e) => handleEditTagInputChange(e.target.value)}
                          onFocus={() => {
                            const availableTags = tags.filter(t => !editTags.includes(t));
                            setFilteredEditTags(availableTags);
                            setShowEditTagSuggestions(true);
                          }}
                          onBlur={() => setTimeout(() => setShowEditTagSuggestions(false), 200)}
                          placeholder="Add tags..."
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                          }}
                        />
                        {showEditTagSuggestions && filteredEditTags.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            marginTop: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}>
                            {filteredEditTags.map((tag) => (
                              <div
                                key={tag}
                                onClick={() => handleEditTagSelect(tag)}
                                style={{
                                  padding: '6px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  fontSize: '13px',
                                  color: '#333'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f3e5f5';
                                  e.currentTarget.style.color = '#6a1b9a';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.color = '#333';
                                }}
                              >
                                {tag}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Save/Cancel Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleSaveMapping(transaction._id)}
                          disabled={!editCategory.trim()}
                          style={{
                            flex: 1,
                            padding: '8px 16px',
                            backgroundColor: editCategory.trim() ? '#4caf50' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: editCategory.trim() ? 'pointer' : 'not-allowed',
                            fontWeight: 500,
                            fontSize: '14px'
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={handleCancelEditMapping}
                          style={{
                            flex: 1,
                            padding: '8px 16px',
                            backgroundColor: '#757575',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '14px'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
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
                        <button
                          onClick={() => handleStartEditMapping(transaction)}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '12px',
                            marginLeft: 'auto'
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
