// Wrapper minimale su fetch nativo (Node 18+). ponytail: niente axios —
// fetch + AbortController coprono timeout, JSON e gestione errori in poche righe.

const AppError = require('../errors/AppError');
const logger = require('./logger');

const DEFAULT_TIMEOUT_MS = 10_000;

async function request(url, { timeout = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      logger.warn(`httpClient.upstream_error ${res.status} ${url}`);
      // 502: l'errore è della sorgente esterna, non del nostro client.
      throw new AppError(`Sorgente dati non disponibile (HTTP ${res.status})`, 502);
    }
    return res;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'AbortError') {
      logger.warn(`httpClient.timeout ${url}`);
      throw new AppError('Timeout dalla sorgente dati esterna', 504);
    }
    logger.error(`httpClient.network_error ${url}: ${err.message}`);
    throw new AppError('Errore di rete verso la sorgente dati esterna', 502);
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, options) {
  const res = await request(url, options);
  return res.json();
}

async function getText(url, options) {
  const res = await request(url, options);
  return res.text();
}

module.exports = { request, getJson, getText };
