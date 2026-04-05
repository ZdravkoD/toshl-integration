#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const TOSHL_API_BASE = 'https://api.toshl.com';
const DEFAULT_PER_PAGE = 500;
const DEFAULT_FROM = '2025-01-01';
const DEFAULT_TO = new Date().toISOString().slice(0, 10);
const DEFAULT_OUTDIR = path.join(__dirname, 'output');

function parseArgs(argv) {
  const args = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    perPage: DEFAULT_PER_PAGE,
    outdir: DEFAULT_OUTDIR,
    includeTransactions: false,
    includeRepeats: false,
    includeReconciliation: false,
    exactOnly: false,
    verbose: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];

    if (part === '--from') {
      args.from = argv[++index];
    } else if (part === '--to') {
      args.to = argv[++index];
    } else if (part === '--per-page') {
      args.perPage = Number(argv[++index] || DEFAULT_PER_PAGE);
    } else if (part === '--outdir') {
      args.outdir = path.resolve(argv[++index]);
    } else if (part === '--include-transactions') {
      args.includeTransactions = true;
    } else if (part === '--include-repeats') {
      args.includeRepeats = true;
    } else if (part === '--include-reconciliation') {
      args.includeReconciliation = true;
    } else if (part === '--exact-only') {
      args.exactOnly = true;
    } else if (part === '--verbose') {
      args.verbose = true;
    } else if (part === '--help' || part === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${part}`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from) || !/^\d{4}-\d{2}-\d{2}$/.test(args.to)) {
    throw new Error('Dates must be in YYYY-MM-DD format.');
  }

  if (!Number.isFinite(args.perPage) || args.perPage < 1) {
    throw new Error('--per-page must be a positive number.');
  }

  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/duplicates/audit.js [options]',
      '',
      'Options:',
      '  --from YYYY-MM-DD           Start date. Default: 2025-01-01',
      '  --to YYYY-MM-DD             End date. Default: today',
      '  --outdir PATH               Output folder. Default: scripts/duplicates/output',
      '  --per-page N                Toshl page size. Default: 500',
      '  --include-transactions      Include transfer-style entries in the audit',
      '  --include-repeats           Include repeating entries in the audit',
      '  --include-reconciliation    Include reconciliation entries in the audit',
      '  --exact-only                Skip probable duplicate detection',
      '  --verbose                   Print paging progress',
      '  --help                      Show this help',
      '',
      'Environment:',
      '  TOSHL_ACCESS_TOKEN or TOSHL_API_TOKEN must be set.'
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function roundAmount(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeDate(value) {
  return String(value || '').slice(0, 10);
}

function entryType(entry) {
  if (entry.transaction) {
    return 'transaction';
  }

  return Number(entry.amount) >= 0 ? 'income' : 'expense';
}

function isReconciliationEntry(entry) {
  return entry.category === 'reconciliation';
}

function serializeScalar(value) {
  if (Array.isArray(value)) {
    return value.join('|');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function csvEscape(value) {
  const scalar = serializeScalar(value);
  if (/[",\n]/.test(scalar)) {
    return `"${scalar.replace(/"/g, '""')}"`;
  }

  return scalar;
}

async function fetchEntries(args) {
  const token = getToken();
  const entries = [];
  let page = 1;

  while (true) {
    const searchParams = new URLSearchParams({
      from: args.from,
      to: args.to,
      per_page: String(args.perPage),
      page: String(page)
    });

    const response = await fetch(`${TOSHL_API_BASE}/entries?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Toshl API request failed (${response.status}): ${body || response.statusText}`);
    }

    const pageItems = await response.json();
    if (!Array.isArray(pageItems)) {
      throw new Error('Unexpected Toshl API response for /entries.');
    }

    entries.push(...pageItems);

    if (args.verbose) {
      process.stdout.write(`Fetched page ${page} (${pageItems.length} entries)\n`);
    }

    if (pageItems.length < args.perPage) {
      return entries;
    }

    page += 1;
    await sleep(250);
  }
}

function shouldIncludeEntry(entry, args) {
  if (!args.includeTransactions && entry.transaction) {
    return false;
  }

  if (!args.includeRepeats && entry.repeat) {
    return false;
  }

  if (!args.includeReconciliation && isReconciliationEntry(entry)) {
    return false;
  }

  return true;
}

function toComparableEntry(entry) {
  return {
    id: entry.id,
    type: entryType(entry),
    date: normalizeDate(entry.date),
    account: entry.account || '',
    currency: entry.currency && entry.currency.code ? entry.currency.code : '',
    amount: roundAmount(entry.amount),
    normalizedDesc: normalizeText(entry.desc),
    category: entry.category || '',
    tags: Array.isArray(entry.tags) ? [...entry.tags].sort() : [],
    created: entry.created || '',
    modified: entry.modified || '',
    completed: Boolean(entry.completed),
    deleted: Boolean(entry.deleted),
    repeatId: entry.repeat && entry.repeat.id ? String(entry.repeat.id) : '',
    raw: entry
  };
}

function buildExactFingerprint(entry) {
  return [
    entry.type,
    entry.date,
    entry.account,
    entry.currency,
    entry.amount.toFixed(2),
    entry.normalizedDesc,
    entry.category
  ].join('|');
}

function buildProbableFingerprint(entry) {
  return [
    entry.type,
    entry.date,
    entry.account,
    entry.currency,
    entry.amount.toFixed(2),
    entry.normalizedDesc
  ].join('|');
}

