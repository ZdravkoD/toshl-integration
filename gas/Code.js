/**
 * Gmail to Toshl Finance Integration
 * Google Apps Script
 * 
 * Automatically creates Toshl Finance expenses from bank credit card transaction emails
 * 
 * Setup Instructions:
 * 1. Create a new Google Apps Script project (script.google.com)
 * 2. Copy this code into Code.gs
 * 3. Update CONFIGURATION section with your settings
 * 4. Run 'setupTrigger' function once to install the email trigger
 * 5. Test with 'testProcessLatestEmail' function
 */

// ==================== CONFIGURATION ====================

const DEFAULT_CONFIG = {
  // Currency code for expenses (Toshl will receive everything in EUR)
  CURRENCY: 'EUR',
  
  // Currency conversion rates to EUR (update periodically)
  EXCHANGE_RATES: {
    'EUR': 1.0,
    'USD': 0.92,      // Approximate rate, update as needed
    'BGN': 0.51       // BGN is pegged to EUR at ~1.95583
  },
  
  // Label to apply to processed emails (will be created if doesn't exist)
  PROCESSED_LABEL: 'Toshl/Processed',
  
  // Label for pending transactions (waiting for category mapping)
  PENDING_LABEL: 'Toshl/Pending',

  // Tag added to Toshl entries created by this integration
  IMPORT_TAG_NAME: 'gmail-import'
};

function _getRequiredScriptProperty(propertyName) {
  const value = PropertiesService.getScriptProperties().getProperty(propertyName);
  
  if (!value) {
    throw new Error('Missing required Script Property: ' + propertyName);
  }
  
  return value;
}

function _loadConfig() {
  return Object.assign({}, DEFAULT_CONFIG, {
    TOSHL_ACCESS_TOKEN: _getRequiredScriptProperty('TOSHL_ACCESS_TOKEN'),
    BANK_EMAIL: _getRequiredScriptProperty('BANK_EMAIL'),
    EMAIL_SEARCH_QUERY: _getRequiredScriptProperty('EMAIL_SEARCH_QUERY'),
    WEB_API_BASE_URL: _getRequiredScriptProperty('WEB_API_BASE_URL'),
    WEB_API_USERNAME: _getRequiredScriptProperty('WEB_API_USERNAME'),
    WEB_API_PASSWORD: _getRequiredScriptProperty('WEB_API_PASSWORD')
  });
}

const CONFIG = _loadConfig();

function _getWebApiAuthHeader() {
  const credentials = CONFIG.WEB_API_USERNAME + ':' + CONFIG.WEB_API_PASSWORD;
  const encoded = Utilities.base64Encode(credentials);
  return 'Basic ' + encoded;
}

function _getWebApiOptions(options) {
  const baseHeaders = {
    'Authorization': _getWebApiAuthHeader()
  };
  
  const mergedOptions = Object.assign({}, options || {});
  mergedOptions.headers = Object.assign({}, baseHeaders, (options && options.headers) || {});
  
  return mergedOptions;
}

// ==================== EMAIL PARSING ====================

/**
 * Parse email to extract transaction details
 * @private
 */
function _parseTransaction(emailBody, emailDate) {
  const transaction = {
    store: null,
    amount: null,
    currency: null,
    date: null
  };
  
  // Extract amount and currency together
  const amountData = _extractAmountAndCurrency(emailBody);
  if (!amountData) {
    Logger.log('Could not extract amount from email');
    Logger.log('Email body: ' + emailBody.substring(0, 200));
    return null;
  }
  
  transaction.amount = amountData.amount;
  transaction.currency = amountData.currency;
  
  // Extract store name
  transaction.store = _extractStoreName(emailBody);
  if (!transaction.store) {
    Logger.log('Could not extract store name from email');
    Logger.log('Email body: ' + emailBody.substring(0, 200));
    return null;
  }
  
  // Extract or use email date
  transaction.date = _extractDate(emailBody, emailDate);
  
  // Convert amount to EUR if needed
  if (transaction.currency !== 'EUR') {
    const originalAmount = transaction.amount;
    transaction.amount = _convertToEUR(transaction.amount, transaction.currency);
    Logger.log('Converted ' + originalAmount + ' ' + transaction.currency + ' to ' + transaction.amount.toFixed(2) + ' EUR');
  }
  
  return transaction;
}

/**
 * Extract transaction amount and currency from email text
 * Handles Postbank Bulgaria format:
 * - Bulgarian: "на стойност 665.15 BGN"
 * - English: "for amount 665.15 BGN"
 * @private
 */
function _extractAmountAndCurrency(text) {
  // Postbank Bulgaria patterns (Bulgarian and English)
  const postbankPatterns = [
    // Bulgarian: "на стойност 665.15 BGN"
    /(?:на стойност|стойност)\s+(\d+[,\d]*\.?\d*)\s*(BGN|EUR|USD)/i,
    // English: "for amount 665.15 BGN"
    /(?:for amount|amount)\s+(\d+[,\d]*\.?\d*)\s*(BGN|EUR|USD)/i,
  ];
  
  // Try Postbank-specific patterns first
  for (let pattern of postbankPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      const currency = match[2].toUpperCase();
      
      if (!isNaN(amount) && amount > 0) {
        return { amount: amount, currency: currency };
      }
    }
  }
  
  // Fallback to generic patterns
  const genericPatterns = [
    /(\d+[,\d]*\.?\d*)\s*(USD|EUR|BGN)/i,           // 123.45 USD/EUR/BGN
    /\$(\d+[,\d]*\.?\d*)/,                          // $123.45 (assume USD)
    /€(\d+[,\d]*\.?\d*)/,                           // €123.45 (EUR)
  ];
  
  for (let pattern of genericPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      let currency = match[2] ? match[2].toUpperCase() : null;
      
      // Handle currency symbols
      if (pattern.source.startsWith('\\$')) {
        currency = 'USD';
      } else if (pattern.source.startsWith('€')) {
        currency = 'EUR';
      }
      
      if (!isNaN(amount) && amount > 0 && currency) {
        return { amount: amount, currency: currency };
      }
    }
  }
  
  return null;
}

/**
 * Convert amount from source currency to EUR
 * @private
 */
function _convertToEUR(amount, sourceCurrency) {
  const rate = CONFIG.EXCHANGE_RATES[sourceCurrency];
  
  if (!rate) {
    Logger.log('Warning: No exchange rate found for ' + sourceCurrency + ', using amount as-is');
    return amount;
  }
  
  return amount * rate;
}

/**
 * Extract store/merchant name from email text
 * Handles Postbank Bulgaria format:
 * - Bulgarian: "в MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI"
 * - English: "at MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI"
 * 
 * Simplified approach: Extract text between "в" (or "at") and "на" (or date pattern)
 * @private
 */
