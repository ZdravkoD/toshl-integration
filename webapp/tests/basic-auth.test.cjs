const test = require('node:test');
const assert = require('node:assert/strict');

const { loadApiHandler } = require('./helpers/load-api-handler.cjs');

test('buildBasicAuthHeader encodes credentials as a basic auth header', () => {
  const basicAuth = loadApiHandler('lib/basicAuth.ts');

  assert.equal(
    basicAuth.buildBasicAuthHeader('admin', 'secret'),
    'Basic YWRtaW46c2VjcmV0'
  );
});

test('isAuthorizedBasicAuth matches only the expected header', () => {
  const basicAuth = loadApiHandler('lib/basicAuth.ts');
  const expected = basicAuth.buildBasicAuthHeader('admin', 'secret');

  assert.equal(
    basicAuth.isAuthorizedBasicAuth(expected, 'admin', 'secret'),
    true
  );
  assert.equal(
    basicAuth.isAuthorizedBasicAuth('Basic something-else', 'admin', 'secret'),
    false
  );
  assert.equal(
    basicAuth.isAuthorizedBasicAuth(null, 'admin', 'secret'),
    false
  );
});