function groupEntries(entries, keyBuilder) {
  const groups = new Map();

  for (const entry of entries) {
    const key = keyBuilder(entry);
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(entry);
  }

  return groups;
}

function sortGroupEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftStamp = Date.parse(left.created || left.modified || left.date);
    const rightStamp = Date.parse(right.created || right.modified || right.date);

    if (leftStamp !== rightStamp) {
      return leftStamp - rightStamp;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

function buildDuplicateGroup(kind, key, entries) {
  const sortedEntries = sortGroupEntries(entries);
  const keeper = sortedEntries[0];
  const duplicates = sortedEntries.slice(1);

  return {
    kind,
    fingerprint: key,
    count: sortedEntries.length,
    keepId: keeper.id,
    duplicateIds: duplicates.map(entry => entry.id),
    type: keeper.type,
    date: keeper.date,
    account: keeper.account,
    currency: keeper.currency,
    amount: keeper.amount,
    normalizedDesc: keeper.normalizedDesc,
    category: keeper.category,
    entryIds: sortedEntries.map(entry => entry.id),
    entries: sortedEntries.map(entry => ({
      id: entry.id,
      type: entry.type,
      date: entry.date,
      account: entry.account,
      currency: entry.currency,
      amount: entry.amount,
      desc: entry.raw.desc || '',
      category: entry.category,
      tags: entry.tags,
      created: entry.created,
      modified: entry.modified,
      completed: entry.completed,
      deleted: entry.deleted,
      repeatId: entry.repeatId
    }))
  };
}

function findExactDuplicates(entries) {
  const groups = groupEntries(entries, buildExactFingerprint);
  const duplicateGroups = [];

  for (const [key, groupedEntries] of groups.entries()) {
    if (groupedEntries.length > 1) {
      duplicateGroups.push(buildDuplicateGroup('exact', key, groupedEntries));
    }
  }

  duplicateGroups.sort((left, right) => right.count - left.count || left.date.localeCompare(right.date));
  return duplicateGroups;
}

function findProbableDuplicates(entries, exactFingerprints) {
  const groups = groupEntries(entries, buildProbableFingerprint);
  const probableGroups = [];

  for (const [key, groupedEntries] of groups.entries()) {
    if (groupedEntries.length < 2) {
      continue;
    }

    const distinctExactFingerprints = new Set(groupedEntries.map(buildExactFingerprint));
    if (distinctExactFingerprints.size < 2) {
      continue;
    }

    if ([...distinctExactFingerprints].every(fingerprint => exactFingerprints.has(fingerprint))) {
      continue;
    }

    probableGroups.push(buildDuplicateGroup('probable', key, groupedEntries));
  }

  probableGroups.sort((left, right) => right.count - left.count || left.date.localeCompare(right.date));
  return probableGroups;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function summarizeGroups(groups) {
  return groups.map(group => ({
    kind: group.kind,
    count: group.count,
    keepId: group.keepId,
    duplicateIds: group.duplicateIds.join('|'),
    type: group.type,
    date: group.date,
    account: group.account,
    currency: group.currency,
    amount: group.amount.toFixed(2),
    category: group.category,
    normalizedDesc: group.normalizedDesc
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fetchedEntries = await fetchEntries(args);
  const comparableEntries = fetchedEntries
    .filter(entry => shouldIncludeEntry(entry, args))
    .map(toComparableEntry);

  const exactDuplicates = findExactDuplicates(comparableEntries);
  const exactFingerprints = new Set(exactDuplicates.map(group => group.fingerprint));
  const probableDuplicates = args.exactOnly ? [] : findProbableDuplicates(comparableEntries, exactFingerprints);

  ensureDir(args.outdir);

  const auditSummary = {
    generatedAt: new Date().toISOString(),
    from: args.from,
    to: args.to,
    includedEntries: comparableEntries.length,
    excludedTransactions: args.includeTransactions ? 0 : fetchedEntries.filter(entry => entry.transaction).length,
    excludedRepeats: args.includeRepeats ? 0 : fetchedEntries.filter(entry => entry.repeat).length,
    excludedReconciliation: args.includeReconciliation ? 0 : fetchedEntries.filter(isReconciliationEntry).length,
    exactDuplicateGroups: exactDuplicates.length,
    exactDuplicateEntries: exactDuplicates.reduce((sum, group) => sum + group.count, 0),
    probableDuplicateGroups: probableDuplicates.length,
    probableDuplicateEntries: probableDuplicates.reduce((sum, group) => sum + group.count, 0)
  };

  writeJson(path.join(args.outdir, 'summary.json'), auditSummary);
  writeJson(path.join(args.outdir, 'exact-duplicates.json'), exactDuplicates);
  writeJson(path.join(args.outdir, 'probable-duplicates.json'), probableDuplicates);
  writeCsv(path.join(args.outdir, 'exact-duplicates.csv'), summarizeGroups(exactDuplicates));
  writeCsv(path.join(args.outdir, 'probable-duplicates.csv'), summarizeGroups(probableDuplicates));

  process.stdout.write(
    [
      `Fetched ${fetchedEntries.length} Toshl entries for ${args.from} to ${args.to}.`,
      `Included ${comparableEntries.length} entries after exclusions.`,
      `Exact duplicate groups: ${auditSummary.exactDuplicateGroups}.`,
      `Probable duplicate groups: ${auditSummary.probableDuplicateGroups}.`,
      `Reports written to ${args.outdir}.`
    ].join('\n') + '\n'
  );
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