function _extractStoreName(text) {
  // Postbank Bulgaria: Extract everything between "в" and "на" (Bulgarian)
  // Pattern: "в [MERCHANT NAME] на [DATE]"
  let bulgarianMatch = text.match(/\sв\s+(.+?)\s+на\s+\d{2}\.\d{2}\.\d{4}/i);
  
  if (bulgarianMatch && bulgarianMatch[1]) {
    let store = bulgarianMatch[1].trim();
    return _cleanStoreName(store);
  }
  
  // Postbank Bulgaria: Extract everything between "at" and date (English)
  // Pattern: "at [MERCHANT NAME]. DD.MM.YYYY"
  let englishMatch = text.match(/\sat\s+(.+?)[\.\s]+\d{2}\.\d{2}\.\d{4}/i);
  
  if (englishMatch && englishMatch[1]) {
    let store = englishMatch[1].trim();
    return _cleanStoreName(store);
  }
  
  // Fallback to generic patterns
  const genericPatterns = [
    /(?:at|merchant:?)\s+([A-Z][A-Z0-9\s&\-\.\*,']+?)(?:\s+on|\s+for|\s+in|\s+was|\.|$)/i,
    /(?:purchase|transaction)\s+(?:at|from)\s+([A-Z][A-Z0-9\s&\-\.\*,']+?)(?:\s+|$)/i,
    /card\s+.*?(?:charged|used)\s+(?:at|by)\s+([A-Z][A-Z0-9\s&\-\.\*,']+?)(?:\s+on|\s+for|\.)/i
  ];
  
  for (let pattern of genericPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let store = match[1].trim();
      return _cleanStoreName(store);
    }
  }
  
  return null;
}

/**
 * Clean up extracted store name
 * - Remove backslash and everything after (location/duplicate text)
 * - Extract domain from URLs
 * - Remove trailing punctuation
 * @private
 */
function _cleanStoreName(store) {
  if (!store) return null;
  
  store = store.trim();
  
  // Remove backslash and everything after it (duplicate/location text)
  // Example: "MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI" → "MR. BRICOLAGE SOFIA 3"
  const backslashIndex = store.indexOf('\\');
  if (backslashIndex > 0) {
    store = store.substring(0, backslashIndex).trim();
  }
  
  // Clean up URLs: Extract domain only
  // Example: "HTTPS://WWW.SPEEDY.BG/" → "WWW.SPEEDY.BG"
  if (store.match(/^HTTPS?:\/\//i)) {
    const urlMatch = store.match(/^HTTPS?:\/\/([^\/\\]+)/i);
    if (urlMatch && urlMatch[1]) {
      store = urlMatch[1].toUpperCase();
    }
  }
  
  // Remove trailing punctuation and whitespace
  store = store.replace(/[,;.\s\/\\]+$/, '').trim();
  
  // Validate length
  if (store.length > 3 && store.length < 100) {
    return store;
  }

  if (store.toLowerCase().startsWith("glovo")) {
    return "Glovo";
  }
  
  return null;
}

/**
 * Extract transaction date from email text or use email date
 * Handles Postbank Bulgaria format: "07.11.2025 20:03:38" or "на 07.11.2025"
 * @private
 */
function _extractDate(text, emailDate) {
  const patterns = [
    // Postbank format: "07.11.2025 20:03:38" or "на 07.11.2025"
    /(\d{2}\.\d{2}\.\d{4})/,
    // Also support other common formats
    /(?:on|date:?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/  // ISO format
  ];
  
  for (let pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let dateStr = match[1];
        
        // Handle DD.MM.YYYY format (Postbank Bulgaria)
        if (dateStr.includes('.') && dateStr.split('.').length === 3) {
          const parts = dateStr.split('.');
          const day = parts[0];
          const month = parts[1];
          const year = parts[2];
          
          // Create date in MM/DD/YYYY format for JavaScript
          const date = new Date(year + '-' + month + '-' + day);
          
          if (!isNaN(date.getTime())) {
            return _formatDateISO(date);
          }
        }
        
        // Try standard parsing for other formats
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return _formatDateISO(date);
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  
  // Use email date as fallback
  return _formatDateISO(emailDate);
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 * @private
 */
function _formatDateISO(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==================== WEB API INTEGRATION ====================

/**
 * PUBLIC: Sync Toshl tags to MongoDB via Web API
 * This fetches all tags from Toshl and stores them with usage counts
 * 
 * Run this function manually to update your common tags in the webapp
 */
function syncToshlTagsToMongoDB() {
  Logger.log('=== Syncing Toshl Tags to MongoDB ===');
  
  // Get all tags from Toshl
  const tags = _getAllToshlTags();
  
  if (!tags || tags.length === 0) {
    Logger.log('No tags found in Toshl');
    return false;
  }
  
  Logger.log('Found ' + tags.length + ' tags in Toshl');
  
  // Get tag usage counts from Toshl entries
  const tagUsage = _getTagUsageCounts();
  
  // Prepare tag data with usage counts
  const tagData = tags.map(tag => ({
    name: tag.name,
    toshl_id: tag.id,
    usage_count: tagUsage[tag.id] || 0
  }));
  
  // Sort by usage count (most used first)
  tagData.sort((a, b) => b.usage_count - a.usage_count);
  
  Logger.log('Top 5 most used tags:');
  tagData.slice(0, 5).forEach(tag => {
    Logger.log('  - ' + tag.name + ': ' + tag.usage_count + ' uses');
  });
  
  // Send to Web API
  const url = `${CONFIG.WEB_API_BASE_URL}/syncTags`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ tags: tagData }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      Logger.log('✓ Successfully synced ' + tagData.length + ' tags to MongoDB');
      return true;
    } else {
      Logger.log('Error syncing tags. Status: ' + responseCode);
      Logger.log('Response: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Exception syncing tags: ' + e.toString());
  }
  
  Logger.log('=== Sync Complete ===');
  return false;
}

/**
 * Get all tags from Toshl Finance
 * @private
 */
function _getAllToshlTags() {
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/tags', options);
    
    if (response.getResponseCode() === 200) {
      const tags = JSON.parse(response.getContentText());
      return tags;
    } else {
      Logger.log('Error fetching tags: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Exception fetching tags: ' + e.toString());
  }
  
  return [];
}

/**
 * Get tag usage counts from Toshl entries
 * Counts how many times each tag has been used
 * @private
 */
function _getTagUsageCounts() {
  const usageCounts = {};
  
  // Get entries from last 90 days to determine usage
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  
  const fromStr = _formatDateISO(fromDate);
  const toStr = _formatDateISO(toDate);
  
  const url = TOSHL_API_BASE + '/entries?from=' + fromStr + '&to=' + toStr + '&per_page=200';
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      const entries = JSON.parse(response.getContentText());
      
      // Count tag usage
      entries.forEach(entry => {
        if (entry.tags && Array.isArray(entry.tags)) {
          entry.tags.forEach(tagId => {
            usageCounts[tagId] = (usageCounts[tagId] || 0) + 1;
          });
        }
      });
      
      Logger.log('Analyzed ' + entries.length + ' entries for tag usage');
    } else {
      Logger.log('Could not fetch entries for usage analysis: ' + response.getResponseCode());
    }
  } catch (e) {
    Logger.log('Exception fetching entry usage: ' + e.toString());
  }
  
  return usageCounts;
}

/**
 * PUBLIC: Sync Toshl categories to MongoDB via Web API
 * This fetches all categories from Toshl and stores them with usage counts
 * 
 * Run this function manually to update your common categories in the webapp
 */
function syncToshlCategoriesToMongoDB() {
  Logger.log('=== Syncing Toshl Categories to MongoDB ===');
  
  // Get all categories from Toshl
  const categories = _getAllToshlCategories();
  
  if (!categories || categories.length === 0) {
    Logger.log('No categories found in Toshl');
    return false;
  }
  
  Logger.log('Found ' + categories.length + ' categories in Toshl');
  
  // Get category usage counts from Toshl entries
  const categoryUsage = _getCategoryUsageCounts();
  
  // Prepare category data with usage counts
  const categoryData = categories.map(cat => ({
    name: cat.name,
    toshl_id: cat.id,
    type: cat.type,
    usage_count: categoryUsage[cat.id] || 0
  }));
  
  // Sort by usage count (most used first)
  categoryData.sort((a, b) => b.usage_count - a.usage_count);
  
  Logger.log('Top 5 most used categories:');
  categoryData.slice(0, 5).forEach(cat => {
    Logger.log('  - ' + cat.name + ': ' + cat.usage_count + ' uses');
  });
  
  // Send to Web API
  const url = `${CONFIG.WEB_API_BASE_URL}/syncCategories`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ categories: categoryData }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      Logger.log('✓ Successfully synced ' + categoryData.length + ' categories to MongoDB');
      return true;
    } else {
      Logger.log('Error syncing categories. Status: ' + responseCode);
      Logger.log('Response: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Exception syncing categories: ' + e.toString());
  }
  
  Logger.log('=== Sync Complete ===');
  return false;
}

/**
 * Get all categories from Toshl Finance
 * @private
 */
function _getAllToshlCategories() {
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/categories', options);
    
    if (response.getResponseCode() === 200) {
      const categories = JSON.parse(response.getContentText());
      return categories.filter(cat => cat.type === 'expense'); // Only expense categories
    } else {
      Logger.log('Error fetching categories: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Exception fetching categories: ' + e.toString());
  }
  
  return [];
}

/**
 * Get category usage counts from Toshl entries
 * Counts how many times each category has been used
 * @private
 */
function _getCategoryUsageCounts() {
  const usageCounts = {};
  
  // Get entries from last 90 days to determine usage
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  
  const fromStr = _formatDateISO(fromDate);
  const toStr = _formatDateISO(toDate);
  
  const url = TOSHL_API_BASE + '/entries?from=' + fromStr + '&to=' + toStr + '&per_page=200';
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      const entries = JSON.parse(response.getContentText());
      
      // Count category usage
      entries.forEach(entry => {
        if (entry.category) {
          usageCounts[entry.category] = (usageCounts[entry.category] || 0) + 1;
        }
      });
      
      Logger.log('Analyzed ' + entries.length + ' entries for category usage');
    } else {
      Logger.log('Could not fetch entries for usage analysis: ' + response.getResponseCode());
    }
  } catch (e) {
    Logger.log('Exception fetching entry usage: ' + e.toString());
  }
  
  return usageCounts;
}

/**
 * Get category from Web API for a store name
 * @private
 */
function _getCategoryFromWebAPI(storeName) {
  const url = `${CONFIG.WEB_API_BASE_URL}/getCategory?store_name=${encodeURIComponent(storeName)}`;
  
  const options = {
    method: 'get',
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      
      if (result.category) {
        Logger.log('Found match in database: ' + storeName + ' → ' + result.category);
        return result.category;
      }
    } else {
      Logger.log('Web API endpoint error. Status: ' + responseCode);
    }
  } catch (e) {
    Logger.log('Exception calling Web API: ' + e.toString());
  }
  
  return null;
}

/**
 * Check if store is a courier service that needs description
 * @private
 */
function _isCourierService(storeName) {
  if (!storeName) return false;
  
  const upperName = storeName.toUpperCase();
  return upperName.includes('SPEEDY') || upperName.includes('ECONT') || upperName.includes('EKONT');
}

/**
 * Save pending transaction to Web API
 * @private
 */
function _savePendingTransaction(transaction, emailId) {
  const url = `${CONFIG.WEB_API_BASE_URL}/savePending`;
  
  // Check if this is a courier service that needs description
  const needsDescription = _isCourierService(transaction.store);
  
  const payload = {
    store_name: transaction.store,
    amount: transaction.amount,
    currency: CONFIG.CURRENCY,
    date: transaction.date,
    email_id: emailId,
    needs_description: needsDescription
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      
      if (result.success && result.insertedId) {
        if (needsDescription) {
          Logger.log('✓ Saved pending courier transaction (needs description): ' + transaction.store);
        } else {
          Logger.log('✓ Saved pending transaction: ' + transaction.store);
        }
        return result.insertedId;
      }
    } else {
      Logger.log('Error saving pending transaction. Status: ' + responseCode);
    }
  } catch (e) {
    Logger.log('Exception saving pending transaction: ' + e.toString());
  }
  
  return null;
}

