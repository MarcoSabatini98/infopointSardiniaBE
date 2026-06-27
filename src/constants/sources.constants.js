// src/constants/sources.constants.js
// Config delle sorgenti dati esterne + TTL cache. I valori sono override-abili
// via .env per non hard-codare endpoint che possono cambiare.

const num = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// TTL cache (secondi)
const CACHE_TTL = Object.freeze({
  weather: num(process.env.CACHE_TTL_WEATHER, 900),
  fires: num(process.env.CACHE_TTL_FIRES, 600),
  floods: num(process.env.CACHE_TTL_FLOODS, 600),
  news: num(process.env.CACHE_TTL_NEWS, 900),
  flights: num(process.env.CACHE_TTL_FLIGHTS, 60),
  traffic: num(process.env.CACHE_TTL_TRAFFIC, 120),
});

// ── Traffico aereo: OpenSky Network (gratis, REST) ──
const OPENSKY_BASE_URL = process.env.OPENSKY_BASE_URL || 'https://opensky-network.org/api';
// Credenziali opzionali (account free → limiti più alti). Anonimo se assenti.
const OPENSKY_USER = process.env.OPENSKY_USER || '';
const OPENSKY_PASS = process.env.OPENSKY_PASS || '';

// ── Traffico marittimo: aisstream.io (gratis, WebSocket) ──
const AISSTREAM_URL = process.env.AISSTREAM_URL || 'wss://stream.aisstream.io/v0/stream';
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || '';
// Età massima (ms) di una posizione nave prima di considerarla stale e scartarla.
const AISSTREAM_MAX_AGE_MS = num(process.env.AISSTREAM_MAX_AGE_MS, 60 * 60 * 1000);

// ── Traffico stradale: TomTom Traffic (free tier) ──
const TOMTOM_BASE_URL = process.env.TOMTOM_BASE_URL || 'https://api.tomtom.com';
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || '';

const OPEN_METEO_BASE_URL = process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1';

const EFFIS_BASE_URL = process.env.EFFIS_BASE_URL || 'https://maps.effis.emergency.copernicus.eu';

const PROTEZIONE_CIVILE_FEED_URL = process.env.PROTEZIONE_CIVILE_FEED_URL || '';

// Feed RSS news. Override via env NEWS_FEEDS="Nome|url,Nome2|url2".
// Default: le testate richieste. Gli URL RSS vanno verificati/aggiornati:
// alcune testate cambiano i path dei feed. Tenuti qui come single source.
function parseNewsFeedsEnv(raw) {
  if (!raw) return null;
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [name, url] = pair.split('|').map((s) => s.trim());
      return { name, url };
    })
    .filter((f) => f.name && f.url);
}

const DEFAULT_NEWS_FEEDS = Object.freeze([
  { name: 'ANSA Sardegna', url: 'https://www.ansa.it/sardegna/notizie/sardegna_rss.xml' },
  { name: 'La Nuova Sardegna', url: 'https://www.lanuovasardegna.it/rss' },
  { name: 'L’Unione Sarda', url: 'https://www.unionesarda.it/rss' },
  { name: 'SkyTG24', url: 'https://tg24.sky.it/rss/tg24.xml' },
]);

const NEWS_FEEDS = Object.freeze(parseNewsFeedsEnv(process.env.NEWS_FEEDS) || DEFAULT_NEWS_FEEDS);

module.exports = {
  CACHE_TTL,
  OPEN_METEO_BASE_URL,
  EFFIS_BASE_URL,
  PROTEZIONE_CIVILE_FEED_URL,
  NEWS_FEEDS,
  OPENSKY_BASE_URL,
  OPENSKY_USER,
  OPENSKY_PASS,
  AISSTREAM_URL,
  AISSTREAM_API_KEY,
  AISSTREAM_MAX_AGE_MS,
  TOMTOM_BASE_URL,
  TOMTOM_API_KEY,
};
