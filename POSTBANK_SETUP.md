# Postbank Bulgaria Integration - Updated

## What Changed

The email parsing has been completely updated to handle **Postbank Bulgaria** transaction notifications in both Bulgarian and English.

## Sample Email Format

```
Успешна трансакция с кредитна карта от Пощенска банка Mastercard World Premium XX-4020 на стойност 665.15 BGN в MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI на 07.11.2025 20:03:38

Successfull transaction with Postbank credit card Mastercard World Premium XX-4020 for amount 665.15 BGN at MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI. 07.11.2025 20:03:38
```

## Extraction Results

From the above email, the script extracts:

- **Amount**: 665.15 BGN → **339.83 EUR** (automatically converted)
- **Store**: MR. BRICOLAGE SOFIA 3
- **Date**: 07.11.2025 (DD.MM.YYYY format)
- **Category**: Home (from lookup table)

## Currency Conversion

All expenses are automatically converted to **EUR** before being sent to Toshl Finance:

### Current Exchange Rates (in CONFIG)

```javascript
EXCHANGE_RATES: {
  'EUR': 1.0,
  'USD': 0.92,      // ~1 USD = 0.92 EUR
  'BGN': 0.51       // BGN is pegged at 1.95583 BGN = 1 EUR
}
```

**Note**: Update these rates periodically or use a live API for real-time rates.

### Supported Currencies

- **BGN** (Bulgarian Lev) - Primary currency for Postbank Bulgaria
- **EUR** (Euro)
- **USD** (US Dollar)

The script detects the currency from the email and converts automatically.

## How the Parser Works

### 1. Amount & Currency Extraction

The parser looks for these patterns:

**Bulgarian:**
- `на стойност 665.15 BGN`

**English:**
- `for amount 665.15 BGN`

### 2. Store Name Extraction

**Bulgarian:**
- `в MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI`
  - Looks for text after "в" (Bulgarian for "at/in")
  - Removes backslash duplicates

**English:**
- `at MR. BRICOLAGE SOFIA 3\MR. BRICOLAGE SOFI`
  - Looks for text after "at"
  - Cleans up duplicate merchant names

### 3. Date Extraction

**Postbank Format:**
- `07.11.2025 20:03:38` (DD.MM.YYYY HH:MM:SS)
- Parses DD.MM.YYYY format correctly
- Converts to ISO format (YYYY-MM-DD) for Toshl

## Testing Your Setup

### 1. Test Parsing Logic

Run the new `testEmailParsing` function:

1. Open your script in Apps Script editor
2. Select **`testEmailParsing`** from dropdown
3. Click **Run** ▶️
4. Check the log output

**Expected output:**
```
Store: MR. BRICOLAGE SOFIA 3
Amount: 339.83 EUR
Date: 2025-11-07
Category: Home
```

### 2. Test with Real Email

1. Select **`testProcessLatestEmail`**
2. Click **Run** ▶️
3. Verify it processes your actual Postbank email

### 3. Test Toshl Connection

1. Select **`testToshlConnection`**
2. Click **Run** ▶️
3. Should show: "✓ Toshl API connection successful!"

## Configuration Updates

### Updated CONFIG Values

```javascript
const CONFIG = {
  TOSHL_ACCESS_TOKEN: 'YOUR_TOSHL_ACCESS_TOKEN_HERE',
  BANK_EMAIL: 'statements@postbank.bg',
  EMAIL_SEARCH_QUERY: 'subject:(Успешна трансакция с кредитна карта)',
  CURRENCY: 'EUR',  // Changed from BGN - everything goes to Toshl in EUR
  
  EXCHANGE_RATES: {
    'EUR': 1.0,
    'USD': 0.92,
    'BGN': 0.51
  },
  
  STORE_CATEGORIES: {
    'MR. BRICOLAGE SOFIA': 'Home',  // Already configured
    // Add more stores as needed
  }
};
```

## Adding More Stores

As you get emails from different merchants, add them to `STORE_CATEGORIES`:

```javascript
STORE_CATEGORIES: {
  'MR. BRICOLAGE': 'Home',
  'KAUFLAND': 'Groceries',
  'LIDL': 'Groceries',
  'BILLA': 'Groceries',
  'OMV': 'Gas & Fuel',
  'SHELL': 'Gas & Fuel',
  'VIVACOM': 'Utilities',
  'YETTEL': 'Utilities',
  // ... add your common stores
}
```

## Common Bulgarian Stores

Here are some suggestions for Bulgarian stores:

```javascript
'KAUFLAND': 'Groceries',
'LIDL': 'Groceries',
'BILLA': 'Groceries',
'FANTASTICO': 'Groceries',
'METRO': 'Groceries',
'OMV': 'Gas & Fuel',
'SHELL': 'Gas & Fuel',
'LUKOIL': 'Gas & Fuel',
'MR. BRICOLAGE': 'Home',
'PRAKTIKER': 'Home',
'IKEA': 'Home',
'CCC': 'Shopping',
'H&M': 'Shopping',
'ZARA': 'Shopping',
'MALL.BG': 'Shopping',
'TAKEAWAY': 'Food & Dining',
'GLOVO': 'Food & Dining',
'MCDONALDS': 'Food & Dining',
'KFC': 'Food & Dining',
'YETTEL': 'Utilities',
'VIVACOM': 'Utilities',
'A1': 'Utilities'
```

## Updating Exchange Rates

### Manual Update

Edit the `EXCHANGE_RATES` in CONFIG:

```javascript
EXCHANGE_RATES: {
  'EUR': 1.0,
  'USD': 0.92,  // Update this value
  'BGN': 0.51   // BGN is pegged to EUR, rarely changes
}
```

### BGN to EUR Rate

The BGN (Bulgarian Lev) is **pegged to the Euro** at a fixed rate:
- **1 EUR = 1.95583 BGN**
- **1 BGN = 0.51129 EUR**

So the BGN rate should rarely need updating (it's fixed by the Bulgarian National Bank).

### Where to Get Current Rates

- [ECB Exchange Rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/)
- [XE Currency Converter](https://www.xe.com/)

## Troubleshooting

### "Could not extract amount"

**Check:**
1. The email contains "на стойност X.XX BGN" or "for amount X.XX BGN"
2. Run `testEmailParsing()` to see what the parser detects
3. Check the log for the email body excerpt

### "Could not extract store name"

**Check:**
1. The email contains "в STORE NAME на DD.MM.YYYY" or "at STORE NAME. DD.MM.YYYY"
2. The store name is in UPPERCASE
3. Run `testEmailParsing()` to debug

### Wrong amount in Toshl

**Check:**
1. The exchange rate in `EXCHANGE_RATES` is correct
2. Look at the log - it shows: "Converted X.XX BGN to Y.YY EUR"
3. Verify: Amount in BGN × 0.51 ≈ Amount in EUR

### Date format issues

The script handles DD.MM.YYYY format from Postbank emails. If dates appear wrong, check the log to see what was extracted.

## Next Steps

1. ✅ Run `testEmailParsing()` to verify parsing works
2. ✅ Run `testProcessLatestEmail()` to test with real email
3. ✅ Run `setupTrigger()` to enable automatic processing
4. ✅ Update `STORE_CATEGORIES` as you receive new emails
5. ✅ Periodically update USD exchange rate (BGN is fixed)

## Live Monitoring

After setting up the trigger:

1. Go to **Executions** (⏰ icon in sidebar)
2. See all automatic runs when new emails arrive
3. Click any execution to see detailed logs
4. Verify amounts are correctly converted to EUR

---

**All expenses will now be tracked in EUR in Toshl Finance!** 🇪🇺
