/* Runs the pure v2 planners in Node; no browser, DB or account is needed. */
const fs = require('node:fs');
const path = require('node:path');
const frontend = path.resolve(__dirname, '../lorekit-frontend');
const ts = require(path.join(frontend, 'node_modules/typescript'));
const jasmineCore = require(path.join(frontend, 'node_modules/jasmine-core'));
const sqlPath = require.resolve(path.join(frontend, 'node_modules/sql.js/dist/sql-wasm.js'));
const initializeSql = require(sqlPath);
require.cache[sqlPath].exports = options => initializeSql({ ...options, locateFile: file => path.join(frontend, 'node_modules/sql.js/dist', file) });
const jasmine = jasmineCore.core(jasmineCore);
const env = jasmine.getEnv();
Object.assign(globalThis, jasmineCore.interface(jasmine, env));
const originalLog = console.log;
console.log = (...args) => { if (!String(args[0]).startsWith('Creating table if not exists')) originalLog(...args); };
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, experimentalDecorators: true },
  });
  module._compile(output.outputText, filename);
};
let total = 0;
let failed = 0;
env.configure({ random: false });
env.addReporter({
  specDone(result) {
    total++;
    if (result.status !== 'passed') {
      failed++;
      process.stderr.write(`${result.status}: ${result.fullName}\n`);
      for (const failure of result.failedExpectations) process.stderr.write(`${failure.message}\n${failure.stack || ''}\n`);
    }
  },
  jasmineDone(result) {
    process.stdout.write(`Entity portability v2: ${total - failed}/${total} specs passed\n`);
    for (const failure of result.failedExpectations) process.stderr.write(`${failure.message}\n`);
    process.exitCode = failed || result.overallStatus !== 'passed' ? 1 : 0;
  },
});
require(path.join(frontend, 'src/app/libs/entity-portability/entity-portability.spec.ts'));
require(path.join(frontend, 'src/app/services/entity-transfer.service.spec.ts'));
require(path.join(frontend, 'src/app/libs/entity-portability/entity-portability-roundtrip.spec.ts'));
require(path.join(frontend, 'src/app/database/local-migrations.spec.ts'));
env.execute();
