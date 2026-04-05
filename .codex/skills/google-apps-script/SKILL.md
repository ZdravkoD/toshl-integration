---
name: google-apps-script
description: Use when working on this repository's Google Apps Script integration, clasp deployment, script properties, Apps Script CI, or tests for the Gmail-to-Toshl script. Applies to the script stored in `gas/Code.js`.
---

# Google Apps Script

Use this skill when the user asks to change, test, deploy, or reason about the Gmail-to-Toshl Apps Script in this repository.

## Source of truth

- Apps Script source file: `gas/Code.js`
- Apps Script manifest: `gas/appsscript.json`
- Clasp config: `.clasp.json`
- Local tests: `tests/run-tests.js`
- Test loader/mocks: `tests/helpers/load-apps-script.js`
- CI workflow: `.github/workflows/apps-script.yml`

Do not reintroduce `Code.gs` at repo root. `gas/Code.js` is the only deployable script source of truth.

## Required Script Properties

These are set in Apps Script and must not be hardcoded in source:

- `TOSHL_ACCESS_TOKEN`
- `BANK_EMAIL`
- `EMAIL_SEARCH_QUERY`
- `WEB_API_BASE_URL`

The script reads them with `PropertiesService.getScriptProperties()`.

## Primary workflow

1. Edit `gas/Code.js`.
2. Run local tests with `npm test`.
3. If changing script deployment behavior, check `.clasp.json`.
4. If changing CI deploy behavior, update `.github/workflows/apps-script.yml`.
5. Keep Apps Script changes compatible with the existing test harness where practical.

## Deployment facts

- `clasp` uses `rootDir: "gas"`.
- Do not add `.claspignore` rules that conflict with `rootDir`.
- GitHub Actions deploys the script on pushes to `main` after tests pass.
- CI also creates an Apps Script version on successful deploy for rollback.

## Testing guidance

- The local tests execute `gas/Code.js` in a Node VM with mocked Apps Script globals.
- Prefer adding unit tests for parsing, config loading, and API wrapper logic.
- If adding new helper functions that are deterministic, add coverage in `tests/run-tests.js`.

## Repo-specific behavior

- The script now deduplicates by Gmail `message.getId()` through the web API, not Gmail thread labels alone.
- It tags Toshl-created entries with `gmail-import`.
- Backfill helper function exists for five months of email import.
