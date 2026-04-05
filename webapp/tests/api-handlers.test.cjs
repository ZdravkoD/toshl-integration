const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMockReq,
  createMockRes,
  loadApiHandler,
  loadTsModule
} = require('./helpers/load-api-handler.cjs');

test('getCategory returns 405 for unsupported methods', async () => {
  const handler = loadApiHandler('pages/api/getCategory.ts', {
    '../../lib/mongodb': {}
  });
  const req = createMockReq({ method: 'POST' });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, { error: 'Method not allowed' });
});

test('getCategory returns the mapped category when a merchant exists', async () => {
  const handler = loadApiHandler('pages/api/getCategory.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection() {
            return {
              findOne: async (query) => {
                assert.deepEqual(query, { store_name: 'WODATA' });
                return { category: 'Software' };
              }
            };
          }
        }
      })
    }
  });
  const req = createMockReq({
    method: 'GET',
    query: { store_name: 'WODATA' }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { category: 'Software' });
});

test('savePending stores normalized data and returns the inserted id', async () => {
  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;

  const handler = loadApiHandler('pages/api/savePending.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'pending_transactions');
            return {
              findOneAndUpdate: async (filter, update, options) => {
                capturedFilter = filter;
                capturedUpdate = update;
                capturedOptions = options;
                return { _id: { toString: () => 'pending-123' } };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({
    method: 'POST',
    body: {
      store_name: 'SPEEDY',
      amount: '12.45',
      currency: 'EUR',
      date: '2026-04-05',
      email_id: 'email-1',
      needs_description: true
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.deepEqual(capturedFilter, { email_id: 'email-1' });
  assert.equal(capturedUpdate.$setOnInsert.amount, 12.45);
  assert.equal(capturedUpdate.$setOnInsert.needs_description, true);
  assert.equal(capturedOptions.upsert, true);
  assert.equal(capturedOptions.returnDocument, 'after');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, insertedId: 'pending-123' });
});

test('getPending serializes ids and merges merchant mappings', async () => {
  const handler = loadApiHandler('pages/api/getPending.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            if (name === 'pending_transactions') {
              return {
                find() {
                  return {
                    sort() {
                      return {
                        toArray: async () => [
                          {
                            _id: { toString: () => 'pending-1' },
                            store_name: 'WODATA',
                            processed: false
                          },
                          {
                            _id: { toString: () => 'pending-2' },
                            store_name: 'UNKNOWN',
                            processed: false
                          }
                        ]
                      };
                    }
                  };
                }
              };
            }

            if (name === 'merchants') {
              return {
                find() {
                  return {
                    toArray: async () => [
                      {
                        store_name: 'WODATA',
                        category: 'Software',
                        tags: ['Business']
                      }
                    ]
                  };
                }
              };
            }

            throw new Error(`Unexpected collection ${name}`);
          }
        }
      })
    }
  });

  const req = createMockReq({ method: 'GET' });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    documents: [
      {
        _id: 'pending-1',
        store_name: 'WODATA',
        processed: false,
        has_mapping: true,
        category: 'Software',
        tags: ['Business']
      },
      {
        _id: 'pending-2',
        store_name: 'UNKNOWN',
        processed: false,
        has_mapping: false,
        category: null,
        tags: null
      }
    ]
  });
});

