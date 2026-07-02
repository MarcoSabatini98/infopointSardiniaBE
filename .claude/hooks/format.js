#!/usr/bin/env node
// PostToolUse: eslint --fix + prettier --write sul file .js appena toccato.
// Best-effort: non blocca mai (exit 0) — pre-commit fara' da rete di sicurezza.
const { execFileSync } = require('child_process');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try {
    file = JSON.parse(raw)?.tool_input?.file_path || '';
  } catch {
    process.exit(0);
  }
  if (!file || !file.endsWith('.js')) process.exit(0);

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const run = (args) => {
    try {
      execFileSync(npx, args, { stdio: 'ignore', cwd: process.cwd() });
    } catch {
      /* unfixable → ignora, il lint manuale/pre-commit lo segnala */
    }
  };

  run(['eslint', '--fix', file]);
  run(['prettier', '--write', file]);
  process.exit(0);
});
