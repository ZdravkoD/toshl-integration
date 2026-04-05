const assert = require('assert');
const { loadAppsScript } = require('./helpers/load-apps-script');

const tests = [];

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

function test(name, fn) {
  tests.push({ name, fn });
}

test('loads config from Script Properties', () => {
  const { context } = loadAppsScript({
    scriptProperties: {
      TOSHL_ACCESS_TOKEN: 'token-123',
      BANK_EMAIL: 'alerts@example.com',
      EMAIL_SEARCH_QUERY: 'subject:(Alert)',
      WEB_API_BASE_URL: 'https://api.example.test'
    }
  });

  assert.strictEqual(context.CONFIG.TOSHL_ACCESS_TOKEN, 'token-123');
  assert.strictEqual(context.CONFIG.BANK_EMAIL, 'alerts@example.com');
  assert.strictEqual(context.CONFIG.EMAIL_SEARCH_QUERY, 'subject:(Alert)');
  assert.strictEqual(context.CONFIG.WEB_API_BASE_URL, 'https://api.example.test');
});

test('throws when a required Script Property is missing', () => {
  assert.throws(() => {
    loadAppsScript({
      scriptProperties: {
        TOSHL_ACCESS_TOKEN: 'token-123',
        BANK_EMAIL: 'alerts@example.com',
        EMAIL_SEARCH_QUERY: 'subject:(Alert)',
        WEB_API_BASE_URL: null
      }
    });
  }, /Missing required Script Property: WEB_API_BASE_URL/);
});

test('extracts Postbank Bulgarian amount and currency', () => {
  const { context } = loadAppsScript();
  const result = context._extractAmountAndCurrency('Успешна трансакция на стойност 665.15 BGN');

  assert.deepStrictEqual(normalize(result), { amount: 665.15, currency: 'BGN' });
});

test('extracts Postbank English amount and currency', () => {
  const { context } = loadAppsScript();
  const result = context._extractAmountAndCurrency('Successful transaction for amount 28.00 EUR at WODATA');

  assert.deepStrictEqual(normalize(result), { amount: 28, currency: 'EUR' });
});

test('extracts and cleans merchant name from Bulgarian Postbank emails', () => {
  const { context } = loadAppsScript();
  const store = context._extractStoreName('Успешна трансакция в MR. BRICOLAGE SOFIA 3\\MR. BRICOLAGE SOFI на 07.11.2025 20:03:38');

  assert.strictEqual(store, 'MR. BRICOLAGE SOFIA 3');
});

test('extracts and cleans merchant name from English Postbank emails', () => {
  const { context } = loadAppsScript();
  const store = context._extractStoreName('Successfull transaction for amount 665.15 BGN at MR. BRICOLAGE SOFIA 3\\MR. BRICOLAGE SOFI. 07.11.2025 20:03:38');

  assert.strictEqual(store, 'MR. BRICOLAGE SOFIA 3');
});

test('extracts the transaction date from Postbank format', () => {
  const { context } = loadAppsScript();
  const result = context._extractDate(
    'Успешна трансакция на 07.11.2025 20:03:38',
    new Date('2025-11-08T08:00:00Z')
  );

  assert.strictEqual(result, '2025-11-07');
});

test('falls back to email date when transaction date is missing', () => {
  const { context } = loadAppsScript();
  const result = context._extractDate(
    'Текст без дата',
    new Date('2025-11-08T08:00:00Z')
  );

  assert.strictEqual(result, '2025-11-08');
});

test('finds an existing Toshl expense entry by date, amount and description', () => {
  const { context } = loadAppsScript({
    fetchImpl(url) {
      assert.ok(url.includes('/entries?from=2026-04-04&to=2026-04-04'));
      return {
        statusCode: 200,
        body: [
          { id: 'entry-1', date: '2026-04-04', desc: 'OTHER', amount: -2.45 },
          { id: 'entry-2', date: '2026-04-04', desc: 'WODATA', amount: -28.0 }
        ]
      };
    }
  });

  const result = context._findExistingToshlEntry(28, '2026-04-04', 'WODATA', false);

  assert.deepStrictEqual(normalize(result), {
    id: 'entry-2',
    date: '2026-04-04',
    desc: 'WODATA',
    amount: -28.0
  });
});

test('matches existing Toshl refunds using positive amounts', () => {
  const { context } = loadAppsScript({
    fetchImpl() {
      return {
        statusCode: 200,
        body: [
          { id: 'refund-1', date: '2026-04-04', desc: 'Refund - STORE', amount: 12.34 }
        ]
      };
    }
  });

  const result = context._findExistingToshlEntry(12.34, '2026-04-04', 'Refund - STORE', true);

  assert.deepStrictEqual(normalize(result), {
    id: 'refund-1',
    date: '2026-04-04',
    desc: 'Refund - STORE',
    amount: 12.34
  });
});

test('checks processed-message state through the web API', () => {
  const { context } = loadAppsScript({
    fetchImpl(url) {
      assert.ok(url.includes('/getProcessedMessage?message_id=msg-123'));
      return { statusCode: 200, body: { exists: true } };
    }
  });

  assert.strictEqual(context._isMessageHandled('msg-123'), true);
});

test('saves processed-message metadata through the web API', () => {
  let capturedPayload = null;
  const { context } = loadAppsScript({
    fetchImpl(url, requestOptions) {
      assert.ok(url.endsWith('/saveProcessedMessage'));
      capturedPayload = JSON.parse(requestOptions.payload);
      return { statusCode: 200, body: { success: true } };
    }
  });

  const saved = context._saveProcessedMessage(
    'msg-123',
    'thread-456',
    'subject',
    'processed',
    { date: '2026-04-04', store: 'WODATA', amount: 28 },
    'entry-2'
  );

  assert.strictEqual(saved, true);
  assert.deepStrictEqual(capturedPayload, {
    message_id: 'msg-123',
    thread_id: 'thread-456',
    subject: 'subject',
    status: 'processed',
    transaction_date: '2026-04-04',
    store_name: 'WODATA',
    amount: 28,
    toshl_entry_id: 'entry-2'
  });
});

async function main() {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`FAIL ${name}\n`);
      process.stderr.write(`${error.stack || error}\n`);
    }
  }

  if (failures > 0) {
    process.stderr.write(`\n${failures} test(s) failed\n`);
    process.exit(1);
  }

  process.stdout.write(`\n${tests.length} test(s) passed\n`);
}

main();