test('mappings PUT removes tags when an empty tag list is submitted', async () => {
  let updateCall;

  const handler = loadApiHandler('pages/api/mappings.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'merchants');
            return {
              updateOne: async (filter, update) => {
                updateCall = { filter, update };
                return { matchedCount: 1, modifiedCount: 1 };
              }
            };
          }
        }
      })
    },
    mongodb: {
      ObjectId: class ObjectId {
        constructor(value) {
          this.value = value;
        }
      }
    }
  });

  const req = createMockReq({
    method: 'PUT',
    body: {
      _id: '507f1f77bcf86cd799439011',
      category: 'Shopping',
      tags: []
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(updateCall.filter._id.value, '507f1f77bcf86cd799439011');
  assert.equal(updateCall.update.$set.category, 'Shopping');
  assert.ok(updateCall.update.$set.updated_at instanceof Date);
  assert.deepEqual(updateCall.update.$unset, { tags: '' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Mapping updated (tags removed)'
  });
});

test('getProcessedMessage reports when a message already exists', async () => {
  let indexArgs;

  const handler = loadApiHandler('pages/api/getProcessedMessage.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'processed_messages');
            return {
              createIndex: async (...args) => {
                indexArgs = args;
              },
              findOne: async (query) => {
                assert.deepEqual(query, { message_id: 'msg-123' });
                return { message_id: 'msg-123', status: 'processed' };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({
    method: 'GET',
    query: { message_id: 'msg-123' }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.deepEqual(indexArgs, [{ message_id: 1 }, { unique: true }]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    exists: true,
    document: { message_id: 'msg-123', status: 'processed' }
  });
});

test('saveProcessedMessage upserts normalized processed-message metadata', async () => {
  let capturedFilter;
  let capturedUpdate;
  let capturedOptions;

  const handler = loadApiHandler('pages/api/saveProcessedMessage.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'processed_messages');
            return {
              createIndex: async () => {},
              updateOne: async (filter, update, options) => {
                capturedFilter = filter;
                capturedUpdate = update;
                capturedOptions = options;
                return { upsertedCount: 1, matchedCount: 0, modifiedCount: 0 };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({
    method: 'POST',
    body: {
      message_id: 'msg-123',
      thread_id: 'thread-456',
      subject: 'subject',
      status: 'pending',
      transaction_date: '2026-04-05',
      store_name: 'WODATA',
      amount: 28,
      toshl_entry_id: 'entry-789'
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.deepEqual(capturedFilter, { message_id: 'msg-123' });
  assert.equal(capturedUpdate.$set.thread_id, 'thread-456');
  assert.equal(capturedUpdate.$set.subject, 'subject');
  assert.equal(capturedUpdate.$set.status, 'pending');
  assert.equal(capturedUpdate.$set.transaction_date, '2026-04-05');
  assert.equal(capturedUpdate.$set.store_name, 'WODATA');
  assert.equal(capturedUpdate.$set.amount, 28);
  assert.equal(capturedUpdate.$set.toshl_entry_id, 'entry-789');
  assert.ok(capturedUpdate.$set.updated_at instanceof Date);
  assert.ok(capturedUpdate.$setOnInsert.created_at instanceof Date);
  assert.deepEqual(capturedOptions, { upsert: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    upserted: true,
    matched: 0,
    modified: 0
  });
});

test('updateDescription trims the submitted description before saving', async () => {
  let updateCall;

  const handler = loadApiHandler('pages/api/updateDescription.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'pending_transactions');
            return {
              updateOne: async (filter, update) => {
                updateCall = { filter, update };
                return { matchedCount: 1 };
              }
            };
          }
        }
      })
    },
    mongodb: {
      ObjectId: class ObjectId {
        constructor(value) {
          this.value = value;
        }
      }
    }
  });

  const req = createMockReq({
    method: 'POST',
    body: {
      id: '507f1f77bcf86cd799439011',
      description: '  Courier package  '
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(updateCall.filter._id.value, '507f1f77bcf86cd799439011');
  assert.equal(updateCall.update.$set.description, 'Courier package');
  assert.ok(updateCall.update.$set.description_added_at instanceof Date);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Description updated successfully'
  });
});

test('markProcessed persists processed flags and returns write counts', async () => {
  let updateCall;

  const handler = loadApiHandler('pages/api/markProcessed.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'pending_transactions');
            return {
              updateOne: async (filter, update) => {
                updateCall = { filter, update };
                return { matchedCount: 1, modifiedCount: 1 };
              }
            };
          }
        }
      })
    },
    mongodb: {
      ObjectId: class ObjectId {
        constructor(value) {
          this.value = value;
        }
      }
    }
  });

  const req = createMockReq({
    method: 'POST',
    query: { id: '507f1f77bcf86cd799439011' }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(updateCall.filter._id.value, '507f1f77bcf86cd799439011');
  assert.equal(updateCall.update.$set.processed, true);
  assert.ok(updateCall.update.$set.processed_at instanceof Date);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    matched: 1,
    modified: 1
  });
});