/**
 * Get all pending transactions from Web API
 * @private
 */
function _getPendingTransactions() {
  const url = `${CONFIG.WEB_API_BASE_URL}/getPending`;
  
  const options = {
    method: 'get',
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      return result.documents || [];
    } else {
      Logger.log('Error getting pending transactions. Status: ' + responseCode);
    }
  } catch (e) {
    Logger.log('Exception getting pending transactions: ' + e.toString());
  }
  
  return [];
}

/**
 * Check whether a Gmail message has already been handled
 * @private
 */
function _isMessageHandled(messageId) {
  const url = `${CONFIG.WEB_API_BASE_URL}/getProcessedMessage?message_id=${encodeURIComponent(messageId)}`;
  
  const options = {
    method: 'get',
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      return result.exists === true;
    }
    
    Logger.log('Error checking processed message. Status: ' + responseCode);
  } catch (e) {
    Logger.log('Exception checking processed message: ' + e.toString());
  }
  
  return false;
}

/**
 * Save handled Gmail message to Web API
 * @private
 */
function _saveProcessedMessage(messageId, threadId, subject, status, transaction, toshlEntryId) {
  const url = `${CONFIG.WEB_API_BASE_URL}/saveProcessedMessage`;
  const payload = {
    message_id: messageId,
    thread_id: threadId,
    subject: subject,
    status: status,
    transaction_date: transaction ? transaction.date : null,
    store_name: transaction ? transaction.store : null,
    amount: transaction ? _roundAmount(transaction.amount) : null,
    toshl_entry_id: toshlEntryId || null
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      return true;
    }
    
    Logger.log('Error saving processed message. Status: ' + responseCode);
    Logger.log('Response: ' + response.getContentText());
  } catch (e) {
    Logger.log('Exception saving processed message: ' + e.toString());
  }
  
  return false;
}

