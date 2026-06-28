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
  agenda: num(process.env.CACHE_TTL_AGENDA, 3600),
});

// Eventi culturali ufficiali (scraping SardegnaTurismo).
const SARDEGNATURISMO_EVENTS_URL =
  process.env.SARDEGNATURISMO_EVENTS_URL || 'https://www.sardegnaturismo.it/it/eventi';

// Geocoding luoghi eventi (Nominatim/OSM). Cache lunga: i comuni non si spostano.
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const GEOCODE_TTL = num(process.env.CACHE_TTL_GEOCODE, 30 * 24 * 3600);

// ── Traffico aereo: OpenSky Network (gratis, REST + OAuth2) ──
const OPENSKY_BASE_URL = process.env.OPENSKY_BASE_URL || 'https://opensky-network.org/api';
// OpenSky usa OAuth2 client_credentials: clientId/clientSecret → bearer token.
// Se assenti, accesso anonimo (limiti più bassi).
const OPENSKY_CLIENT_ID = process.env.OPENSKY_CLIENT_ID || '';
const OPENSKY_CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET || '';
const OPENSKY_TOKEN_URL =
  process.env.OPENSKY_TOKEN_URL ||
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// ── Traffico marittimo: aisstream.io (gratis, WebSocket) ──
const AISSTREAM_URL = process.env.AISSTREAM_URL || 'wss://stream.aisstream.io/v0/stream';
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || '';
// Età massima (ms) di una posizione nave prima di considerarla stale e scartarla.
const AISSTREAM_MAX_AGE_MS = num(process.env.AISSTREAM_MAX_AGE_MS, 60 * 60 * 1000);

// ── Traffico stradale: TomTom Traffic (free tier) ──
const TOMTOM_BASE_URL = process.env.TOMTOM_BASE_URL || 'https://api.tomtom.com';
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || '';

const OPEN_METEO_BASE_URL = process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1';

// EFFIS WFS (JRC). Il vecchio host maps.effis non risolve più; l'endpoint
// attivo è ies-ows.jrc.ec.europa.eu/effis (layer hotspot ercc.hs_24hrs_point).
const EFFIS_BASE_URL = process.env.EFFIS_BASE_URL || 'https://ies-ows.jrc.ec.europa.eu';

// NASA FIRMS — fallback incendi (stessi dati satellitari di EFFIS). Richiede
// MAP_KEY gratuita: https://firms.modaps.eosdis.nasa.gov/api/map_key
const FIRMS_BASE_URL = process.env.FIRMS_BASE_URL || 'https://firms.modaps.eosdis.nasa.gov';
const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '';
const FIRMS_SOURCE = process.env.FIRMS_SOURCE || 'VIIRS_SNPP_NRT';
const FIRMS_DAY_RANGE = num(process.env.FIRMS_DAY_RANGE, 1);

// Feed RSS ufficiale "rischio idrogeologico" della Protezione Civile Sardegna
// (avvisi di criticità). Override via env se cambia.
const PROTEZIONE_CIVILE_FEED_URL =
  process.env.PROTEZIONE_CIVILE_FEED_URL ||
  'https://www.sardegnaambiente.it/servizi/allertediprotezionecivile/rss/idrogeologico.xml';

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

// La Nuova Sardegna (gruppo GEDI) blocca l'accesso programmatico ai feed
// (403 Akamai anche con header browser) → esclusa. Riattivabile via NEWS_FEEDS
// se si trova una sorgente accessibile.
const DEFAULT_NEWS_FEEDS = Object.freeze([
  { name: 'ANSA Sardegna', url: 'https://www.ansa.it/sardegna/notizie/sardegna_rss.xml' },
  { name: 'L’Unione Sarda', url: 'https://www.unionesarda.it/sitemaps/rss' },
  { name: 'SkyTG24', url: 'https://tg24.sky.it/rss/tg24.xml' },
]);

const NEWS_FEEDS = Object.freeze(parseNewsFeedsEnv(process.env.NEWS_FEEDS) || DEFAULT_NEWS_FEEDS);

module.exports = {
  CACHE_TTL,
  OPEN_METEO_BASE_URL,
  EFFIS_BASE_URL,
  FIRMS_BASE_URL,
  FIRMS_MAP_KEY,
  FIRMS_SOURCE,
  FIRMS_DAY_RANGE,
  PROTEZIONE_CIVILE_FEED_URL,
  NEWS_FEEDS,
  OPENSKY_BASE_URL,
  OPENSKY_CLIENT_ID,
  OPENSKY_CLIENT_SECRET,
  OPENSKY_TOKEN_URL,
  AISSTREAM_URL,
  AISSTREAM_API_KEY,
  AISSTREAM_MAX_AGE_MS,
  TOMTOM_BASE_URL,
  TOMTOM_API_KEY,
  SARDEGNATURISMO_EVENTS_URL,
  NOMINATIM_URL,
  GEOCODE_TTL,
};