test('deduplicatePending deletes all but the oldest duplicate transaction', async () => {
  let deletedIds;

  const handler = loadApiHandler('pages/api/deduplicatePending.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'pending_transactions');
            return {
              find() {
                return {
                  toArray: async () => [
                    {
                      _id: 'oldest',
                      store_name: 'WODATA',
                      amount: 28,
                      currency: 'EUR',
                      date: '2026-04-05',
                      created_at: '2026-04-05T08:00:00.000Z'
                    },
                    {
                      _id: 'newer',
                      store_name: 'WODATA',
                      amount: 28,
                      currency: 'EUR',
                      date: '2026-04-05',
                      created_at: '2026-04-05T09:00:00.000Z'
                    },
                    {
                      _id: 'unique',
                      store_name: 'OTHER',
                      amount: 10,
                      currency: 'EUR',
                      date: '2026-04-05',
                      created_at: '2026-04-05T10:00:00.000Z'
                    }
                  ]
                };
              },
              deleteMany: async (query) => {
                deletedIds = query._id.$in;
                return { deletedCount: deletedIds.length };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({ method: 'POST' });
  const res = createMockRes();

  await handler(req, res);

  assert.deepEqual(deletedIds, ['newer']);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    deletedCount: 1,
    message: 'Removed 1 duplicate transaction(s)'
  });
});

test('clearProcessed deletes processed pending transactions', async () => {
  let deleteFilter;

  const handler = loadApiHandler('pages/api/clearProcessed.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'pending_transactions');
            return {
              deleteMany: async (filter) => {
                deleteFilter = filter;
                return { deletedCount: 3 };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({ method: 'DELETE' });
  const res = createMockRes();

  await handler(req, res);

  assert.deepEqual(deleteFilter, { processed: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    deletedCount: 3,
    message: 'Cleared 3 processed transaction(s)'
  });
});

test('deletePending removes a pending transaction by id', async () => {
  let deleteFilter;

  const handler = loadApiHandler('pages/api/deletePending.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'pending_transactions');
            return {
              deleteOne: async (filter) => {
                deleteFilter = filter;
                return { deletedCount: 1 };
              }
            };
          }
        }
      })
    },
    mongodb: {
      ObjectId: class ObjectId {
        constructor(value) {
          this.value = value;
        }
      }
    }
  });

  const req = createMockReq({
    method: 'DELETE',
    query: { id: '507f1f77bcf86cd799439011' }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(deleteFilter._id.value, '507f1f77bcf86cd799439011');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Pending transaction deleted successfully'
  });
});

test('deletePending validates that an id is provided', async () => {
  const handler = loadApiHandler('pages/api/deletePending.ts', {
    '../../lib/mongodb': {}
  });
  const req = createMockReq({
    method: 'DELETE',
    query: {}
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'id parameter is required' });
});

test('savePending rejects incomplete payloads', async () => {
  const handler = loadApiHandler('pages/api/savePending.ts', {
    '../../lib/mongodb': {}
  });
  const req = createMockReq({
    method: 'POST',
    body: {
      store_name: 'WODATA',
      currency: 'EUR',
      date: '2026-04-05',
      email_id: 'email-1'
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'Missing required fields: store_name, amount, currency, date, email_id'
  });
});

test('saveProcessedMessage requires a message id', async () => {
  const handler = loadApiHandler('pages/api/saveProcessedMessage.ts', {
    '../../lib/mongodb': {}
  });
  const req = createMockReq({
    method: 'POST',
    body: {}
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'message_id is required' });
});

test('syncCategories replaces existing category documents with synced values', async () => {
  let deleteCalled = false;
  let insertedDocs;

  const handler = loadApiHandler('pages/api/syncCategories.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'toshl_categories');
            return {
              deleteMany: async () => {
                deleteCalled = true;
              },
              insertMany: async (docs) => {
                insertedDocs = docs;
                return { insertedCount: docs.length };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({
    method: 'POST',
    body: {
      categories: [
        { name: 'Groceries', toshl_id: 'cat-1', usage_count: 12 }
      ]
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(deleteCalled, true);
  assert.equal(insertedDocs[0].name, 'Groceries');
  assert.equal(insertedDocs[0].toshl_id, 'cat-1');
  assert.equal(insertedDocs[0].usage_count, 12);
  assert.ok(insertedDocs[0].synced_at instanceof Date);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    count: 1,
    message: 'Synced 1 categories'
  });
});

test('syncTags replaces existing tag documents with synced values', async () => {
  let deleteCalled = false;
  let insertedDocs;

  const handler = loadApiHandler('pages/api/syncTags.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            assert.equal(name, 'toshl_tags');
            return {
              deleteMany: async () => {
                deleteCalled = true;
              },
              insertMany: async (docs) => {
                insertedDocs = docs;
                return { insertedCount: docs.length };
              }
            };
          }
        }
      })
    }
  });

  const req = createMockReq({
    method: 'POST',
    body: {
      tags: [
        { name: 'Business', toshl_id: 'tag-1', usage_count: 8 }
      ]
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(deleteCalled, true);
  assert.equal(insertedDocs[0].name, 'Business');
  assert.equal(insertedDocs[0].toshl_id, 'tag-1');
  assert.equal(insertedDocs[0].usage_count, 8);
  assert.ok(insertedDocs[0].synced_at instanceof Date);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    count: 1,
    message: 'Synced 1 tags'
  });
});