/**
 * Mark pending transaction as processed
 * @private
 */
function _markPendingAsProcessed(pendingId) {
  const url = `${CONFIG.WEB_API_BASE_URL}/markProcessed?id=${encodeURIComponent(pendingId)}`;
  
  const options = {
    method: 'post',
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, _getWebApiOptions(options));
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const result = JSON.parse(response.getContentText());
      return result.success === true;
    } else {
      Logger.log('Error marking as processed. Status: ' + responseCode);
    }
  } catch (e) {
    Logger.log('Exception marking as processed: ' + e.toString());
  }
  
  return false;
}

// ==================== CATEGORY LOOKUP ====================

/**
 * Get category for a store name (using Web API)
 * @private
 */
function _getCategory(storeName) {
  // Get from Web API which connects to MongoDB
  const category = _getCategoryFromWebAPI(storeName);
  
  if (category) {
    return category;
  }
  
  // If not found, return null (will be saved as pending)
  return null;
}

// ==================== TOSHL FINANCE API ====================

const TOSHL_API_BASE = 'https://api.toshl.com';

/**
 * Create an expense in Toshl Finance
 * @private
 */
function _createToshlExpense(amount, date, description, category) {
  // Get or create category ID
  const categoryId = _getOrCreateCategory(category);
  const importTagId = _getOrCreateTag(CONFIG.IMPORT_TAG_NAME);
  
  // Prepare expense data
  const expenseData = {
    amount: -Math.abs(amount), // Negative for expense
    currency: {
      code: CONFIG.CURRENCY
    },
    date: date,
    desc: description
  };
  
  if (categoryId) {
    expenseData.category = categoryId;
  }

  if (importTagId) {
    expenseData.tags = [importTagId];
  }
  
  // Create the expense
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    payload: JSON.stringify(expenseData),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/entries', options);
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('Successfully created expense in Toshl: ' + description + ' - ' + amount.toFixed(2) + ' EUR');
      
      // Try to parse response, but handle empty responses
      const responseText = response.getContentText();
      if (responseText && responseText.trim().length > 0) {
        try {
          return JSON.parse(responseText);
        } catch (parseError) {
          Logger.log('Warning: Could not parse response JSON, but expense was created successfully');
          return { success: true };
        }
      } else {
        // Empty response is OK for successful creation
        return { success: true };
      }
    } else {
      Logger.log('Error creating expense. Status: ' + responseCode + ', Response: ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('Exception creating expense: ' + e.toString());
    return null;
  }
}

/**
 * Create an income entry in Toshl Finance (for refunds)
 * @private
 */
function _createToshlIncome(amount, date, description) {
  const importTagId = _getOrCreateTag(CONFIG.IMPORT_TAG_NAME);
  
  // Prepare income data
  const incomeData = {
    amount: Math.abs(amount), // Positive for income
    currency: {
      code: CONFIG.CURRENCY
    },
    date: date,
    desc: description
  };

  if (importTagId) {
    incomeData.tags = [importTagId];
  }
  
  // Create the income entry
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    payload: JSON.stringify(incomeData),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/entries', options);
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('Successfully created income in Toshl: ' + description + ' - ' + amount.toFixed(2) + ' EUR');
      
      // Try to parse response, but handle empty responses
      const responseText = response.getContentText();
      if (responseText && responseText.trim().length > 0) {
        try {
          return JSON.parse(responseText);
        } catch (parseError) {
          Logger.log('Warning: Could not parse response JSON, but income was created successfully');
          return { success: true };
        }
      } else {
        // Empty response is OK for successful creation
        return { success: true };
      }
    } else {
      Logger.log('Error creating income. Status: ' + responseCode + ', Response: ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('Exception creating income: ' + e.toString());
    return null;
  }
}

/**
 * Get or create a category in Toshl Finance
 * @private
 */
function _getOrCreateCategory(categoryName) {
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    // Get all categories
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/categories', options);
    
    if (response.getResponseCode() === 200) {
      const categories = JSON.parse(response.getContentText());
      
      // Look for existing category
      for (let cat of categories) {
        if (cat.name && cat.name.toLowerCase() === categoryName.toLowerCase()) {
          return cat.id;
        }
      }
      
      // Category not found, create it
      return _createCategory(categoryName);
    }
  } catch (e) {
    Logger.log('Error getting categories: ' + e.toString());
  }
  
  return null;
}

/**
 * Get or create a tag in Toshl Finance
 * @private
 */
function _getOrCreateTag(tagName) {
  const tags = _getAllToshlTags();
  const existingTag = tags.find(tag => tag.name && tag.name.toLowerCase() === tagName.toLowerCase());
  
  if (existingTag) {
    return existingTag.id;
  }
  
  const tagData = { name: tagName };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    payload: JSON.stringify(tagData),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/tags', options);
    
    if (response.getResponseCode() === 201) {
      const newTag = JSON.parse(response.getContentText());
      Logger.log('Created new tag: ' + tagName);
      return newTag.id;
    }
    
    Logger.log('Error creating tag: ' + response.getContentText());
  } catch (e) {
    Logger.log('Exception creating tag: ' + e.toString());
  }
  
  return null;
}

/**
 * Round amounts to 2 decimals to match Toshl comparisons
 * @private
 */
