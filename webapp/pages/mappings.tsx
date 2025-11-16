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

export default function MappingsPage() {
  const router = useRouter();
  const { store } = router.query;
  
  const [mappings, setMappings] = useState<StoreMapping[]>([]);
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [commonCategories, setCommonCategories] = useState<string[]>([]);
  const [commonTags, setCommonTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchMappings();
    fetchCommonCategories();
    fetchCommonTags();
  }, []);

  useEffect(() => {
    if (store && typeof store === 'string') {
      setStoreName(store);
    }
  }, [store]);

  const fetchCommonCategories = async () => {
    try {
      const response = await fetch('/api/getCommonCategories');
      const data = await response.json();
      
      if (response.ok && data.categories) {
        setCommonCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to fetch common categories:', err);
      // Fallback to default categories if API fails
      setCommonCategories(['Groceries', 'Transportation', 'Entertainment', 'Shopping', 'Dining', 'Health', 'Bills', 'General']);
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
      // Fallback to default tags if API fails
      setCommonTags(['Recurring', 'Business', 'Personal', 'Gift', 'Travel']);
    }
  };

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
          tags: tags.length > 0 ? tags : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const tagsStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
        setSuccess(`Successfully added mapping for "${storeName}" → "${category}"${tagsStr}`);
        setStoreName('');
        setCategory('');
        setTags([]);
        setTagInput('');
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

  const handleAddTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputChange = (value: string) => {
    setTagInput(value);
    
    // Filter tags that match the input and aren't already selected
    const matches = value.trim()
      ? commonTags.filter(tag => 
          tag.toLowerCase().includes(value.toLowerCase()) && 
          !tags.includes(tag)
        )
      : commonTags.filter(tag => !tags.includes(tag));
    
    setFilteredTags(matches);
    setShowTagSuggestions(matches.length > 0);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const handleCategoryInputChange = (value: string) => {
    setCategory(value);
    
    const matches = value.trim()
      ? commonCategories.filter(cat => 
          cat.toLowerCase().includes(value.toLowerCase())
        )
      : commonCategories;
    
    setFilteredCategories(matches);
    setShowCategorySuggestions(matches.length > 0);
  };

  const handleCategorySelect = (categoryName: string) => {
    setCategory(categoryName);
    setShowCategorySuggestions(false);
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowCategorySuggestions(false);
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
          <button className={styles.navButton} onClick={() => router.push('/merchants')}>
            Manage Existing Mappings
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
              <div style={{ position: 'relative' }}>
                <input
                  id="category"
                  type="text"
                  className={styles.input}
                  value={category}
                  onChange={(e) => handleCategoryInputChange(e.target.value)}
                  onKeyDown={handleCategoryKeyDown}
                  onFocus={() => {
                    const matches = category.trim()
                      ? commonCategories.filter(cat => 
                          cat.toLowerCase().includes(category.toLowerCase())
                        )
                      : commonCategories;
                    setFilteredCategories(matches);
                    if (matches.length > 0) {
                      setShowCategorySuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow click on suggestions
                    setTimeout(() => setShowCategorySuggestions(false), 200);
                  }}
                  placeholder="e.g., Groceries, Transportation, Entertainment"
                  required
                />
                
                {/* Autocomplete Dropdown */}
                {showCategorySuggestions && filteredCategories.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}>
                    {filteredCategories.map((cat) => (
                      <div
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e0e0e0',
                          transition: 'background-color 0.2s',
                          color: '#333',
                          fontSize: '14px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e3f2fd';
                          e.currentTarget.style.color = '#1976d2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                          e.currentTarget.style.color = '#333';
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <small style={{ color: '#666', fontSize: '0.85rem' }}>
                Enter the exact category name as it appears in Toshl Finance
              </small>
            </div>

            {/* Tag Management Section */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Tags (optional)
              </label>
              
              {/* Selected Tags */}
              {tags.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  marginBottom: '10px',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f9f9f9'
                }}>
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: '#e3f2fd',
                        border: '1px solid #90caf9',
                        borderRadius: '16px',
                        fontSize: '14px',
                        color: '#1976d2'
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1976d2',
                          cursor: 'pointer',
                          padding: '0',
                          fontSize: '16px',
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
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className={styles.input}
                    value={tagInput}
                    onChange={(e) => handleTagInputChange(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    onFocus={() => {
                      const matches = tagInput.trim()
                        ? commonTags.filter(tag => 
                            tag.toLowerCase().includes(tagInput.toLowerCase()) && 
                            !tags.includes(tag)
                          )
                        : commonTags.filter(tag => !tags.includes(tag));
                      setFilteredTags(matches);
                      if (matches.length > 0) {
                        setShowTagSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding to allow click on suggestions
                      setTimeout(() => setShowTagSuggestions(false), 200);
                    }}
                    placeholder="Type a tag and press Enter"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagInput)}
                    disabled={!tagInput.trim()}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: tagInput.trim() ? '#2196F3' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: tagInput.trim() ? 'pointer' : 'not-allowed',
                      fontWeight: 500
                    }}
                  >
                    Add Tag
                  </button>
                </div>

                {/* Autocomplete Dropdown */}
                {showTagSuggestions && filteredTags.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}>
                    {filteredTags.map((tag) => (
                      <div
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e0e0e0',
                          transition: 'background-color 0.2s',
                          color: '#333',
                          fontSize: '14px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e3f2fd';
                          e.currentTarget.style.color = '#1976d2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                          e.currentTarget.style.color = '#333';
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={submitting || !storeName.trim() || !category.trim()}
              style={{
                opacity: (submitting || !storeName.trim() || !category.trim()) ? 0.6 : 1,
                cursor: (submitting || !storeName.trim() || !category.trim()) ? 'not-allowed' : 'pointer'
              }}
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
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.card} ${styles.message} ${styles.info}`}>
          <strong>Common Toshl Categories:</strong>
          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            {commonCategories.length > 0 ? 'Click a category to use it (sorted by usage):' : 'Loading your most-used categories...'}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {commonCategories.length > 0 ? (
              commonCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: category === cat ? '#0070f3' : '#e0e0e0',
                    color: category === cat ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat}
                </button>
              ))
            ) : (
              ['Groceries', 'Transportation', 'Entertainment', 'Shopping', 'Dining', 'Health', 'Bills', 'General'].map(cat => (
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
              ))
            )}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#999' }}>
            💡 Run <code>syncToshlCategoriesToMongoDB()</code> in Google Apps Script to update this list with your actual Toshl categories
          </div>
        </div>

        <div className={`${styles.card} ${styles.message} ${styles.info}`}>
          <strong>Common Toshl Tags:</strong>
          <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
            {commonTags.length > 0 ? 'Click tags to add them (sorted by usage):' : 'Loading your most-used tags...'}
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {commonTags.length > 0 ? (
              commonTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  disabled={tags.includes(tag)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: tags.includes(tag) ? '#90caf9' : '#e3f2fd',
                    color: tags.includes(tag) ? '#0d47a1' : '#1976d2',
                    border: `1px solid ${tags.includes(tag) ? '#42a5f5' : '#90caf9'}`,
                    borderRadius: '16px',
                    cursor: tags.includes(tag) ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s',
                    opacity: tags.includes(tag) ? 0.6 : 1
                  }}
                >
                  {tag} {tags.includes(tag) && '✓'}
                </button>
              ))
            ) : (
              <span style={{ color: '#999', fontSize: '0.85rem' }}>
                Run tag sync in Google Apps Script to see your tags here
              </span>
            )}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#999' }}>
            💡 Run <code>syncToshlTagsToMongoDB()</code> or <code>runFullSync()</code> in Google Apps Script to update tags
          </div>
        </div>
      </main>
    </div>
  );
}
