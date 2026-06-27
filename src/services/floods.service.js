// src/services/floods.service.js
// Allagamenti / allerte idrogeologiche via Protezione Civile Sardegna / ARPAS.
//
// ponytail: il feed reale (RSS/JSON/PDF) va confermato e impostato in
// PROTEZIONE_CIVILE_FEED_URL. Finché non è configurato, il service ritorna
// `available:false` invece di fallire — la dashboard mostra "nessun dato"
// senza errori. Quando l'URL è noto: se RSS si riusa rss-parser come news,
// se JSON si mappa qui. Isolato dietro un'unica funzione fetch.

const Parser = require('rss-parser');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { PROTEZIONE_CIVILE_FEED_URL, CACHE_TTL } = require('../constants/sources.constants');

const parser = new Parser({ timeout: 10_000 });

async function fetchAlerts() {
  if (!PROTEZIONE_CIVILE_FEED_URL) {
    return {
      available: false,
      count: 0,
      alerts: [],
      note: 'Feed Protezione Civile non configurato (PROTEZIONE_CIVILE_FEED_URL).',
    };
  }

  try {
    // Assunzione iniziale: feed RSS. Se la fonte fosse JSON, sostituire questo
    // ramo con httpClient.getJson + mapping dedicato.
    const feed = await parser.parseURL(PROTEZIONE_CIVILE_FEED_URL);
    const alerts = (feed.items ?? []).map((item) => ({
      title: item.title ?? null,
      summary: item.contentSnippet ?? item.content ?? null,
      link: item.link ?? null,
      published_at: item.isoDate ?? item.pubDate ?? null,
      source: 'Protezione Civile Sardegna / ARPAS',
    }));
    return { available: true, count: alerts.length, alerts };
  } catch (err) {
    logger.warn(`floods.pc.unavailable: ${err.message}`);
    return { available: false, count: 0, alerts: [], error: 'Sorgente allerte non disponibile' };
  }
}

function getAlerts() {
  return getOrSet('floods:alerts', CACHE_TTL.floods, fetchAlerts);
}

module.exports = { getAlerts };