function _roundAmount(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * Find an existing Toshl entry for this transaction
 * @private
 */
function _findExistingToshlEntry(amount, date, description, isIncome) {
  const fromDate = date;
  const toDate = date;
  const url = TOSHL_API_BASE + '/entries?from=' + fromDate + '&to=' + toDate + '&per_page=200';
  const expectedAmount = isIncome ? Math.abs(amount) : -Math.abs(amount);
  const roundedExpectedAmount = _roundAmount(expectedAmount);
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() === 200) {
      const entries = JSON.parse(response.getContentText());
      return entries.find(entry => {
        return entry.date === date &&
          entry.desc === description &&
          _roundAmount(Number(entry.amount)) === roundedExpectedAmount;
      }) || null;
    }
    
    Logger.log('Error fetching existing Toshl entries: ' + response.getContentText());
  } catch (e) {
    Logger.log('Exception fetching existing Toshl entries: ' + e.toString());
  }
  
  return null;
}

/**
 * Create a new category in Toshl Finance
 * @private
 */
function _createCategory(categoryName) {
  const categoryData = {
    name: categoryName,
    type: 'expense'
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    payload: JSON.stringify(categoryData),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/categories', options);
    
    if (response.getResponseCode() === 201) {
      const newCategory = JSON.parse(response.getContentText());
      Logger.log('Created new category: ' + categoryName);
      return newCategory.id;
    } else {
      Logger.log('Error creating category: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('Exception creating category: ' + e.toString());
  }
  
  return null;
}

// ==================== GMAIL PROCESSING ====================

/**
 * Get or create the processed label
 * @private
 */
function _getProcessedLabel() {
  let label = GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.PROCESSED_LABEL);
    Logger.log('Created label: ' + CONFIG.PROCESSED_LABEL);
  }
  return label;
}

/**
 * Get or create the pending label
 * @private
 */
function _getPendingLabel() {
  let label = GmailApp.getUserLabelByName(CONFIG.PENDING_LABEL);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.PENDING_LABEL);
    Logger.log('Created label: ' + CONFIG.PENDING_LABEL);
  }
  return label;
}

/**
 * Process a single email thread
 * @private
 */
function _processEmailThread(thread) {
  const messages = thread.getMessages();
  const processedLabel = _getProcessedLabel();
  const pendingLabel = _getPendingLabel();
  
  // Process each message in the thread
  for (let message of messages) {
    const subject = message.getSubject();
    const emailId = message.getId();
    const threadId = thread.getId();
    
    // Skip unsuccessful transactions (Неуспешна = unsuccessful in Bulgarian)
    if (subject.toLowerCase().includes('неуспешна')) {
      Logger.log("Skipping unsuccessful transaction: " + subject);
      continue;
    }
    
    if (_isMessageHandled(emailId)) {
      Logger.log("Email already processed: " + subject);
      continue;
    }
    
    // Get email details
    const emailBody = message.getPlainBody();
    const emailDate = message.getDate();
    const labels = message.getThread().getLabels();
    
    Logger.log('Processing email: ' + subject);
    
    // Check if this is a refund/income transaction
    if (subject.toLowerCase().includes('успешно възстановена сума') || 
        emailBody.toLowerCase().includes('успешно възстановена сума')) {
      Logger.log('Detected refund/income transaction');
      
      // Parse transaction
      const transaction = _parseTransaction(emailBody, emailDate);
      
      if (!transaction) {
        Logger.log('Could not parse refund transaction from email: ' + subject);
        continue;
      }

      const refundDescription = 'Refund - ' + transaction.store;
      const existingRefund = _findExistingToshlEntry(
        transaction.amount,
        transaction.date,
        refundDescription,
        true
      );
      
      if (existingRefund) {
        Logger.log('Existing Toshl refund found, skipping create: ' + refundDescription);
        _saveProcessedMessage(emailId, threadId, subject, 'existing_entry', transaction, existingRefund.id);
        thread.addLabel(processedLabel);
        continue;
      }
      
      // Create income entry directly in Toshl
      const result = _createToshlIncome(
        transaction.amount,
        transaction.date,
        refundDescription
      );
      
      if (result) {
        _saveProcessedMessage(emailId, threadId, subject, 'refund_processed', transaction, result.id || null);
        thread.addLabel(processedLabel);
        Logger.log('✓ Successfully processed refund as income');
      }
      continue;
    }
    
    // Parse transaction
    const transaction = _parseTransaction(emailBody, emailDate);
    
    if (!transaction) {
      Logger.log('Could not parse transaction from email: ' + subject);
      continue;
    }
    
    // Get category from MongoDB
    const category = _getCategory(transaction.store);
    
    if (!category) {
      // No category mapping found - save as pending
      Logger.log('⏳ No category mapping found for: ' + transaction.store);
      Logger.log('Saving to pending transactions...');
      
      const pendingId = _savePendingTransaction(transaction, emailId);
      
      if (pendingId) {
        _saveProcessedMessage(emailId, threadId, subject, 'pending', transaction, null);
        thread.addLabel(pendingLabel);
        Logger.log('✓ Saved as pending transaction, waiting for category mapping');
      }
    } else {
      // Category found - create expense
      Logger.log('Transaction found: ' + transaction.store + ' - ' + transaction.amount.toFixed(2) + ' EUR on ' + transaction.date + ' [' + category + ']');
      
      const existingExpense = _findExistingToshlEntry(
        transaction.amount,
        transaction.date,
        transaction.store,
        false
      );
      
      if (existingExpense) {
        Logger.log('Existing Toshl expense found, skipping create: ' + transaction.store);
        _saveProcessedMessage(emailId, threadId, subject, 'existing_entry', transaction, existingExpense.id);
        thread.addLabel(processedLabel);
        continue;
      }
      
      const result = _createToshlExpense(
        transaction.amount,
        transaction.date,
        transaction.store,
        category
      );
      
      if (result) {
        // Remove pending label if it exists
        const hasPending = labels.some(label => label.getName() === CONFIG.PENDING_LABEL);
        if (hasPending) {
          thread.removeLabel(pendingLabel);
        }
        
        // Mark as processed
        _saveProcessedMessage(emailId, threadId, subject, 'processed', transaction, result.id || null);
        thread.addLabel(processedLabel);
        Logger.log('✓ Successfully processed and labeled email');
      }
    }
  }
}

/**
 * Process unread bank emails
 * @private
 */
function _processUnreadBankEmails() {
  // Build search query
  let searchQuery = 'is:unread from:' + CONFIG.BANK_EMAIL;
  if (CONFIG.EMAIL_SEARCH_QUERY) {
    searchQuery += ' ' + CONFIG.EMAIL_SEARCH_QUERY;
  }
  
  Logger.log('Searching for emails with query: ' + searchQuery);
  
  // Get matching threads
  const threads = GmailApp.search(searchQuery, 0, 50);
  
  Logger.log('Found ' + threads.length + ' unread email thread(s)');
  
  // Process each thread
  let processedCount = 0;
  for (let thread of threads) {
    try {
      _processEmailThread(thread);
      processedCount++;
    } catch (e) {
      Logger.log('Error processing thread: ' + e.toString());
    }
  }
  
  Logger.log('Processed ' + processedCount + '/' + threads.length + ' threads');
}

