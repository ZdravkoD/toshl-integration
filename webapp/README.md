# Toshl Integration Web App

Mobile-friendly web application for managing Toshl Finance transaction categories and pending transactions.

## Features

- 📱 **Mobile-Friendly UI** - Responsive design optimized for phone access
- 🔄 **Store Category Mappings** - Map store names to Toshl Finance categories
- ⏳ **Pending Transactions** - View and process transactions awaiting category assignment
- 🔌 **REST API** - Endpoints for Google Apps Script integration
- 🗄️ **MongoDB Integration** - Direct connection to MongoDB Atlas

## API Endpoints

### Get Category
```
GET /api/getCategory?store_name=STORE_NAME
Response: { "category": "Category Name" } or { "category": null }
```

### Save Pending Transaction
```
POST /api/savePending
Body: {
  "store_name": "string",
  "amount": number,
  "currency": "string",
  "date": "YYYY-MM-DD",
  "email_id": "string"
}
Response: { "success": true, "insertedId": "..." }
```

### Get Pending Transactions
```
GET /api/getPending
Response: { "documents": [...] }
```

### Mark Transaction as Processed
```
POST /api/markProcessed?id=TRANSACTION_ID
Response: { "success": true, "matched": 1, "modified": 1 }
```

### Manage Store Mappings
```
GET /api/mappings
Response: { "mappings": [...] }

POST /api/mappings
Body: { "store_name": "string", "category": "string" }
Response: { "success": true, "upsertedId": "...", "modified": false }
```

## Local Development

1. **Install Dependencies**
```bash
cd webapp
npm install
```

2. **Configure Environment**
Copy the example file and add your credentials:
```bash
cp .env.example .env.local
```

Then edit `.env.local`:
```env
MONGODB_URI=your-mongodb-connection-string-here
MONGODB_DB=toshl
```

> **⚠️ SECURITY**: Never commit `.env.local` to git! It's already in `.gitignore`.

3. **Run Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel (Free)

### One-Click Deploy
1. **Push code to GitHub** (see Security Notes below first!)
2. Go to [vercel.com](https://vercel.com)
3. Sign in with GitHub
4. Click "New Project"
5. Import your repository
6. **Important**: Set "Root Directory" to `webapp` (or use the root `vercel.json` config)
7. Add environment variables in Vercel dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `MONGODB_DB`: `toshl`
8. Click "Deploy"

> **Note**: The root `vercel.json` file tells Vercel to build from the `webapp` subdirectory.

### CLI Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd webapp
vercel

# Add environment variables via dashboard
# Then redeploy
vercel --prod
```

Your app will be available at: `https://your-project.vercel.app`

## Update Google Apps Script

After deployment, update `Code.gs` with your Vercel URL:

```javascript
const CONFIG = {
  // ... other config
  MONGODB_APP_BASE_URL: 'https://your-project.vercel.app/api',
  // ... rest of config
};
```

The script will now call:
- `https://your-project.vercel.app/api/getCategory`
- `https://your-project.vercel.app/api/savePending`
- `https://your-project.vercel.app/api/getPending`
- `https://your-project.vercel.app/api/markProcessed`

## Mobile Access

Once deployed, you can:
1. Add the Vercel URL to your phone's home screen
2. Access it anytime to manage categories
3. Process pending transactions on the go

## Project Structure

```
webapp/
├── pages/
│   ├── api/              # API endpoints
│   │   ├── getCategory.ts
│   │   ├── savePending.ts
│   │   ├── getPending.ts
│   │   ├── markProcessed.ts
│   │   └── mappings.ts
│   ├── index.tsx         # Dashboard
│   ├── pending.tsx       # Pending transactions page
│   ├── mappings.tsx      # Store mappings management
│   └── _app.tsx          # App wrapper
├── lib/
│   └── mongodb.ts        # MongoDB connection
├── styles/
│   ├── globals.css
│   └── Home.module.css
├── package.json
├── tsconfig.json
├── next.config.js
└── vercel.json           # Deployment config
```

## MongoDB Collections

### merchants
```javascript
{
  store_name: "MR. BRICOLAGE SOFIA 3",
  category: "Shopping",
  updated_at: ISODate("2024-01-15T10:30:00Z")
}
```

### pending_transactions
```javascript
{
  store_name: "UNKNOWN STORE",
  amount: 665.15,
  currency: "BGN",
  date: "2024-01-15",
  email_id: "msg_abc123",
  created_at: ISODate("2024-01-15T10:30:00Z"),
  processed: false,
  processed_at: ISODate("2024-01-15T11:00:00Z")  // set when processed
}
```

## Workflow

1. **Email arrives** → Google Apps Script parses it
2. **Check category** → Script calls `/api/getCategory`
3. **If found** → Create Toshl expense, mark email as "Processed"
4. **If not found** → Call `/api/savePending`, mark email as "Pending"
5. **User opens webapp** → See pending transactions
6. **Add mapping** → Click transaction → Enter category → Save
7. **Auto-reprocess** → Google Apps Script webhook can be triggered to reprocess
8. **Future emails** → Automatically categorized with new mapping

## Security Notes

### Before Pushing to GitHub

**✅ Safe to commit:**
- All code files (`.ts`, `.tsx`, `.js`, `.css`)
- `package.json`, `tsconfig.json`, `next.config.js`
- `.env.example` (template without real credentials)
- `vercel.json` (deployment config)
- Documentation files

**❌ NEVER commit:**
- `.env.local` (contains your MongoDB password!)
- `.env` files with real credentials
- `node_modules/` (dependencies)
- `.next/` (build output)

The `.gitignore` files are already configured to protect sensitive files.

### Environment Variables in Vercel

When deploying to Vercel, add your credentials in the Vercel dashboard under:
**Project Settings → Environment Variables**

This keeps them secure and separate from your code.

### MongoDB Security

Make sure to whitelist Vercel's IP addresses in MongoDB Atlas:
- Go to Network Access in MongoDB Atlas
- Add IP: `0.0.0.0/0` (allows all IPs - necessary for Vercel's dynamic IPs)
- Or use Vercel's IP ranges if you prefer more restriction

## Support

For issues or questions:
- Check MongoDB Atlas connection
- Verify environment variables in Vercel
- Check Google Apps Script logs
- Review API endpoint responses in browser console
