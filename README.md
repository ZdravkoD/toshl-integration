# Gmail to Toshl Finance Integration
## Google Apps Script

Automatically track credit card expenses from Gmail to Toshl Finance using Google Apps Script. This script triggers automatically whenever you receive a new email from your bank!

## Features

- ⚡ **Automatic Trigger** - Runs automatically on every new email (no servers needed!)
- � **Smart Email Parsing** - Extracts store name, amount, and transaction date
- 🏷️ **Category Mapping** - Customizable store-to-category lookup table
- 💰 **Toshl Integration** - Creates expenses automatically via Toshl Finance API
- ✅ **Email Labeling** - Marks processed emails with custom label
- 🎯 **Default Category** - Falls back to "General" for unmapped stores
- 🔒 **Secure** - Runs in your Google account, no external servers

## Prerequisites

- Gmail account that receives bank transaction notifications
- Toshl Finance account with API access token
- 5 minutes to set up!

## Setup Instructions

### Step 1: Create Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **"New Project"**
3. Name your project (e.g., "Gmail to Toshl Integration")

### Step 2: Add the Code

1. Delete any default code in the editor
2. Copy the entire contents of `Code.gs` from this repository
3. Paste it into the Apps Script editor
4. Click the **Save** icon (💾)

### Step 3: Configure Settings

Edit the `CONFIG` section at the top of the script:

```javascript
const CONFIG = {
  // Your Toshl Finance Access Token
  TOSHL_ACCESS_TOKEN: 'YOUR_TOSHL_ACCESS_TOKEN_HERE',
  
  // Your bank's email address
  BANK_EMAIL: 'alerts@yourbank.com', // ⚠️ UPDATE THIS
  
  // Optional: Customize email search query
  EMAIL_SEARCH_QUERY: 'subject:(credit card OR purchase OR transaction)',
  
  // Currency code
  CURRENCY: 'USD',
  
  // Label for processed emails
  PROCESSED_LABEL: 'Toshl/Processed',
  
  // Add your own store mappings
  STORE_CATEGORIES: {
    'AMAZON': 'Shopping',
    'STARBUCKS': 'Coffee & Drinks',
    // ... add more
  }
};
```

**Important:** Make sure to update `BANK_EMAIL` with your bank's actual email address!

### Step 4: Test the Connection

1. In the Apps Script editor, select **`testToshlConnection`** from the function dropdown
2. Click **Run** (▶️)
3. Click **Review permissions** when prompted
4. Select your Google account
5. Click **Advanced** → **Go to [Your Project Name] (unsafe)**
6. Click **Allow**
7. Check the **Execution log** - you should see "✓ Toshl API connection successful!"

### Step 5: Test Email Processing

1. Make sure you have at least one email from your bank in Gmail
2. Select **`testProcessLatestEmail`** from the function dropdown
3. Click **Run** (▶️)
4. Check the **Execution log** for results
5. Verify the expense was created in Toshl Finance

### Step 6: Install the Automatic Trigger

1. Select **`setupTrigger`** from the function dropdown
2. Click **Run** (▶️)
3. Check the log - you should see "✓ Email trigger installed successfully!"

**Done!** 🎉 The script will now run automatically whenever you receive a new email from your bank.

## How It Works

1. **Email Arrives** → Google detects new email from your bank
2. **Trigger Fires** → `onNewEmail()` function runs automatically
3. **Parse Email** → Extracts store name, amount, and date using regex patterns
4. **Lookup Category** → Matches store to category (or uses "General")
5. **Create Expense** → Calls Toshl Finance API to create expense entry
6. **Label Email** → Marks email with "Toshl/Processed" label

## Customization

### Add More Store Categories

Edit the `STORE_CATEGORIES` object in the `CONFIG` section:

```javascript
STORE_CATEGORIES: {
  'WALMART': 'Groceries',
  'SHELL': 'Gas & Fuel',
  'UBER': 'Transportation',
  'YOUR_STORE': 'Your Category'
}
```

**Matching is case-insensitive and supports partial matching!**

### Customize Email Parsing

If your bank's email format is different, you can modify the regex patterns in these functions:
- `extractAmount()` - For finding transaction amounts
- `extractStoreName()` - For finding merchant/store names
- `extractDate()` - For finding transaction dates

### Change Currency

Update the `CURRENCY` field in `CONFIG`:

```javascript
CURRENCY: 'EUR',  // or GBP, CAD, etc.
```

## Manual Functions

You can manually run these functions from the Apps Script editor:

| Function | Description |
|----------|-------------|
| `testToshlConnection()` | Test your Toshl API connection |
| `testProcessLatestEmail()` | Test with your most recent bank email |
| `manualProcessUnreadEmails()` | Process all unread bank emails at once |
| `setupTrigger()` | Install the automatic email trigger |
| `removeTrigger()` | Disable the automatic trigger |

## Monitoring & Logs

To view execution logs:
1. In Apps Script editor, click **Executions** (clock icon on left sidebar)
2. See all script runs, including automatic triggers
3. Click any execution to see detailed logs

## Troubleshooting

### No emails being processed

**Check:**
- `BANK_EMAIL` is correct in CONFIG
- You have unread emails from your bank
- Emails contain keywords like "purchase", "transaction", or "credit card"
- Run `testProcessLatestEmail()` to see what's happening

### "Could not extract amount/store name"

**Solution:** Your bank's email format is different. 
1. Find a sample bank email
2. Update the regex patterns in `extractAmount()` or `extractStoreName()`
3. Test with `testProcessLatestEmail()`

### "Error creating expense in Toshl"

**Check:**
- Your `TOSHL_ACCESS_TOKEN` is correct
- Run `testToshlConnection()` to verify
- Check Toshl Finance API status

### Trigger not firing automatically

**Solutions:**
- Run `setupTrigger()` again
- Check **Triggers** (clock icon) to see if trigger exists
- Make sure you authorized the script with permissions

## Email Format Examples

The script currently handles formats like:

```
"Transaction of $123.45 at STARBUCKS on 11/08/2025"
"Your card was charged $50.00 at AMAZON"
"Purchase at SHELL for $45.67"
"Amount: $29.99 - Merchant: WALMART"
```

## Security & Privacy

- ✅ Runs entirely in **your** Google account
- ✅ No external servers or third-party access
- ✅ Your Toshl token stays in your script
- ✅ Only reads emails from your specified bank
- ⚠️ Keep your `TOSHL_ACCESS_TOKEN` secure
- ⚠️ Don't share your script publicly with credentials

## File Structure

```
toshl-integration/
├── Code.gs                     # Google Apps Script (main file)
├── README.md                   # This file
└── [Legacy Python files]       # Can be ignored
```

## Advanced: Processing Historical Emails

To process old emails that arrived before you set up the trigger:

1. Run **`manualProcessUnreadEmails()`** from the editor
2. This processes up to 50 unread emails from your bank
3. Already-processed emails (with label) are skipped

## Limitations

- Gmail trigger may have slight delays (usually within 1 minute)
- Processes up to 50 emails at once in manual mode
- Requires bank emails to have consistent format
- Only supports one bank email address (can be modified for multiple)

## Support

For issues with:
- **Google Apps Script**: See [Apps Script Documentation](https://developers.google.com/apps-script)
- **Toshl Finance API**: See [Toshl API Documentation](https://developer.toshl.com/)
- **Gmail Triggers**: See [Simple Triggers Guide](https://developers.google.com/apps-script/guides/triggers)

## License

This project is provided as-is for personal use.

---

**Enjoy automated expense tracking!** 🚀
