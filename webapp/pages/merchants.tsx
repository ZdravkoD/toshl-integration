import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

interface StoreMapping {
  _id: string;
  store_name: string;
  category: string;
  tags?: string[];
  updated_at?: string;
}

export default function MerchantsPage() {
  const router = useRouter();
  
  const [mappings, setMappings] = useState<StoreMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [commonCategories, setCommonCategories] = useState<string[]>([]);
  const [commonTags, setCommonTags] = useState<string[]>([]);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  
  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMappings();
    fetchCommonCategories();
    fetchCommonTags();
  }, []);

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

  const fetchCommonCategories = async () => {
    try {
      const response = await fetch('/api/getCommonCategories');
      const data = await response.json();
      
      if (response.ok && data.categories) {
        setCommonCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to fetch common categories:', err);
    }
  };

  const fetchCommonTags = async () => {
    try {
      const response = await fetch('/api/getCommonTags');
      const data = await response.json();
      
      if (response.ok && data.tags) {
        setCommonTags(data.tags);
      }
    } catch (err) {
      console.error('Failed to fetch common tags:', err);
    }
  };

  const handleEdit = (mapping: StoreMapping) => {
    setEditingId(mapping._id);
    setEditCategory(mapping.category);
    setEditTags(mapping.tags || []);
    setEditTagInput('');
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditCategory('');
    setEditTags([]);
    setEditTagInput('');
  };

  const handleAddEditTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed]);
      setEditTagInput('');
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const handleEditTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEditTag(editTagInput);
    } else if (e.key === 'Backspace' && !editTagInput && editTags.length > 0) {
      handleRemoveEditTag(editTags[editTags.length - 1]);
    }
  };

  const handleSaveEdit = async (mappingId: string) => {
    if (!editCategory.trim()) {
      setError('Category is required');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/mappings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _id: mappingId,
          category: editCategory.trim(),
          tags: editTags.length > 0 ? editTags : [],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Mapping updated successfully');
        setEditingId(null);
        setEditCategory('');
        setEditTags([]);
        setEditTagInput('');
        fetchMappings();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to update mapping');
      }
    } catch (err) {
      setError('Network error: Failed to update mapping');
    }
  };

  const handleDeleteClick = (mappingId: string) => {
    setDeletingId(mappingId);
    setError('');
    setSuccess('');
  };

  const handleCancelDelete = () => {
    setDeletingId(null);
  };

  const handleConfirmDelete = async (mappingId: string) => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/mappings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ _id: mappingId }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Mapping deleted successfully');
        setDeletingId(null);
        fetchMappings();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete mapping');
        setDeletingId(null);
      }
    } catch (err) {
      setError('Network error: Failed to delete mapping');
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Manage Store Mappings</h1>
          <p className={styles.subtitle}>
            Edit or delete existing store-to-category mappings
          </p>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navButton} onClick={() => router.push('/')}>
            ← Back to Dashboard
          </button>
          <button className={styles.navButton} onClick={() => router.push('/mappings')}>
            + Add New Mapping
          </button>
        </nav>

        {error && (
          <div className={`${styles.card} ${styles.message} ${styles.error}`}>
            {error}
          </div>
        )}

        {success && (
          <div className={`${styles.card} ${styles.message} ${styles.success}`}>
            {success}
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            All Mappings ({mappings.length})
          </h2>

          {loading ? (
            <div className={styles.loading}>Loading mappings...</div>
          ) : mappings.length === 0 ? (
            <div className={styles.emptyState}>
              No mappings yet. <a href="/mappings" style={{ color: '#0070f3', textDecoration: 'underline' }}>Add your first mapping</a>!
            </div>
          ) : (
            <div>
              {mappings.map((mapping) => (
                <div key={mapping._id} className={styles.transaction} style={{ position: 'relative' }}>
                  {editingId === mapping._id ? (
                    // Edit Mode
                    <div style={{ padding: '10px 0' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ display: 'block', marginBottom: '5px', color: '#666' }}>
                          Store: {mapping.store_name}
                        </strong>
                      </div>

                      {/* Category Selection */}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                          Category
                        </label>
                        <input
                          type="text"
                          className={styles.input}
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="Enter category"
                          style={{ marginBottom: '8px' }}
                        />
                        {/* Common categories quick select */}
                        {commonCategories.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {commonCategories.slice(0, 10).map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setEditCategory(cat)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  background: editCategory === cat ? '#0070f3' : '#e0e0e0',
                                  color: editCategory === cat ? 'white' : 'black',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tags Management */}
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                          Tags (optional)
                        </label>
                        
                        {/* Selected Tags */}
                        {editTags.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '6px', 
                            marginBottom: '8px',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            backgroundColor: '#f9f9f9'
                          }}>
                            {editTags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  backgroundColor: '#e3f2fd',
                                  border: '1px solid #90caf9',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  color: '#1976d2'
                                }}
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditTag(tag)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#1976d2',
                                    cursor: 'pointer',
                                    padding: '0',
                                    fontSize: '14px',
                                    lineHeight: '1',
                                    fontWeight: 'bold'
                                  }}
                                  aria-label={`Remove ${tag}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Tag Input */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          <input
                            type="text"
                            className={styles.input}
                            value={editTagInput}
                            onChange={(e) => setEditTagInput(e.target.value)}
                            onKeyDown={handleEditTagInputKeyDown}
                            placeholder="Type a tag"
                            style={{ flex: 1, fontSize: '13px', padding: '6px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddEditTag(editTagInput)}
                            disabled={!editTagInput.trim()}
                            style={{
                              padding: '6px 12px',
                              fontSize: '13px',
                              backgroundColor: editTagInput.trim() ? '#2196F3' : '#ccc',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: editTagInput.trim() ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Add
                          </button>
                        </div>

                        {/* Common tags quick select */}
                        {commonTags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {commonTags.slice(0, 8).map(tag => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleAddEditTag(tag)}
                                disabled={editTags.includes(tag)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  background: editTags.includes(tag) ? '#90caf9' : '#e3f2fd',
                                  color: editTags.includes(tag) ? '#0d47a1' : '#1976d2',
                                  border: `1px solid ${editTags.includes(tag) ? '#42a5f5' : '#90caf9'}`,
                                  borderRadius: '12px',
                                  cursor: editTags.includes(tag) ? 'not-allowed' : 'pointer',
                                  opacity: editTags.includes(tag) ? 0.6 : 1
                                }}
                              >
                                {tag} {editTags.includes(tag) && '✓'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleSaveEdit(mapping._id)}
                          style={{
                            flex: 1,
                            padding: '8px 16px',
                            backgroundColor: '#4CAF50',
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
                          onClick={handleCancelEdit}
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
                  ) : deletingId === mapping._id ? (
                    // Delete Confirmation Mode
                    <div style={{ padding: '10px 0' }}>
                      <div style={{ marginBottom: '15px', fontSize: '15px' }}>
                        <strong>Delete this mapping?</strong>
                        <div style={{ marginTop: '8px', color: '#666' }}>
                          <strong>{mapping.store_name}</strong> → {mapping.category}
                          {mapping.tags && mapping.tags.length > 0 && (
                            <div style={{ marginTop: '5px', fontSize: '13px' }}>
                              Tags: {mapping.tags.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleConfirmDelete(mapping._id)}
                          style={{
                            flex: 1,
                            padding: '8px 16px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: '14px'
                          }}
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={handleCancelDelete}
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
                    // View Mode
                    <>
                      <div className={styles.transactionHeader}>
                        <div className={styles.storeName}>{mapping.store_name}</div>
                        <div style={{ fontWeight: 500, color: '#0070f3' }}>
                          {mapping.category}
                        </div>
                      </div>
                      {mapping.tags && mapping.tags.length > 0 && (
                        <div style={{ 
                          marginTop: '8px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px'
                        }}>
                          {mapping.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                padding: '2px 8px',
                                backgroundColor: '#e3f2fd',
                                border: '1px solid #90caf9',
                                borderRadius: '12px',
                                fontSize: '12px',
                                color: '#1976d2'
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {mapping.updated_at && (
                        <div className={styles.transactionDetails}>
                          Updated: {new Date(mapping.updated_at).toLocaleString()}
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div style={{ 
                        marginTop: '10px',
                        display: 'flex',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => handleEdit(mapping)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(mapping._id)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.card} ${styles.message} ${styles.info}`}>
          <strong>💡 Tips:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', marginBottom: 0 }}>
            <li>Click <strong>Edit</strong> to change the category or tags for a store</li>
            <li>Click <strong>Delete</strong> to remove a mapping completely</li>
            <li>Changes take effect immediately for future transactions</li>
            <li>To add a new mapping, use the "Add New Mapping" button above</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
