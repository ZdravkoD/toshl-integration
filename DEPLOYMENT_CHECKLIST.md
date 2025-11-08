# Pre-Deployment Checklist

## Before Pushing to GitHub

### 1. Verify Sensitive Files Are Protected
```bash
# Check that .env.local is NOT tracked
git status

# You should NOT see:
# - webapp/.env.local
# - Any files with credentials/passwords
```

### 2. Test .gitignore is Working
```bash
# Add all files
git add .

# Check what will be committed
git status

# ✅ You SHOULD see:
# - All .ts, .tsx, .js files
# - package.json
# - .env.example
# - README.md files

# ❌ You should NOT see:
# - .env.local
# - node_modules/
# - .next/
# - Any credential files
```

### 3. Remove Credentials from Committed Files

**Files to check for hardcoded credentials:**
- [ ] `webapp/README.md` - ✅ Already cleaned
- [ ] `webapp/.env.local` - ✅ Not committed (in .gitignore)
- [ ] Root `Code.gs` - ⚠️ Contains Toshl API token!

**Important**: Your `Code.gs` file contains the Toshl API token. This is OK if:
- The repository is **private** on GitHub, OR
- You remove/redact the token before committing

### 4. Ready to Commit

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Toshl integration webapp"

# Create GitHub repo and push (choose one method):

# Method 1: Manual (No GitHub CLI needed)
# 1. Go to https://github.com/new
# 2. Repository name: toshl-integration
# 3. Select "Private" repository
# 4. DON'T initialize with README (you already have files)
# 5. Click "Create repository"
# 6. Then run these commands:
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/toshl-integration.git
git push -u origin main

# Method 2: Using GitHub CLI (if you have it installed)
# gh repo create toshl-integration --private --source=. --push
```

## Deployment to Vercel

### 5. Deploy
1. Go to https://vercel.com
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the `webapp` folder (thanks to root `vercel.json`)
5. **Add Environment Variables**:
   - `MONGODB_URI` = `your-mongodb-connection-string`
   - `MONGODB_DB` = `toshl`
6. Click "Deploy"

### 6. Post-Deployment

After deployment, you'll get a URL like: `https://toshl-integration.vercel.app`

**Update Google Apps Script:**
1. Open your Google Apps Script
2. Find the `CONFIG` object
3. Update:
   ```javascript
   MONGODB_APP_BASE_URL: 'https://toshl-integration.vercel.app/api',
   ```
4. Save

**Test the Integration:**
1. In Google Apps Script, run: `testMongoDBConnection()`
2. Should show success connecting to your Vercel app
3. Open your Vercel URL on your phone
4. Add a test mapping
5. Run `testProcessLatestEmail()` in Apps Script

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] MongoDB password is NOT in any committed file
- [ ] Toshl API token is only in `Code.gs` (which is in a private repo OR excluded from git)
- [ ] MongoDB Atlas allows Vercel IPs (`0.0.0.0/0` in Network Access)
- [ ] Environment variables are set in Vercel dashboard
- [ ] Tested API endpoints are working

## Quick Reference

**MongoDB Connection String:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
```
⚠️ Keep this secret! Only use in:
- Local `.env.local` file (not committed)
- Vercel environment variables (secure)

**Toshl API Token:**
```
Get from: https://toshl.com/developer/apps/
```
⚠️ Keep this secret! Only use in:
- Google Apps Script (private/not shared)
- Never commit to public repos

## Troubleshooting

**"Vercel can't find my Next.js app"**
- Check that root `vercel.json` exists
- Verify it has `"rootDirectory": "webapp"`

**"Environment variables not working"**
- Make sure you added them in Vercel dashboard
- Redeploy after adding variables

**"MongoDB connection failed"**
- Check MongoDB Atlas Network Access allows `0.0.0.0/0`
- Verify connection string in Vercel env vars
- Check database name is exactly `toshl`

**"Git shows .env.local in changes"**
```bash
# Remove from git tracking
git rm --cached webapp/.env.local

# Verify .gitignore includes it
cat .gitignore | grep .env.local
```