test('syncCategories rejects invalid payloads', async () => {
  const handler = loadApiHandler('pages/api/syncCategories.ts', {
    '../../lib/mongodb': {}
  });
  const req = createMockReq({
    method: 'POST',
    body: { categories: null }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid categories data' });
});

test('syncTags rejects invalid payloads', async () => {
  const handler = loadApiHandler('pages/api/syncTags.ts', {
    '../../lib/mongodb': {}
  });
  const req = createMockReq({
    method: 'POST',
    body: { tags: null }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid tags data' });
});

test('syncToshl forwards parsed sync options to the sync engine', async () => {
  let capturedOptions;

  const handler = loadApiHandler('pages/api/syncToshl.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({ db: { name: 'mock-db' } })
    },
    '../../lib/toshlSync': {
      syncToshlMirror: async (_db, options) => {
        capturedOptions = options;
        return {
          startedAt: '2026-04-05T10:00:00.000Z',
          finishedAt: '2026-04-05T10:00:01.000Z',
          requestedStartDate: '2025-01-01',
          requestedEndDate: '2026-04-05',
          reconcileDays: 45,
          resources: []
        };
      }
    }
  });

  const req = createMockReq({
    method: 'POST',
    body: {
      start_date: '2025-01-01',
      end_date: '2026-04-05',
      reconcile_days: 45
    }
  });
  const res = createMockRes();

  await handler(req, res);

  assert.deepEqual(capturedOptions, {
    startDate: '2025-01-01',
    endDate: '2026-04-05',
    reconcileDays: 45
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.reconcileDays, 45);
});

test('monthly balance report aggregates entries from Mongo and excludes transfers from net', async () => {
  const { getMonthlyBalanceReport } = loadTsModule('lib/toshlSync.ts', {
    './toshl': {
      todayIsoDate: () => '2026-04-05'
    }
  });

  const report = await getMonthlyBalanceReport({
    collection(name) {
      assert.equal(name, 'toshl_entries');
      return {
        aggregate(pipeline) {
          assert.deepEqual(pipeline[0], {
            $match: {
              date: { $gte: '2025-01-01', $lte: '2025-02-28' },
              is_deleted: { $ne: true }
            }
          });
          assert.deepEqual(pipeline[pipeline.length - 1], {
            $sort: { month: 1 }
          });

          return {
            toArray: async () => [
              {
                month: '2025-01',
                income: 1000,
                expense: 250,
                transfer: -800,
                net: 750
              },
              {
                month: '2025-02',
                income: 50,
                expense: 100,
                transfer: 0,
                net: -50
              }
            ]
          };
        }
      };
    }
  }, {
    from: '2025-01-01',
    to: '2025-02-28'
  });

  assert.equal(report.currency, 'EUR');
  assert.equal(report.currentBalance, 700);
  assert.equal(report.bestMonth, '2025-01');
  assert.equal(report.worstMonth, '2025-02');
  assert.deepEqual(report.rows, [
    {
      month: '2025-01',
      income: 1000,
      expense: 250,
      transfer: -800,
      net: 750,
      balance: 750
    },
    {
      month: '2025-02',
      income: 50,
      expense: 100,
      transfer: 0,
      net: -50,
      balance: 700
    }
  ]);
});

test('sync mirror ignores reconciliation category entries', async () => {
  const { syncToshlMirror } = loadTsModule('lib/toshlSync.ts', {
    './toshl': {
      fetchToshlCollection: async (path) => {
        if (path === '/accounts') {
          return [{ id: 'acc-1', name: 'Cash', currency: { code: 'EUR' } }];
        }

        if (path === '/categories') {
          return [
            { id: 'reconciliation', name: 'Reconciliation', type: 'expense' },
            { id: 'cat-1', name: 'General', type: 'expense' }
          ];
        }

        if (path === '/tags') {
          return [];
        }

        if (path === '/entries') {
          return [
            {
              id: 'entry-1',
              amount: -12,
              date: '2026-04-05',
              currency: { code: 'EUR' },
              account: 'acc-1',
              category: 'cat-1'
            },
            {
              id: 'entry-2',
              amount: -9,
              date: '2026-04-05',
              currency: { code: 'EUR' },
              account: 'acc-1',
              category: 'reconciliation'
            }
          ];
        }

        throw new Error(`Unexpected path ${path}`);
      },
      todayIsoDate: () => '2026-04-05'
    }
  });

  const entryUpdates = [];
  let entryDeleteQuery;

  const db = {
    collection(name) {
      if (name === 'sync_locks') {
        return {
          createIndex: async () => {},
          deleteMany: async () => {},
          insertOne: async () => {},
          deleteOne: async () => {}
        };
      }

      if (name === 'sync_state') {
        return {
          createIndex: async () => {},
          findOne: async () => null,
          updateOne: async () => ({})
        };
      }

      if (name === 'toshl_entries') {
        return {
          createIndex: async () => {},
          updateOne: async (filter, update) => {
            entryUpdates.push({ filter, update });
            return { upsertedCount: 1, modifiedCount: 0 };
          },
          deleteMany: async (query) => {
            entryDeleteQuery = query;
            return { deletedCount: 0 };
          }
        };
      }

      return {
        createIndex: async () => {},
        updateOne: async () => ({ upsertedCount: 1, modifiedCount: 0 }),
        deleteMany: async () => ({ deletedCount: 0 })
      };
    }
  };

  const result = await syncToshlMirror(db, {
    startDate: '2026-04-01',
    endDate: '2026-04-05'
  });

  assert.equal(result.resources.find((resource) => resource.resource === 'entries').fetched, 1);
  assert.equal(entryUpdates.length, 1);
  assert.equal(entryUpdates[0].filter.toshl_id, 'entry-1');
  assert.equal(entryDeleteQuery.$and[1].$or[1].category_id, 'reconciliation');
});

test('sync mirror stores entry amounts normalized to EUR', async () => {
  const { syncToshlMirror } = loadTsModule('lib/toshlSync.ts', {
    './toshl': {
      fetchToshlCollection: async (path) => {
        if (path === '/accounts') {
          return [{ id: 'acc-1', name: 'Cash', currency: { code: 'EUR' } }];
        }

        if (path === '/categories') {
          return [{ id: 'cat-1', name: 'General', type: 'expense' }];
        }

        if (path === '/tags') {
          return [];
        }

        if (path === '/entries') {
          return [
            {
              id: 'entry-bgn',
              amount: -100,
              date: '2026-04-05',
              currency: { code: 'BGN', rate: 0.511, main_rate: 0.511 },
              account: 'acc-1',
              category: 'cat-1'
            }
          ];
        }

        throw new Error(`Unexpected path ${path}`);
      },
      todayIsoDate: () => '2026-04-05'
    }
  });

  let capturedEntryUpdate;

  const db = {
    collection(name) {
      if (name === 'sync_locks') {
        return {
          createIndex: async () => {},
          deleteMany: async () => {},
          insertOne: async () => {},
          deleteOne: async () => {}
        };
      }

      if (name === 'sync_state') {
        return {
          createIndex: async () => {},
          findOne: async () => null,
          updateOne: async () => ({})
        };
      }

      if (name === 'toshl_entries') {
        return {
          createIndex: async () => {},
          updateOne: async (_filter, update) => {
            capturedEntryUpdate = update;
            return { upsertedCount: 1, modifiedCount: 0 };
          },
          deleteMany: async () => ({ deletedCount: 0 })
        };
      }

      return {
        createIndex: async () => {},
        updateOne: async () => ({ upsertedCount: 1, modifiedCount: 0 }),
        deleteMany: async () => ({ deletedCount: 0 })
      };
    }
  };

  await syncToshlMirror(db, {
    startDate: '2026-04-01',
    endDate: '2026-04-05'
  });

  assert.equal(capturedEntryUpdate.$set.amount, -51.13);
  assert.equal(capturedEntryUpdate.$set.amount_eur, -51.13);
  assert.equal(capturedEntryUpdate.$set.currency_code, 'EUR');
  assert.equal(capturedEntryUpdate.$set.original_amount, -100);
  assert.equal(capturedEntryUpdate.$set.original_currency_code, 'BGN');
});

test('sync mirror falls back to the BGN fixed conversion rate when Toshl omits one', async () => {
  const { syncToshlMirror } = loadTsModule('lib/toshlSync.ts', {
    './toshl': {
      fetchToshlCollection: async (path) => {
        if (path === '/accounts') {
          return [{ id: 'acc-1', name: 'Cash', currency: { code: 'EUR' } }];
        }

        if (path === '/categories') {
          return [{ id: 'cat-1', name: 'General', type: 'expense' }];
        }

        if (path === '/tags') {
          return [];
        }

        if (path === '/entries') {
          return [
            {
              id: 'entry-bgn-fallback',
              amount: 191000,
              date: '2026-04-05',
              currency: { code: 'BGN' },
              account: 'acc-1',
              category: 'cat-1'
            }
          ];
        }

        throw new Error(`Unexpected path ${path}`);
      },
      todayIsoDate: () => '2026-04-05'
    }
  });

  let capturedEntryUpdate;

  const db = {
    collection(name) {
      if (name === 'sync_locks') {
        return {
          createIndex: async () => {},
          deleteMany: async () => {},
          insertOne: async () => {},
          deleteOne: async () => {}
        };
      }

      if (name === 'sync_state') {
        return {
          createIndex: async () => {},
          findOne: async () => null,
          updateOne: async () => ({})
        };
      }

      if (name === 'toshl_entries') {
        return {
          createIndex: async () => {},
          updateOne: async (_filter, update) => {
            capturedEntryUpdate = update;
            return { upsertedCount: 1, modifiedCount: 0 };
          },
          deleteMany: async () => ({ deletedCount: 0 })
        };
      }

      return {
        createIndex: async () => {},
        updateOne: async () => ({ upsertedCount: 1, modifiedCount: 0 }),
        deleteMany: async () => ({ deletedCount: 0 })
      };
    }
  };

  await syncToshlMirror(db, {
    startDate: '2026-04-01',
    endDate: '2026-04-05'
  });

  assert.equal(capturedEntryUpdate.$set.amount, 97656.75);
  assert.equal(capturedEntryUpdate.$set.currency_code, 'EUR');
  assert.equal(capturedEntryUpdate.$set.original_amount, 191000);
  assert.equal(capturedEntryUpdate.$set.original_currency_code, 'BGN');
});

test('sync mirror ignores Toshl rate=1 for BGN entries and still converts to EUR', async () => {
  const { syncToshlMirror } = loadTsModule('lib/toshlSync.ts', {
    './toshl': {
      fetchToshlCollection: async (path) => {
        if (path === '/accounts') {
          return [{ id: 'acc-1', name: 'Cash', currency: { code: 'BGN' } }];
        }

        if (path === '/categories') {
          return [{ id: 'cat-1', name: 'General', type: 'expense' }];
        }

        if (path === '/tags') {
          return [];
        }

        if (path === '/entries') {
          return [
            {
              id: 'entry-bgn-rate-one',
              amount: 117349.8,
              date: '2025-05-28',
              currency: { code: 'BGN', rate: 1, main_rate: 1, fixed: false },
              account: 'acc-1',
              category: 'cat-1'
            }
          ];
        }

        throw new Error(`Unexpected path ${path}`);
      },
      todayIsoDate: () => '2026-04-05'
    }
  });

  let capturedEntryUpdate;

  const db = {
    collection(name) {
      if (name === 'sync_locks') {
        return {
          createIndex: async () => {},
          deleteMany: async () => ({ deletedCount: 0 }),
          insertOne: async () => {},
          deleteOne: async () => {}
        };
      }

      if (name === 'sync_state') {
        return {
          createIndex: async () => {},
          findOne: async () => null,
          updateOne: async () => ({})
        };
      }

      if (name === 'toshl_entries') {
        return {
          createIndex: async () => {},
          updateOne: async (_filter, update) => {
            capturedEntryUpdate = update;
            return { upsertedCount: 1, modifiedCount: 0 };
          },
          deleteMany: async () => ({ deletedCount: 0 })
        };
      }

      return {
        createIndex: async () => {},
        updateOne: async () => ({ upsertedCount: 1, modifiedCount: 0 }),
        deleteMany: async () => ({ deletedCount: 0 })
      };
    }
  };

  await syncToshlMirror(db, {
    startDate: '2025-05-01',
    endDate: '2025-05-31'
  });

  assert.equal(capturedEntryUpdate.$set.amount, 60000);
  assert.equal(capturedEntryUpdate.$set.amount_eur, 60000);
  assert.equal(capturedEntryUpdate.$set.currency_code, 'EUR');
  assert.equal(capturedEntryUpdate.$set.original_amount, 117349.8);
  assert.equal(capturedEntryUpdate.$set.original_currency_code, 'BGN');
});

test('sync mirror rejects non-EUR entries without a usable conversion rate', async () => {
  const { syncToshlMirror } = loadTsModule('lib/toshlSync.ts', {
    './toshl': {
      fetchToshlCollection: async (path) => {
        if (path === '/accounts') {
          return [{ id: 'acc-1', name: 'Cash', currency: { code: 'EUR' } }];
        }

        if (path === '/categories') {
          return [{ id: 'cat-1', name: 'General', type: 'expense' }];
        }

        if (path === '/tags') {
          return [];
        }

        if (path === '/entries') {
          return [
            {
              id: 'entry-usd-missing-rate',
              amount: 10,
              date: '2026-04-05',
              currency: { code: 'USD' },
              account: 'acc-1',
              category: 'cat-1'
            }
          ];
        }

        throw new Error(`Unexpected path ${path}`);
      },
      todayIsoDate: () => '2026-04-05'
    }
  });

  const db = {
    collection() {
      return {
        createIndex: async () => {},
        deleteMany: async () => ({ deletedCount: 0 }),
        insertOne: async () => {},
        deleteOne: async () => {},
        findOne: async () => null,
        updateOne: async () => ({ upsertedCount: 1, modifiedCount: 0 })
      };
    }
  };

  await assert.rejects(
    syncToshlMirror(db, {
      startDate: '2026-04-01',
      endDate: '2026-04-05'
    }),
    /Cannot normalize non-EUR entry entry-usd-missing-rate/
  );
});

test('syncStatus returns sorted sync resources and active lock state', async () => {
  const handler = loadApiHandler('pages/api/syncStatus.ts', {
    '../../lib/mongodb': {
      connectToDatabase: async () => ({
        db: {
          collection(name) {
            if (name === 'sync_state') {
              return {
                find() {
                  return {
                    sort() {
                      return {
                        toArray: async () => [
                          { resource: 'accounts', last_successful_to: '2026-04-05' },
                          { resource: 'entries', last_successful_to: '2026-04-05' }
                        ]
                      };
                    }
                  };
                }
              };
            }

            if (name === 'sync_locks') {
              return {
                findOne: async (query) => {
                  assert.equal(query.key, 'toshl-full-sync');
                  assert.equal(query.expires_at.$gt instanceof Date, true);
                  return { key: 'toshl-full-sync' };
                }
              };
            }

            throw new Error(`Unexpected collection ${name}`);
          }
        }
      })
    }
  });

  const req = createMockReq({ method: 'GET' });
  const res = createMockRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    resources: [
      { resource: 'accounts', last_successful_to: '2026-04-05' },
      { resource: 'entries', last_successful_to: '2026-04-05' }
    ],
    active_sync: true
  });
});
