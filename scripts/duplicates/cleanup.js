#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const TOSHL_API_BASE = 'https://api.toshl.com';
const DEFAULT_INPUT = path.join(__dirname, 'output', 'exact-duplicates.json');
const DEFAULT_OUTDIR = path.join(__dirname, 'output');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    outdir: DEFAULT_OUTDIR,
    apply: false,
    limit: null,
    verbose: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];

    if (part === '--input') {
      args.input = path.resolve(argv[++index]);
    } else if (part === '--outdir') {
      args.outdir = path.resolve(argv[++index]);
    } else if (part === '--apply') {
      args.apply = true;
    } else if (part === '--limit') {
      args.limit = Number(argv[++index]);
    } else if (part === '--verbose') {
      args.verbose = true;
    } else if (part === '--help' || part === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${part}`);
    }
  }

  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive number.');
  }

  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/duplicates/cleanup.js [options]',
      '',
      'Options:',
      '  --input PATH      Exact duplicate report JSON. Default: scripts/duplicates/output/exact-duplicates.json',
      '  --outdir PATH     Output folder. Default: scripts/duplicates/output',
      '  --apply           Delete duplicate entries from Toshl',
      '  --limit N         Only process the first N duplicate groups',
      '  --verbose         Print each deletion as it happens',
      '  --help            Show this help',
      '',
      'Environment:',
      '  TOSHL_ACCESS_TOKEN or TOSHL_API_TOKEN must be set when using --apply.',
      '',
      'Behavior:',
      '  By default this script is a dry run. It writes a deletion plan and does not modify Toshl.'
    ].join('\n') + '\n'
  );
}

function getToken() {
  const token = process.env.TOSHL_ACCESS_TOKEN || process.env.TOSHL_API_TOKEN;

  if (!token) {
    throw new Error('Missing Toshl API token. Set TOSHL_ACCESS_TOKEN or TOSHL_API_TOKEN.');
  }

  return token;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function csvEscape(value) {
  const scalar = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(scalar)) {
    return `"${scalar.replace(/"/g, '""')}"`;
  }

  return scalar;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '', 'utf8');
    return;
  }

  const header = Object.keys(rows[0]);
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map(key => csvEscape(row[key])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function loadDuplicateGroups(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input report not found: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${filePath}`);
  }

  return parsed;
}

function flattenDeletionPlan(groups) {
  const rows = [];

  for (const group of groups) {
    for (const duplicateId of group.duplicateIds || []) {
      rows.push({
        kind: group.kind,
        date: group.date,
        type: group.type,
        currency: group.currency,
        amount: Number(group.amount || 0).toFixed(2),
        category: group.category || '',
        normalizedDesc: group.normalizedDesc || '',
        keepId: group.keepId,
        deleteId: duplicateId
      });
    }
  }

  return rows;
}

async function deleteEntry(id, token) {
  const response = await fetch(`${TOSHL_API_BASE}/entries/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to delete entry ${id} (${response.status}): ${body || response.statusText}`);
  }
}

async function applyDeletionPlan(rows, verbose) {
  const token = getToken();
  const deletedIds = [];

  for (const row of rows) {
    await deleteEntry(row.deleteId, token);
    deletedIds.push(row.deleteId);

    if (verbose) {
      process.stdout.write(`Deleted ${row.deleteId} (kept ${row.keepId})\n`);
    }
  }

  return deletedIds;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const groups = loadDuplicateGroups(args.input);
  const selectedGroups = args.limit === null ? groups : groups.slice(0, args.limit);
  const deletionRows = flattenDeletionPlan(selectedGroups);

  ensureDir(args.outdir);

  const planSummary = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    input: args.input,
    groupsSelected: selectedGroups.length,
    entriesToDelete: deletionRows.length
  };

  writeJson(path.join(args.outdir, 'cleanup-plan.json'), {
    summary: planSummary,
    groups: selectedGroups,
    deletions: deletionRows
  });
  writeCsv(path.join(args.outdir, 'cleanup-plan.csv'), deletionRows);

  if (!args.apply) {
    process.stdout.write(
      [
        `Prepared dry-run cleanup plan for ${selectedGroups.length} duplicate groups.`,
        `Entries marked for deletion: ${deletionRows.length}.`,
        `Plan written to ${args.outdir}.`,
        'Re-run with --apply to delete the duplicate entries from Toshl.'
      ].join('\n') + '\n'
    );
    return;
  }

  const deletedIds = await applyDeletionPlan(deletionRows, args.verbose);

  writeJson(path.join(args.outdir, 'cleanup-result.json'), {
    summary: {
      ...planSummary,
      deletedCount: deletedIds.length
    },
    deletedIds
  });

  process.stdout.write(
    [
      `Deleted ${deletedIds.length} duplicate Toshl entries.`,
      `Result written to ${path.join(args.outdir, 'cleanup-result.json')}.`
    ].join('\n') + '\n'
  );
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
