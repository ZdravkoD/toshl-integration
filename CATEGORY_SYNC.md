# Toshl Category Sync Feature

## Overview

The Google Apps Script now fetches your actual Toshl Finance categories and syncs them to MongoDB, ordered by how frequently you use them. The webapp displays these as "Common Toshl Categories" to make it easier to assign categories to stores.

## How It Works

1. **Google Apps Script** calls the Toshl API to:
   - Fetch all your expense categories
   - Analyze your last 90 days of expenses to count category usage
   - Sort categories by usage frequency (most used first)

2. **Web API** (`/api/syncCategories`) receives and stores:
   - Category name
   - Toshl category ID
   - Category type
   - Usage count
   - Sync timestamp

3. **Webapp** (`/api/getCommonCategories`) displays:
   - Top 20 most-used categories
   - Sorted by usage frequency
   - As clickable buttons on the mappings page

## Setup Instructions

### 1. Update Code.gs

The `Code.gs` file has been updated with these new functions:

- `syncToshlCategoriesToMongoDB()` - Main sync function
- `getAllToshlCategories()` - Fetches all categories from Toshl
- `getCategoryUsageCounts()` - Analyzes last 90 days of expenses
- `runCategorySync()` - Easy test function to run the sync

### 2. Run the Sync

In Google Apps Script editor:

1. Open your script at `script.google.com`
2. Select the function: `runCategorySync`
3. Click **Run** (you may need to authorize the script first)
4. Check the **Execution log** to see results

Example output:
```
=== Running Category Sync ===
=== Syncing Toshl Categories to MongoDB ===
Found 12 categories in Toshl
Analyzed 47 entries for category usage
Top 5 most used categories:
  - Groceries: 15 uses
  - Transportation: 12 uses
  - Dining: 8 uses
  - Entertainment: 6 uses
  - Shopping: 4 uses
✓ Successfully synced 12 categories to MongoDB
✓ Categories synced successfully!
Your webapp will now show your most-used Toshl categories
=== Sync Complete ===
```

### 3. Verify in Webapp

1. Go to your deployed webapp
2. Click "Store Mappings"
3. Scroll to "Common Toshl Categories"
4. You should see your actual categories, sorted by usage

## MongoDB Collection

A new collection `toshl_categories` is created with this structure:

```javascript
{
  _id: ObjectId("..."),
  name: "Groceries",
  toshl_id: "123456",
  type: "expense",
  usage_count: 15,
  synced_at: ISODate("2025-11-09T...")
}
```

## API Endpoints

### POST /api/syncCategories
Receives category data from Google Apps Script and stores it in MongoDB.

**Request:**
```json
{
  "categories": [
    {
      "name": "Groceries",
      "toshl_id": "123456",
      "type": "expense",
      "usage_count": 15
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 12,
  "message": "Synced 12 categories"
}
```

### GET /api/getCommonCategories
Returns the top 20 most-used categories for the webapp.

**Response:**
```json
{
  "categories": ["Groceries", "Transportation", "Dining", ...],
  "count": 20
}
```

## Recommendations

### Sync Frequency

Run the category sync:
- **Initially**: Right after setup
- **Monthly**: To update usage counts as your spending patterns change
- **After major changes**: If you add/remove categories in Toshl

### Automation (Optional)

You can automate the sync by creating a time-based trigger in Google Apps Script:

1. In Apps Script editor: **Triggers** (clock icon on left)
2. Click **+ Add Trigger**
3. Function: `runCategorySync`
4. Event source: **Time-driven**
5. Type: **Week timer**
6. Day: **Sunday** (or your preference)
7. Time: **1am to 2am**
8. Click **Save**

This will automatically update your category usage statistics weekly.

## Benefits

✅ **Accurate categories**: Uses your actual Toshl categories, not hardcoded ones
✅ **Smart sorting**: Most-used categories appear first for faster selection
✅ **Dynamic updates**: Categories update based on your actual spending habits
✅ **Better UX**: One-click category selection instead of typing
✅ **Reduced errors**: Prevents typos in category names

## Troubleshooting

**Categories not showing up?**
- Check Execution log in Apps Script for errors
- Verify your Toshl API token is correct
- Make sure you have expenses in Toshl (last 90 days)

**Sync failed?**
- Check that MONGODB_URI is set correctly in Vercel
- Verify the webapp is deployed and accessible
- Check Vercel function logs for API errors

**Want to force refresh?**
- Just run `runCategorySync()` again in Apps Script
- Old categories are replaced with new data each sync
