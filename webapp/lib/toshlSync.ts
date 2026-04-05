import type { Db } from 'mongodb';
import {
  fetchToshlCollection,
  ToshlAccount,
  ToshlCategory,
  ToshlEntry,
  ToshlTag,
  ToshlClientOptions,
  todayIsoDate
} from './toshl';

const ENTRIES_COLLECTION = 'toshl_entries';
const ACCOUNTS_COLLECTION = 'toshl_accounts';
const CATEGORIES_COLLECTION = 'toshl_categories';
const TAGS_COLLECTION = 'toshl_tags';
const SYNC_STATE_COLLECTION = 'sync_state';
const SYNC_LOCKS_COLLECTION = 'sync_locks';

const DEFAULT_SYNC_START_DATE = '2025-01-01';
const DEFAULT_RECONCILE_DAYS = 90;
const OVERALL_SYNC_LOCK_KEY = 'toshl-full-sync';
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;

export interface SyncRequestOptions {
  startDate?: string;
  endDate?: string;
  reconcileDays?: number;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface ResourceSyncResult {
  resource: string;
  fetched: number;
  upserted: number;
  modified: number;
  deleted: number;
  from?: string;
  to?: string;
}

export interface SyncRunResult {
  startedAt: string;
  finishedAt: string;
  requestedStartDate: string;
  requestedEndDate: string;
  reconcileDays: number;
  resources: ResourceSyncResult[];
}

export interface MonthlyBalanceRow {
  month: string;
  income: number;
  expense: number;
  transfer: number;
  net: number;
  balance: number;
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

function coerceIsoDate(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number) {
  const next = new Date(`${dateIso}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function maxIsoDate(a: string, b: string) {
  return a > b ? a : b;
}

function inferEntryType(entry: ToshlEntry) {
  if (entry.type) {
    return entry.type;
  }

  if (entry.transaction) {
    return 'transaction';
  }

  return Number(entry.amount) >= 0 ? 'income' : 'expense';
}

function convertAmountToEur(entry: ToshlEntry) {
  const amount = Number(entry.amount || 0);
  const currencyCode = entry.currency?.code?.toUpperCase();

  if (currencyCode === 'EUR') {
    return roundCurrency(amount);
  }

  const conversionRate = entry.currency?.main_rate ?? entry.currency?.rate;

  if (typeof conversionRate === 'number' && Number.isFinite(conversionRate)) {
    return roundCurrency(amount * conversionRate);
  }

  return roundCurrency(amount);
}

function normalizeAccount(account: ToshlAccount) {
  return {
    toshl_id: account.id,
    name: account.name || account.id,
    currency_code: account.currency?.code || null,
    balance: typeof account.balance === 'number' ? account.balance : null,
    synced_at: new Date()
  };
}

function normalizeCategory(category: ToshlCategory) {
  return {
    toshl_id: category.id,
    name: category.name || category.id,
    type: category.type || null,
    synced_at: new Date()
  };
}

function normalizeTag(tag: ToshlTag) {
  return {
    toshl_id: tag.id,
    name: tag.name || tag.id,
    type: tag.type || null,
    synced_at: new Date()
  };
}

function normalizeEntry(
  entry: ToshlEntry,
  context: {
    accountNames: Map<string, string>;
    categoryNames: Map<string, string>;
    tagNames: Map<string, string>;
  }
) {
  const entryType = inferEntryType(entry);
  const amount = roundCurrency(Number(entry.amount || 0));
  const amountEur = convertAmountToEur(entry);
  const accountId = entry.account || null;
  const categoryId = entry.category || null;
  const tagIds = Array.isArray(entry.tags) ? entry.tags : [];

  return {
    toshl_id: entry.id,
    date: entry.date,
    desc: entry.desc || null,
    entry_type: entryType,
    amount,
    amount_eur: amountEur,
    currency_code: entry.currency?.code || null,
    account_id: accountId,
    account_name: accountId ? context.accountNames.get(accountId) || null : null,
    category_id: categoryId,
    category_name: categoryId ? context.categoryNames.get(categoryId) || null : null,
    tag_ids: tagIds,
    tag_names: tagIds.map(tagId => context.tagNames.get(tagId) || tagId),
    modified_at: entry.modified ? new Date(entry.modified) : null,
    is_completed: Boolean(entry.completed),
    is_deleted: Boolean(entry.deleted),
    is_transfer: entryType === 'transaction',
    synced_at: new Date()
  };
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection(ENTRIES_COLLECTION).createIndex({ toshl_id: 1 }, { unique: true }),
    db.collection(ENTRIES_COLLECTION).createIndex({ date: 1 }),
    db.collection(ENTRIES_COLLECTION).createIndex({ entry_type: 1, date: 1 }),
    db.collection(ACCOUNTS_COLLECTION).createIndex({ toshl_id: 1 }, { unique: true }),
    db.collection(CATEGORIES_COLLECTION).createIndex({ toshl_id: 1 }, { unique: true }),
    db.collection(TAGS_COLLECTION).createIndex({ toshl_id: 1 }, { unique: true }),
    db.collection(SYNC_STATE_COLLECTION).createIndex({ resource: 1 }, { unique: true }),
    db.collection(SYNC_LOCKS_COLLECTION).createIndex({ key: 1 }, { unique: true })
  ]);
}

async function acquireSyncLock(db: Db, key: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_LOCK_TTL_MS);
  const collection = db.collection(SYNC_LOCKS_COLLECTION);

  await collection.deleteMany({
    key,
    expires_at: { $lte: now }
  });

  try {
    await collection.insertOne({
      key,
      started_at: now,
      expires_at: expiresAt
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new Error('A Toshl sync is already running');
    }

    throw error;
  }

  return async () => {
    await collection.deleteOne({ key });
  };
}

async function getResourceSyncState(db: Db, resource: string) {
  return db.collection(SYNC_STATE_COLLECTION).findOne<{ last_successful_to?: string }>({ resource });
}

async function setResourceSyncState(
  db: Db,
  resource: string,
  update: Record<string, unknown>
) {
  await db.collection(SYNC_STATE_COLLECTION).updateOne(
    { resource },
    {
      $set: {
        resource,
        ...update,
        updated_at: new Date()
      },
      $setOnInsert: {
        created_at: new Date()
      }
    },
    { upsert: true }
  );
}

async function syncReferenceCollection<T extends { id: string }>(
  db: Db,
  resource: string,
  collectionName: string,
  items: T[],
  normalize: (item: T) => Record<string, unknown>
): Promise<ResourceSyncResult> {
  const collection = db.collection(collectionName);
  const fetchedIds = new Set(items.map(item => item.id));
  let upserted = 0;
  let modified = 0;

  for (const item of items) {
    const normalized = normalize(item);
    const result = await collection.updateOne(
      { toshl_id: item.id },
      {
        $set: normalized,
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    );
    upserted += result.upsertedCount;
    modified += result.modifiedCount;
  }

  const deleteResult = await collection.deleteMany({
    toshl_id: { $nin: Array.from(fetchedIds) }
  });

  await setResourceSyncState(db, resource, {
    last_successful_at: new Date(),
    last_successful_to: todayIsoDate(),
    fetched_count: items.length
  });

  return {
    resource,
    fetched: items.length,
    upserted,
    modified,
    deleted: deleteResult.deletedCount || 0
  };
}

function monthKeyFromDate(dateIso: string) {
  return dateIso.slice(0, 7);
}

export async function syncToshlMirror(db: Db, options: SyncRequestOptions = {}): Promise<SyncRunResult> {
  await ensureIndexes(db);
  const releaseLock = await acquireSyncLock(db, OVERALL_SYNC_LOCK_KEY);
  const clientOptions: ToshlClientOptions = {
    token: options.token,
    fetchImpl: options.fetchImpl
  };
  const startedAt = new Date().toISOString();
  const hasExplicitStartDate = typeof options.startDate === 'string' && options.startDate.length > 0;
  const requestedStartDate = coerceIsoDate(options.startDate, DEFAULT_SYNC_START_DATE);
  const requestedEndDate = coerceIsoDate(options.endDate, todayIsoDate());
  const reconcileDays = options.reconcileDays ?? DEFAULT_RECONCILE_DAYS;

  try {
    const [accounts, categories, tags] = await Promise.all([
      fetchToshlCollection<ToshlAccount>('/accounts', undefined, clientOptions),
      fetchToshlCollection<ToshlCategory>('/categories', undefined, clientOptions),
      fetchToshlCollection<ToshlTag>('/tags', undefined, clientOptions)
    ]);

    const resourceResults: ResourceSyncResult[] = [];

    resourceResults.push(
      await syncReferenceCollection(db, 'accounts', ACCOUNTS_COLLECTION, accounts, normalizeAccount)
    );
    resourceResults.push(
      await syncReferenceCollection(db, 'categories', CATEGORIES_COLLECTION, categories, normalizeCategory)
    );
    resourceResults.push(
      await syncReferenceCollection(db, 'tags', TAGS_COLLECTION, tags, normalizeTag)
    );

    const accountNames = new Map(accounts.map(account => [account.id, account.name || account.id]));
    const categoryNames = new Map(categories.map(category => [category.id, category.name || category.id]));
    const tagNames = new Map(tags.map(tag => [tag.id, tag.name || tag.id]));

    const entryState = await getResourceSyncState(db, 'entries');
    const lastSuccessfulTo = typeof entryState?.last_successful_to === 'string'
      ? entryState.last_successful_to
      : null;
    const reconcileStartDate = lastSuccessfulTo
      ? addDays(lastSuccessfulTo, -Math.abs(reconcileDays))
      : requestedStartDate;
    const effectiveStartDate = hasExplicitStartDate
      ? requestedStartDate
      : maxIsoDate(requestedStartDate, reconcileStartDate);

    const entries = await fetchToshlCollection<ToshlEntry>(
      '/entries',
      {
        from: effectiveStartDate,
        to: requestedEndDate
      },
      clientOptions
    );

    const entryCollection = db.collection(ENTRIES_COLLECTION);
    let upserted = 0;
    let modified = 0;

    for (const entry of entries) {
      const normalized = normalizeEntry(entry, {
        accountNames,
        categoryNames,
        tagNames
      });
      const result = await entryCollection.updateOne(
        { toshl_id: entry.id },
        {
          $set: normalized,
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      );
      upserted += result.upsertedCount;
      modified += result.modifiedCount;
    }

    const fetchedIds = entries.map(entry => entry.id);
    const entryDeleteResult = await entryCollection.deleteMany({
      date: {
        $gte: effectiveStartDate,
        $lte: requestedEndDate
      },
      toshl_id: {
        $nin: fetchedIds
      }
    });

    await setResourceSyncState(db, 'entries', {
      last_successful_at: new Date(),
      last_successful_from: effectiveStartDate,
      last_successful_to: requestedEndDate,
      fetched_count: entries.length,
      reconcile_days: reconcileDays
    });

    resourceResults.push({
      resource: 'entries',
      fetched: entries.length,
      upserted,
      modified,
      deleted: entryDeleteResult.deletedCount || 0,
      from: effectiveStartDate,
      to: requestedEndDate
    });

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      requestedStartDate,
      requestedEndDate,
      reconcileDays,
      resources: resourceResults
    };
  } finally {
    await releaseLock();
  }
}

export async function getMonthlyBalanceReport(
  db: Db,
  options: { from?: string; to?: string } = {}
) {
  const from = coerceIsoDate(options.from, DEFAULT_SYNC_START_DATE);
  const to = coerceIsoDate(options.to, todayIsoDate());
  const documents = await db.collection(ENTRIES_COLLECTION)
    .find({
      date: { $gte: from, $lte: to },
      is_deleted: { $ne: true }
    })
    .sort({ date: 1, toshl_id: 1 })
    .toArray();

  const months = new Map<string, Omit<MonthlyBalanceRow, 'balance'>>();

  documents.forEach((entryDoc: any) => {
    const month = monthKeyFromDate(entryDoc.date);
    const current = months.get(month) || {
      month,
      income: 0,
      expense: 0,
      transfer: 0,
      net: 0
    };
    const amountEur = roundCurrency(Number(entryDoc.amount_eur ?? entryDoc.amount ?? 0));
    const entryType = entryDoc.entry_type;

    if (entryType === 'income') {
      current.income = roundCurrency(current.income + amountEur);
      current.net = roundCurrency(current.net + amountEur);
    } else if (entryType === 'expense') {
      current.expense = roundCurrency(current.expense + Math.abs(amountEur));
      current.net = roundCurrency(current.net + amountEur);
    } else if (entryType === 'transaction') {
      current.transfer = roundCurrency(current.transfer + amountEur);
    }

    months.set(month, current);
  });

  const rows = Array.from(months.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(row => row);

  let runningBalance = 0;
  const data: MonthlyBalanceRow[] = rows.map(row => {
    runningBalance = roundCurrency(runningBalance + row.net);
    return {
      ...row,
      balance: runningBalance
    };
  });

  const bestMonth = data.reduce<MonthlyBalanceRow | null>((best, row) => {
    if (!best || row.net > best.net) {
      return row;
    }
    return best;
  }, null);

  const worstMonth = data.reduce<MonthlyBalanceRow | null>((worst, row) => {
    if (!worst || row.net < worst.net) {
      return row;
    }
    return worst;
  }, null);

  return {
    currency: 'EUR',
    from,
    to,
    currentBalance: data.length ? data[data.length - 1].balance : 0,
    bestMonth: bestMonth?.month || null,
    worstMonth: worstMonth?.month || null,
    rows: data
  };
}
