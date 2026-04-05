const fs = require('fs');
const path = require('path');

const ts = require(path.resolve(__dirname, '../../node_modules/typescript'));

function compileTypeScript(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    },
    fileName: filePath
  }).outputText;
}

function loadTsModule(relativePath, mocks = {}) {
  const filePath = path.resolve(__dirname, '..', '..', relativePath);
  const compiled = compileTypeScript(filePath);
  const module = { exports: {} };
  const dirname = path.dirname(filePath);

  function localRequire(specifier) {
    if (Object.prototype.hasOwnProperty.call(mocks, specifier)) {
      return mocks[specifier];
    }

    if (specifier.startsWith('.')) {
      const resolved = path.resolve(dirname, specifier);

      if (Object.prototype.hasOwnProperty.call(mocks, resolved)) {
        return mocks[resolved];
      }

      throw new Error(`Missing mock for relative import: ${specifier}`);
    }

    return require(specifier);
  }

  const wrapped = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    compiled
  );

  wrapped(localRequire, module, module.exports, filePath, dirname);

  return module.exports;
}

function loadApiHandler(relativePath, mocks = {}) {
  const loadedModule = loadTsModule(relativePath, mocks);
  return loadedModule.default || loadedModule;
}

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    query: {},
    body: {},
    ...overrides
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

module.exports = {
  createMockReq,
  createMockRes,
  loadApiHandler,
  loadTsModule
};
