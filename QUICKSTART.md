# Quick Start Guide - Google Apps Script

## 5-Minute Setup

### 1. Create the Script
1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Copy all code from `Code.gs` and paste it
4. Click **Save** (💾)

### 2. Configure
Update these lines in the `CONFIG` section:

```javascript
TOSHL_ACCESS_TOKEN: 'YOUR_TOSHL_ACCESS_TOKEN_HERE',
BANK_EMAIL: 'alerts@yourbank.com',  // ⚠️ CHANGE THIS
```

### 3. Test Connection
1. Select `testToshlConnection` from dropdown
2. Click **Run** ▶️
3. Authorize when prompted
4. Check log for "✓ connection successful"

### 4. Test Email Processing
1. Select `testProcessLatestEmail` from dropdown
2. Click **Run** ▶️
3. Check Toshl Finance for new expense

### 5. Enable Auto-Trigger
1. Select `setupTrigger` from dropdown
2. Click **Run** ▶️
3. Done! ✨

## Common Bank Email Addresses

Update `BANK_EMAIL` with your bank's sender address:

- **Chase**: `no.reply.alerts@chase.com`
- **Bank of America**: `BofA_Alerts@ealerts.bankofamerica.com`
- **Wells Fargo**: `wellsfargo@alerts.wellsfargo.com`
- **Citi**: `citibank@info.citi.com`
- **Capital One**: `alerts@capitalone.com`
- **American Express**: `americanexpress@welcome.aexp.com`

To find yours: Open a bank notification email and check the "From" address.

## Customizing Store Categories

Add your favorite stores to the `STORE_CATEGORIES` object:

```javascript
STORE_CATEGORIES: {
  'AMAZON': 'Shopping',
  'TRADER JOE': 'Groceries',
  'CHIPOTLE': 'Food & Dining',
  'PLANET FITNESS': 'Health & Fitness',
  'BP': 'Gas & Fuel'
}
```

Tips:
- Use UPPERCASE for store names
- Partial matching works (e.g., 'TRADER JOE' matches 'TRADER JOE\'S')
- Add common stores you spend at frequently

## Viewing Logs

**Method 1: Executions Tab**
1. Click **Executions** (⏰ icon in left sidebar)
2. View all script runs
3. Click any execution to see detailed logs

**Method 2: Real-time Logging**
1. Click **View** → **Logs** while script is running
2. See console output in real-time

## Troubleshooting

### Issue: Script doesn't run automatically
**Solution:** Run `setupTrigger` again and check the **Triggers** tab (⏰ icon)

### Issue: "Could not extract amount"
**Solution:** Your bank's email format is different. Check the email and update regex patterns in `extractAmount()` function.

### Issue: Wrong store name extracted
**Solution:** Check the email content and update patterns in `extractStoreName()` function.

### Issue: "Authorization required"
**Solution:** 
1. Click **Run**
2. Click **Review permissions**
3. Choose your account
4. Click **Advanced** → **Go to [project name]**
5. Click **Allow**

## Manual Processing

Process all unread emails at once:
1. Select `manualProcessUnreadEmails` from dropdown
2. Click **Run** ▶️
3. Check logs to see results

## Disabling Auto-Trigger

To stop automatic processing:
1. Select `removeTrigger` from dropdown
2. Click **Run** ▶️

## Sample Bank Email Formats

Your bank emails should look something like this:

```
Subject: Transaction Alert

Your credit card ending in 1234 was used for a 
purchase of $45.67 at STARBUCKS on 11/08/2025.

Transaction details:
Merchant: STARBUCKS #12345
Amount: $45.67
Date: 11/08/2025
```

The script extracts:
- **Amount**: $45.67
- **Store**: STARBUCKS
- **Date**: 11/08/2025
- **Category**: Coffee & Drinks (from lookup table)

## Need Help?

1. Check the **Execution log** for error messages
2. Run `testProcessLatestEmail()` to see what's being extracted
3. Review the README.md for detailed documentation
4. Check your bank email format matches the parser patterns
