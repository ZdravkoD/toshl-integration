# Duplicate Audit

Standalone Toshl duplicate-audit scripts live in this folder so they do not mix with the Apps Script or webapp code.

## What the audit does

The main script fetches Toshl entries in paginated chunks and produces two reports:

- `exact-duplicates`: same type, date, account, currency, rounded amount, normalized description, and category
- `probable-duplicates`: same type, date, account, currency, rounded amount, and normalized description, but a category mismatch or other minor variation

By default it excludes:

- transfer-style `transaction` entries
- repeating entries
- `reconciliation` entries

Those are common sources of false positives.

## Usage

```bash
TOSHL_ACCESS_TOKEN=... node scripts/duplicates/audit.js --from 2025-01-01 --to 2026-04-05
```

Or via npm:

```bash
TOSHL_ACCESS_TOKEN=... npm run audit:duplicates -- --from 2025-01-01 --to 2026-04-05
```

## Output

Default output folder:

```text
scripts/duplicates/output/
```

Files:

- `summary.json`
- `exact-duplicates.json`
- `exact-duplicates.csv`
- `probable-duplicates.json`
- `probable-duplicates.csv`
- `cleanup-plan.json`
- `cleanup-plan.csv`
- `cleanup-result.json` after an applied cleanup

## Recommended workflow

1. Run the audit across the date range you care about.
2. Review `exact-duplicates.csv` first.
3. Review `probable-duplicates.csv` second.
4. Manually confirm before deleting anything from Toshl.

## Useful flags

```bash
--include-transactions
--include-repeats
--include-reconciliation
--exact-only
--outdir /custom/path
--verbose
```

## Cleanup workflow

Prepare a deletion plan without modifying Toshl:

```bash
TOSHL_ACCESS_TOKEN=... npm run cleanup:duplicates
```

Apply the deletion plan:

```bash
TOSHL_ACCESS_TOKEN=... npm run cleanup:duplicates -- --apply
```

Process only the first few groups:

```bash
TOSHL_ACCESS_TOKEN=... npm run cleanup:duplicates -- --limit 3 --apply
```
