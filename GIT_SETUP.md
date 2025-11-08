# Quick Git & GitHub Setup Guide

## Step 1: Initialize Git Repository

```bash
cd /Users/zdravkodonev/projects/toshl-integration
git init
git add .
git commit -m "Initial commit: Toshl integration webapp"
```

## Step 2: Create GitHub Repository (Web Browser)

1. Open your browser and go to: **https://github.com/new**
2. Fill in the form:
   - **Repository name**: `toshl-integration`
   - **Description**: "Gmail to Toshl Finance integration with category management webapp"
   - **Visibility**: ⭐ **Private** (recommended - keeps your tokens safe)
   - **DO NOT** check "Initialize this repository with a README" (you already have files)
3. Click **"Create repository"**

## Step 3: Connect & Push to GitHub

After creating the repo, GitHub will show you commands. Use these:

```bash
# Make sure you're on the main branch
git branch -M main

# Add GitHub as remote (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/toshl-integration.git

# Push your code
git push -u origin main
```

**Example** (if your GitHub username is `zdravkodonev`):
```bash
git branch -M main
git remote add origin https://github.com/zdravkodonev/toshl-integration.git
git push -u origin main
```

You'll be prompted for your GitHub credentials:
- Username: your GitHub username
- Password: use a **Personal Access Token** (not your actual password)

### How to Create a Personal Access Token

If you don't have a token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name it: "Toshl Integration"
4. Select scopes: ✅ **repo** (full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing

## Step 4: Verify

After pushing, check:
```bash
# View your remote
git remote -v

# Should show:
# origin  https://github.com/YOUR-USERNAME/toshl-integration.git (fetch)
# origin  https://github.com/YOUR-USERNAME/toshl-integration.git (push)
```

Visit `https://github.com/YOUR-USERNAME/toshl-integration` in your browser to see your repo!

## Step 5: Deploy to Vercel

Now you're ready to deploy:

1. Go to: **https://vercel.com**
2. Click **"Sign in with GitHub"** (or your preferred method)
3. Click **"New Project"**
4. Find your `toshl-integration` repository and click **"Import"**
5. Vercel will auto-detect the Next.js app in the `webapp` folder
6. **Add Environment Variables**:
   - Click "Environment Variables"
   - Add:
     - Key: `MONGODB_URI`, Value: `your-mongodb-connection-string-here`
     - Key: `MONGODB_DB`, Value: `toshl`
7. Click **"Deploy"**

Wait 1-2 minutes for deployment to complete!

## Step 6: Get Your Vercel URL

After deployment:
1. You'll see: **"Congratulations! Your project has been deployed."**
2. Your URL will be something like: `https://toshl-integration.vercel.app`
3. Click "Visit" to see your webapp!

## Step 7: Update Google Apps Script

1. Open your Google Apps Script editor
2. Find the `CONFIG` object (around line 2-10)
3. Update this line:
   ```javascript
   MONGODB_APP_BASE_URL: 'https://toshl-integration.vercel.app/api',
   ```
   Replace with your actual Vercel URL!
4. Save (Ctrl+S or Cmd+S)

## Test Everything!

1. **Test MongoDB Connection**:
   - In Google Apps Script, run function: `testMongoDBConnection()`
   - Should show success!

2. **Test Web App**:
   - Open your Vercel URL on your phone
   - Try adding a store mapping
   - Check MongoDB to see it was saved

3. **Test Email Processing**:
   - Run function: `testProcessLatestEmail()`
   - Check if it successfully processes an email

## All Done! 🎉

Your integration is now live and accessible from your phone!

## Troubleshooting

**Problem: "Permission denied" when pushing**
```bash
# Make sure you're using a Personal Access Token, not your password
# Create one at: https://github.com/settings/tokens
```

**Problem: "fatal: remote origin already exists"**
```bash
# Remove the old remote and add the new one
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/toshl-integration.git
git push -u origin main
```

**Problem: ".env.local appears in git status"**
```bash
# Remove it from git tracking
git rm --cached webapp/.env.local
git commit -m "Remove .env.local from tracking"
git push
```

**Problem: "Vercel can't find my app"**
- Check that `vercel.json` exists in the root directory
- Make sure it contains: `"rootDirectory": "webapp"`
- Try redeploying

## Need Help?

- GitHub Docs: https://docs.github.com/en/get-started/quickstart
- Vercel Docs: https://vercel.com/docs
- Git Tutorial: https://git-scm.com/docs/gittutorial