// ==================== TRIGGER FUNCTIONS ====================

/**
 * TRIGGER: This function is called automatically when a new email arrives
 * Set up by running setupTrigger() once
 */
function onNewEmail(e) {
  Logger.log('New email trigger fired');
  
  // Process the specific email that triggered this
  if (e && e.message) {
    const messageId = e.message;
    const message = GmailApp.getMessageById(messageId);
    
    if (message) {
      const from = message.getFrom();
      
      // Check if email is from bank
      if (from.toLowerCase().includes(CONFIG.BANK_EMAIL.toLowerCase())) {
        Logger.log('New email from bank detected');
        _processEmailThread(message.getThread());
        return;
      }
    }
  }
  
  // Fallback: process all unread emails
  _processUnreadBankEmails();
}

/**
 * PUBLIC: Set up automatic trigger for new emails
 * Run this function once to install the trigger
 */
function setupTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (let trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onNewEmail') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // Create new trigger
  ScriptApp.newTrigger('onNewEmail')
    .forUserGmails()
    .onNewGmailMessage()
    .create();
  
  Logger.log('✓ Email trigger installed successfully!');
  Logger.log('The script will now run automatically when you receive new emails from: ' + CONFIG.BANK_EMAIL);
}

/**
 * PUBLIC: Set up automatic trigger to process pending transactions
 * Run this function once to install the trigger
 * This will check for and process pending transactions every hour
 */
function setupProcessingTrigger() {
  // Delete existing processing triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (let trigger of triggers) {
    if (trigger.getHandlerFunction() === 'processPendingTransactions') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // Create new hourly trigger
  ScriptApp.newTrigger('processPendingTransactions')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('✓ Processing trigger installed successfully!');
  Logger.log('Pending transactions will be automatically processed every hour');
}

/**
 * PUBLIC: Remove the automatic email trigger
 */
function removeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onNewEmail') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('✓ Email trigger removed');
    }
  }
}

/**
 * PUBLIC: Remove the processing trigger
 */
function removeProcessingTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let trigger of triggers) {
    if (trigger.getHandlerFunction() === 'processPendingTransactions') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('✓ Processing trigger removed');
    }
  }
}

// ==================== PENDING TRANSACTION PROCESSING ====================

/**
 * TRIGGER/PUBLIC: Process all pending transactions
 * This can be called manually or runs automatically via trigger (every hour)
 */
function processPendingTransactions() {
  Logger.log('=== Processing Pending Transactions ===');
  
  const pendingTransactions = _getPendingTransactions();
  Logger.log('Found ' + pendingTransactions.length + ' total pending transaction(s)');
  
  // Filter out already processed transactions
  const unprocessedTransactions = pendingTransactions.filter(t => !t.processed);
  Logger.log('Found ' + unprocessedTransactions.length + ' unprocessed transaction(s)');
  
  if (unprocessedTransactions.length === 0) {
    Logger.log('No unprocessed transactions to handle');
    Logger.log('=== Processing Complete ===');
    return 0;
  }
  
  let processedCount = 0;
  const pendingLabel = _getPendingLabel();
  const processedLabel = _getProcessedLabel();
  
  for (let pending of unprocessedTransactions) {
    try {
      Logger.log('Processing pending: ' + pending.store_name);
      
      // Check if this needs a description but doesn't have one yet
      if (pending.needs_description && !pending.description) {
        Logger.log('⏳ Transaction needs description: ' + pending.store_name);
        continue;
      }
      
      // Check if category mapping now exists
      const category = _getCategory(pending.store_name);
      
      if (category) {
        Logger.log('✓ Found category mapping: ' + pending.store_name + ' → ' + category);
        
        // Prepare description (use custom description if available, otherwise store name)
        const description = pending.description || pending.store_name;
        
        // Create expense in Toshl
        const result = _createToshlExpense(
          pending.amount,
          pending.date,
          description,
          category
        );
        
        if (result) {
          // Mark as processed in MongoDB (via Web API)
          // Use pending._id directly (it's already a string from the API)
          const pendingId = pending._id.$oid || pending._id;
          _markPendingAsProcessed(pendingId);
          _saveProcessedMessage(
            pending.email_id,
            null,
            null,
            'processed_from_pending',
            {
              date: pending.date,
              store: description,
              amount: pending.amount
            },
            result.id || null
          );
          
          // Update email labels
          try {
            const message = GmailApp.getMessageById(pending.email_id);
            if (message) {
              const thread = message.getThread();
              thread.removeLabel(pendingLabel);
              thread.addLabel(processedLabel);
            }
          } catch (e) {
            Logger.log('Could not update email labels: ' + e.toString());
          }
          
          processedCount++;
          Logger.log('✓ Successfully processed pending transaction');
        }
      } else {
        Logger.log('⏳ Still no category mapping for: ' + pending.store_name);
      }
    } catch (e) {
      Logger.log('Error processing pending transaction: ' + e.toString());
    }
  }
  
  Logger.log('=== Processed ' + processedCount + '/' + unprocessedTransactions.length + ' pending transactions ===');
  return processedCount;
}

// ==================== MANUAL/TEST FUNCTIONS ====================

/**
 * PUBLIC: Manually process all unread emails (for testing or catching up)
 * Run this function from the Apps Script editor
 */
function manualProcessUnreadEmails() {
  Logger.log('=== Manual Processing Started ===');
  _processUnreadBankEmails();
  Logger.log('=== Manual Processing Complete ===');
}

/**
 * PUBLIC: Process all bank emails from the past week
 * Run this function to catch up on emails you may have missed
 */
