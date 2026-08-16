import { readFileSync, writeFileSync } from 'node:fs'

const path = 'lib/client.js'
const body = readFileSync(path, 'utf8')

if (body.startsWith('window.__ModuleLoader__.load({')) {
  process.exit(0)
}

writeFileSync(path, `window.__ModuleLoader__.load({
  id: "dsh-ai-prompt-optimizer",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  }
});
`)
