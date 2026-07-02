#!/usr/bin/env node
// PreToolUse guard: blocca edit su file sensibili (.env con chiavi vere, lock file).
// Exit 2 = blocca l'operazione, stderr torna al modello.
const path = require('path');

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try {
    file = JSON.parse(raw)?.tool_input?.file_path || '';
  } catch {
    process.exit(0); // no input parsabile → non bloccare
  }
  if (!file) process.exit(0);

  const base = path.basename(file);
  // .env reale bloccato; .env.example / .env.test consentiti.
  const blocked = base === '.env' || base === 'package-lock.json';

  if (blocked) {
    console.error(
      `Bloccato: "${base}" e' protetto. Contiene chiavi/lock. Modifica a mano se serve.`,
    );
    process.exit(2);
  }
  process.exit(0);
});
