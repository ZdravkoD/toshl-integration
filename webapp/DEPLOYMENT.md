# Webapp Deployment Guide

## Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
cd webapp
npm install
```

### Step 2: Test Locally
```bash
npm run dev
```
Open http://localhost:3000 - you should see the dashboard.

### Step 3: Deploy to Vercel

**Option A: GitHub + Vercel Dashboard (Recommended)**
1. Create a GitHub repository
2. Push this code:
   ```bash
   git add .
   git commit -m "Add Toshl integration webapp"
   git push
   ```
3. Go to https://vercel.com
4. Click "New Project"
5. Import your repository
6. Add environment variables:
   - `MONGODB_URI` = Your MongoDB connection string from Atlas
   - `MONGODB_DB` = `toshl`
7. Click "Deploy"

**Option B: Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel
# Follow prompts, then add env vars in dashboard
vercel --prod
```

### Step 4: Get Your URL
After deployment, Vercel gives you a URL like:
```
https://toshl-integration.vercel.app
```

### Step 5: Update Google Apps Script
Open your `Code.gs` file and update line 3:

**Before:**
```javascript
MONGODB_APP_BASE_URL: 'https://REGION.aws.data.mongodb-api.com/app/YOUR-APP-ID/endpoint',
```

**After:**
```javascript
MONGODB_APP_BASE_URL: 'https://toshl-integration.vercel.app/api',
```

Save and you're done! 🎉

## Testing the Integration

### Test API Endpoints

1. **Test Category Lookup** (should return null for new store):
   ```
   https://toshl-integration.vercel.app/api/getCategory?store_name=TEST_STORE
   ```

2. **Add a mapping** via the webapp:
   - Go to https://toshl-integration.vercel.app/mappings
   - Add: Store = "LIDL", Category = "Groceries"
   - Click "Add Mapping"

3. **Test again** (should return category):
   ```
   https://toshl-integration.vercel.app/api/getCategory?store_name=LIDL
   ```
   Should return: `{"category":"Groceries"}`

### Test Google Apps Script

In your Google Apps Script editor, run:
```javascript
testMongoDBConnection()  // Should show success with your Vercel URL
```

## Add to Phone Home Screen

### iPhone (Safari)
1. Open your Vercel URL in Safari
2. Tap the Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Name it "Toshl Manager"
5. Tap "Add"

### Android (Chrome)
1. Open your Vercel URL in Chrome
2. Tap the three dots menu
3. Tap "Add to Home screen"
4. Name it "Toshl Manager"
5. Tap "Add"

## Troubleshooting

### Deployment fails
- Check that `package.json` is in the `webapp` folder
- Make sure you're deploying from the `webapp` directory
- Verify Next.js version compatibility

### API returns 500 errors
- Check environment variables in Vercel dashboard
- Verify MongoDB connection string is correct
- Check Vercel function logs

### Can't connect to MongoDB
- Whitelist all IPs in MongoDB Atlas: `0.0.0.0/0`
- Verify connection string includes password
- Check database name is "toshl"

### Google Apps Script can't reach API
- Make sure URL ends with `/api` (not `/api/`)
- Test endpoints directly in browser first
- Check for CORS issues (Vercel handles this by default)

## Vercel Free Tier Limits

- ✅ **Unlimited deployments**
- ✅ **100 GB bandwidth/month** (plenty for this use case)
- ✅ **Serverless functions** (API routes)
- ✅ **Automatic HTTPS**
- ✅ **Global CDN**

Your integration will run perfectly on the free tier!

## Updating the App

Just push to GitHub:
```bash
git add .
git commit -m "Update feature"
git push
```

Vercel automatically redeploys! 🚀

## Alternative Free Hosting Options

If you prefer not to use Vercel:

1. **Netlify** - Similar to Vercel, great DX
2. **Railway** - Good for full-stack apps
3. **Render** - Free tier with some limitations
4. **Fly.io** - Container-based deployment

All support Next.js and environment variables.