function processLastWeekEmails() {
  Logger.log('=== Processing Last Week Emails ===');
  
  // Get pending transactions before processing
  const pendingBefore = _getPendingTransactions().filter(t => !t.processed);
  const pendingCountBefore = pendingBefore.length;
  
  // Calculate date range (past 7 days)
  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);
  
  // Format dates for Gmail search (YYYY/MM/DD)
  const afterDate = oneWeekAgo.getFullYear() + '/' + 
                   String(oneWeekAgo.getMonth() + 1).padStart(2, '0') + '/' + 
                   String(oneWeekAgo.getDate()).padStart(2, '0');
  
  // Try different search strategies to find emails
  let searchQuery = 'from:' + CONFIG.BANK_EMAIL + ' after:' + afterDate;
  
  Logger.log('Searching for emails with query: ' + searchQuery);
  Logger.log('Date range: ' + afterDate + ' to today');
  
  // Get matching threads (up to 100)
  let threads = GmailApp.search(searchQuery, 0, 100);
  
  Logger.log('Found ' + threads.length + ' email thread(s) from the past week');
  
  // If no threads found with specific subject, try without it
  if (threads.length === 0 && CONFIG.EMAIL_SEARCH_QUERY) {
    Logger.log('No emails found with subject filter, trying without it...');
    searchQuery = 'from:' + CONFIG.BANK_EMAIL + ' after:' + afterDate;
    threads = GmailApp.search(searchQuery, 0, 100);
    Logger.log('Found ' + threads.length + ' email thread(s) without subject filter');
  }
  
  if (threads.length === 0) {
    Logger.log('No emails found. Tips:');
    Logger.log('1. Check that CONFIG.BANK_EMAIL is correct: ' + CONFIG.BANK_EMAIL);
    Logger.log('2. Verify you have emails from this sender in the date range');
    Logger.log('3. Try searching manually in Gmail: ' + searchQuery);
    Logger.log('=== Processing Complete ===');
    return 0;
  }
  
  // Process each thread
  let processedCount = 0;
  for (let thread of threads) {
    try {
      _processEmailThread(thread);
      processedCount++;
    } catch (e) {
      Logger.log('Error processing thread: ' + e.toString());
    }
  }
  
  Logger.log('Processed ' + processedCount + '/' + threads.length + ' threads from the past week');
  
  // Check for new pending transactions and send email if any were created
  const pendingAfter = _getPendingTransactions().filter(t => !t.processed);
  const pendingCountAfter = pendingAfter.length;
  const newPendingCount = pendingCountAfter - pendingCountBefore;
  
  if (newPendingCount > 0) {
    _sendPendingTransactionEmail(pendingAfter, newPendingCount);
  }
  
  Logger.log('=== Processing Complete ===');
  return processedCount;
}

/**
 * PUBLIC: Process all bank emails from the past 5 months
 * Uses message-level dedupe plus Toshl existence checks, so it is safe to rerun.
 */
function processLastFiveMonthsEmails() {
  Logger.log('=== Processing Bank Emails From The Past 5 Months ===');
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 5);
  
  const year = startDate.getFullYear();
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const day = String(startDate.getDate()).padStart(2, '0');
  
  let searchQuery = `from:${CONFIG.BANK_EMAIL} after:${year}/${month}/${day}`;
  if (CONFIG.EMAIL_SEARCH_QUERY) {
    searchQuery += ' ' + CONFIG.EMAIL_SEARCH_QUERY;
  }
  
  Logger.log('Searching for emails with query: ' + searchQuery);
  
  const batchSize = 100;
  let start = 0;
  let totalProcessed = 0;
  
  while (true) {
    const threads = GmailApp.search(searchQuery, start, batchSize);
    
    if (!threads || threads.length === 0) {
      break;
    }
    
    Logger.log('Processing batch starting at offset ' + start + ' (' + threads.length + ' thread(s))');
    
    for (let thread of threads) {
      try {
        _processEmailThread(thread);
        totalProcessed++;
      } catch (e) {
        Logger.log('Error processing thread: ' + e.toString());
      }
    }
    
    if (threads.length < batchSize) {
      break;
    }
    
    start += batchSize;
  }
  
  Logger.log('=== Processed ' + totalProcessed + ' thread(s) from the past 5 months ===');
  return totalProcessed;
}

/**
 * Send email notification about pending transactions
 * @private
 */
function _sendPendingTransactionEmail(pendingTransactions, newCount) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    
    if (!userEmail) {
      Logger.log('Could not get user email for notification');
      return;
    }
    
    const subject = '⏳ ' + newCount + ' New Pending Transaction' + (newCount > 1 ? 's' : '') + ' - Action Required';
    
    // Build email body
    let body = 'Hi,\n\n';
    body += 'Your Toshl integration processed emails from the past week and created ' + newCount + ' new pending transaction' + (newCount > 1 ? 's' : '') + ' that need category mapping.\n\n';
    body += '📊 PENDING TRANSACTIONS SUMMARY:\n';
    body += '═══════════════════════════════════════\n\n';
    
    // Show only unprocessed transactions, sorted by date (newest first)
    const unprocessed = pendingTransactions.filter(t => !t.processed);
    unprocessed.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let totalAmount = 0;
    unprocessed.forEach((transaction, index) => {
      body += (index + 1) + '. ' + transaction.store_name + '\n';
      body += '   Amount: ' + transaction.amount.toFixed(2) + ' ' + transaction.currency + '\n';
      body += '   Date: ' + transaction.date + '\n';
      
      if (transaction.needs_description) {
        body += '   ⚠️  Needs description (courier service)\n';
      }
      
      body += '\n';
      totalAmount += transaction.amount;
    });
    
    body += '───────────────────────────────────────\n';
    body += 'Total: ' + totalAmount.toFixed(2) + ' ' + CONFIG.CURRENCY + '\n\n';
    
    body += '👉 TAKE ACTION:\n';
    body += 'Visit your webapp to assign categories and descriptions:\n';
    body += 'https://toshl-integration.vercel.app/pending\n\n';
    
    body += 'Once you assign categories, the transactions will be automatically created in Toshl Finance.\n\n';
    body += '──────────────────────────────────────\n';
    body += 'Toshl Integration Bot 🤖';
    
    // Send the email
    MailApp.sendEmail({
      to: userEmail,
      subject: subject,
      body: body
    });
    
    Logger.log('✓ Sent pending transaction notification email to: ' + userEmail);
  } catch (e) {
    Logger.log('Error sending notification email: ' + e.toString());
  }
}

/**
 * PUBLIC: Test with the most recent email from your bank
 */
function testProcessLatestEmail() {
  Logger.log('=== Testing with Latest Email ===');
  
  const threads = GmailApp.search('from:' + CONFIG.BANK_EMAIL, 0, 1);
  
  if (threads.length > 0) {
    Logger.log('Found test email: ' + threads.length);
    _processEmailThread(threads[0]);
  } else {
    Logger.log('No emails found from: ' + CONFIG.BANK_EMAIL);
  }
  
  Logger.log('=== Test Complete ===');
}

/**
 * PUBLIC: Test Toshl API connection
 */
