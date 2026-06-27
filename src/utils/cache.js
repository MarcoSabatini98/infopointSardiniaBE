// Cache in-memory con TTL (node-cache). Single-instance.
// ponytail: niente Redis finché non si scala multi-istanza — un'unica
// istanza Node basta per cache di dati esterni che cambiano in ore/minuti.

const NodeCache = require('node-cache');
const logger = require('./logger');

// checkperiod: ogni 120s node-cache evince le chiavi scadute (libera RAM).
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false });

// getOrSet: ritorna il valore cache-ato se presente, altrimenti esegue
// `producer` (async), salva con il TTL dato e ritorna. Un solo punto per
// la logica "miss → fetch → store", riusato da tutti i service esterni.
async function getOrSet(key, ttlSeconds, producer) {
  const hit = cache.get(key);
  if (hit !== undefined) {
    logger.debug(`cache.hit ${key}`);
    return hit;
  }
  logger.debug(`cache.miss ${key}`);
  const value = await producer();
  cache.set(key, value, ttlSeconds);
  return value;
}

function del(key) {
  return cache.del(key);
}

function flush() {
  return cache.flushAll();
}

module.exports = { getOrSet, del, flush };
