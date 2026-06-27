// src/services/floods.service.js
// Allagamenti / allerte idrogeologiche via Protezione Civile Sardegna / ARPAS.
// Feed RSS ufficiale "rischio idrogeologico" (avvisi di criticità regionali).
// Se l'URL è vuoto il service ritorna `available:false` invece di fallire.

const Parser = require('rss-parser');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { PROTEZIONE_CIVILE_FEED_URL, CACHE_TTL } = require('../constants/sources.constants');

const parser = new Parser({ timeout: 10_000 });

// Il feed storico contiene migliaia di voci: ne esponiamo solo le più recenti.
const ALERTS_LIMIT = 20;

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
    // Il feed storico è enorme (migliaia di voci, ordinate dalla più recente):
    // teniamo solo le ultime ALERTS_LIMIT.
    const alerts = (feed.items ?? []).slice(0, ALERTS_LIMIT).map((item) => ({
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
