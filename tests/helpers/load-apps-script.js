const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createFetchResponse(statusCode, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    getResponseCode() {
      return statusCode;
    },
    getContentText() {
      return text;
    }
  };
}

function loadAppsScript(options = {}) {
  const scriptPath = path.resolve(__dirname, '..', '..', 'gas', 'Code.js');
  const scriptCode = fs.readFileSync(scriptPath, 'utf8');
  const logs = [];
  const scriptProperties = Object.assign(
    {
      TOSHL_ACCESS_TOKEN: 'test-token',
      BANK_EMAIL: 'statements@postbank.bg',
      EMAIL_SEARCH_QUERY: 'subject:(Успешна трансакция с кредитна карта)',
      WEB_API_BASE_URL: 'https://example.test/api',
      WEB_API_USERNAME: 'api-user',
      WEB_API_PASSWORD: 'api-pass'
    },
    options.scriptProperties || {}
  );

  const fetchImpl = options.fetchImpl || function () {
    throw new Error('Unexpected UrlFetchApp.fetch call in test');
  };
  const gmailSearchImpl = options.gmailSearchImpl || function () {
    return [];
  };

  const context = {
    console,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Object,
    Array,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
    Utilities: {
      base64Encode(value) {
        return Buffer.from(String(value), 'utf8').toString('base64');
      }
    },
    Logger: {
      log(message) {
        logs.push(String(message));
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(name) {
            return Object.prototype.hasOwnProperty.call(scriptProperties, name)
              ? scriptProperties[name]
              : null;
          },
          setProperty(name, value) {
            scriptProperties[name] = value;
          },
          deleteProperty(name) {
            delete scriptProperties[name];
          }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, requestOptions) {
        const result = fetchImpl(url, requestOptions);

        if (result && typeof result.getResponseCode === 'function' && typeof result.getContentText === 'function') {
          return result;
        }

        const statusCode = result && result.statusCode ? result.statusCode : 200;
        const body = result && Object.prototype.hasOwnProperty.call(result, 'body') ? result.body : result;
        return createFetchResponse(statusCode, body);
      }
    },
    GmailApp: {
      search(query, start, max) {
        return gmailSearchImpl(query, start, max);
      }
    },
    ScriptApp: {},
    Session: {
      getActiveUser() {
        return {
          getEmail() {
            return 'tester@example.com';
          }
        };
      }
    },
    MailApp: {
      sendEmail() {}
    }
  };

  vm.createContext(context);
  vm.runInContext(scriptCode, context, { filename: 'gas/Code.js' });
  vm.runInContext(`
    this.__testExports = {
      CONFIG,
      _extractAmountAndCurrency,
      _extractStoreName,
      _extractDate,
      _findExistingToshlEntry,
      _getOrCreateTag,
      _getHistoricalImportState,
      _initializeHistoricalImport,
      _processHistoricalImportBatch,
      _getWebApiAuthHeader,
      _isMessageHandled,
      _saveProcessedMessage,
      continueHistoricalImport,
      getHistoricalImportStatus,
      processLastFiveMonthsEmails,
      resetHistoricalImport
    };
  `, context);

  return {
    context: Object.assign(context, context.__testExports),
    logs,
    scriptProperties,
    createFetchResponse
  };
}

module.exports = {
  loadAppsScript,
  createFetchResponse
};