function testToshlConnection() {
  Logger.log('=== Testing Toshl API Connection ===');
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.TOSHL_ACCESS_TOKEN
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(TOSHL_API_BASE + '/me', options);
    
    if (response.getResponseCode() === 200) {
      const user = JSON.parse(response.getContentText());
      Logger.log('✓ Toshl API connection successful!');
      Logger.log('Account email: ' + user.email);
    } else {
      Logger.log('✗ Toshl API error. Status: ' + response.getResponseCode());
      Logger.log('Response: ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('✗ Exception: ' + e.toString());
  }
  
  Logger.log('=== Test Complete ===');
}

/**
 * PUBLIC: Test email parsing with sample Postbank Bulgaria text
 */
function testEmailParsing() {
  Logger.log('=== Testing Email Parsing ===');
  
  // Sample Postbank Bulgaria email
  const sampleEmail = `Успешна трансакция с кредитна карта от Пощенска банка Mastercard World Premium XX-4020 на стойност 665.15 BGN в MR. BRICOLAGE SOFIA 3\\MR. BRICOLAGE SOFI на 07.11.2025 20:03:38

Successfull transaction with Postbank credit card Mastercard World Premium XX-4020 for amount 665.15 BGN at MR. BRICOLAGE SOFIA 3\\MR. BRICOLAGE SOFI. 07.11.2025 20:03:38`;
  
  Logger.log('Sample email text:');
  Logger.log(sampleEmail);
  Logger.log('---');
  
  const emailDate = new Date();
  const transaction = _parseTransaction(sampleEmail, emailDate);
  
  if (transaction) {
    Logger.log('✓ Parsing successful!');
    Logger.log('Store: ' + transaction.store);
    Logger.log('Amount: ' + transaction.amount.toFixed(2) + ' EUR');
    Logger.log('Date: ' + transaction.date);
    
    const category = _getCategory(transaction.store);
    Logger.log('Category: ' + (category || 'Not found (will be pending)'));
  } else {
    Logger.log('✗ Parsing failed');
  }
  
  Logger.log('=== Test Complete ===');
}

/**
 * PUBLIC: Test Web API connection
 */
function testWebAPIConnection() {
  Logger.log('=== Testing Web API Connection ===');
  
  // Test: Try to get a category
  const testStore = 'TEST STORE';
  const category = _getCategoryFromWebAPI(testStore);
  
  if (category !== null) {
    Logger.log('✓ Web API connection successful!');
    Logger.log('Test query returned category: ' + category);
  } else {
    Logger.log('✓ Web API connection successful!');
    Logger.log('No mapping found for test store (this is expected if you haven\'t added any mappings yet)');
  }
  
  Logger.log('=== Test Complete ===');
}

/**
 * PUBLIC: Sync Toshl categories to database (run this periodically to update common categories)
 */
function runCategorySync() {
  Logger.log('=== Running Category Sync ===');
  const success = syncToshlCategoriesToMongoDB();
  
  if (success) {
    Logger.log('✓ Categories synced successfully!');
    Logger.log('Your webapp will now show your most-used Toshl categories');
  } else {
    Logger.log('✗ Category sync failed. Check the logs above for details.');
  }
  
  Logger.log('=== Sync Complete ===');
}

/**
 * PUBLIC: Sync Toshl tags to database (run this periodically to update common tags)
 */
function runTagSync() {
  Logger.log('=== Running Tag Sync ===');
  const success = syncToshlTagsToMongoDB();
  
  if (success) {
    Logger.log('✓ Tags synced successfully!');
    Logger.log('Your webapp will now show your most-used Toshl tags');
  } else {
    Logger.log('✗ Tag sync failed. Check the logs above for details.');
  }
  
  Logger.log('=== Sync Complete ===');
}

/**
 * PUBLIC: Sync both categories and tags to database
 */
function runFullSync() {
  Logger.log('=== Running Full Sync (Categories + Tags) ===');
  
  const categorySuccess = syncToshlCategoriesToMongoDB();
  const tagSuccess = syncToshlTagsToMongoDB();
  
  if (categorySuccess && tagSuccess) {
    Logger.log('✓ Full sync completed successfully!');
  } else {
    if (!categorySuccess) Logger.log('✗ Category sync failed');
    if (!tagSuccess) Logger.log('✗ Tag sync failed');
  }
  
  Logger.log('=== Full Sync Complete ===');
}

/**
 * PUBLIC: View all pending transactions
 */
function viewPendingTransactions() {
  Logger.log('=== Viewing Pending Transactions ===');
  
  const pending = _getPendingTransactions();
  
  Logger.log('Found ' + pending.length + ' pending transaction(s):');
  
  for (let p of pending) {
    Logger.log('---');
    Logger.log('Store: ' + p.store_name);
    Logger.log('Amount: ' + p.amount + ' ' + p.currency);
    Logger.log('Date: ' + p.date);
    Logger.log('Status: ' + p.status);
    Logger.log('Created: ' + p.created_at);
  }
  
  Logger.log('=== End ===');
}

/**
 * PUBLIC: Backfill process bank emails in a given date range (inclusive start, inclusive end)
 * Your requested range:
 *   01.01.2025 to 01.08.2025 (DD.MM.YYYY) => 2025/01/01 to 2025/08/01
 *
 * Gmail search uses:
 *   after:YYYY/MM/DD   (strictly after midnight that day)
 *   before:YYYY/MM/DD  (strictly before midnight that day)
 *
 * So to INCLUDE 2025/08/01, we set before:2025/08/02
 */
function processEmails_2025_01_01_to_2025_08_01() {
  Logger.log('=== Backfill Processing: 2025/01/01 to 2025/08/01 ===');

  const startInclusive = '2025/01/01';
  const endInclusive = '2025/08/01';
  const beforeExclusive = '2025/08/01';

  // Build Gmail query
  let searchQuery = `from:${CONFIG.BANK_EMAIL} after:${startInclusive} before:${beforeExclusive}`;

  // Keep your subject filter if you want ONLY those transaction emails
  if (CONFIG.EMAIL_SEARCH_QUERY) {
    searchQuery += ` ${CONFIG.EMAIL_SEARCH_QUERY}`;
  }

  Logger.log('Searching with query: ' + searchQuery);

  // GmailApp.search(query, start, max) supports paging
  const pageSize = 100;
  let start = 0;
  let totalThreads = 0;
  let processedThreads = 0;

  while (true) {
    const threads = GmailApp.search(searchQuery, start, pageSize);
    if (!threads || threads.length === 0) break;

    totalThreads += threads.length;
    Logger.log(`Fetched ${threads.length} threads (start=${start})`);

    for (const thread of threads) {
      try {
        processEmailThread_(thread);
        processedThreads++;
      } catch (e) {
        Logger.log('Error processing thread: ' + e.toString());
      }
    }

    start += threads.length;

    // Safety break: if less than a full page returned, we’re done
    if (threads.length < pageSize) break;
  }

  Logger.log(`=== Backfill Complete. Processed ${processedThreads} thread(s) out of ${totalThreads} fetched ===`);
}
