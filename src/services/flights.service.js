// src/services/flights.service.js
// Traffico aereo live via OpenSky Network (gratis, REST). Stati ADS-B degli
// aerei nella bbox Sardegna. Auth OAuth2 client_credentials (clientId/secret →
// bearer token); anonimo se le credenziali mancano. Cache TTL breve: gli aerei
// si muovono in fretta ma il free tier è limitato → 60s è il compromesso.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const {
  OPENSKY_BASE_URL,
  OPENSKY_CLIENT_ID,
  OPENSKY_CLIENT_SECRET,
  OPENSKY_TOKEN_URL,
  CACHE_TTL,
} = require('../constants/sources.constants');
const { SARDINIA_BBOX, distanceKm } = require('../constants/provinces');
const { AIRPORTS, airlineFromCallsign } = require('../constants/aviation');

const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = SARDINIA_BBOX;

// Aeroporto sardo più vicino + distanza (km).
function nearestAirport(lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null;
  let bestDist = Infinity;
  for (const a of AIRPORTS) {
    const d = distanceKm(lat, lng, a.lat, a.lng);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best ? { ...best, dist_km: Math.round(bestDist) } : null;
}

// Fase di volo rispetto agli aeroporti sardi (euristica: quota bassa + vicinanza
// + rateo di salita/discesa). OpenSky non fornisce la rotta completa.
function flightPhase(f) {
  const ap = nearestAirport(f.lat, f.lng);
  if (f.on_ground) {
    return { phase: 'a terra', airport: ap?.name ?? null };
  }
  const alt = f.geo_altitude ?? f.baro_altitude;
  if (ap && ap.dist_km <= 30 && alt != null && alt < 3500) {
    if (f.vertical_rate != null && f.vertical_rate > 1) {
      return { phase: 'in partenza', airport: ap.name };
    }
    if (f.vertical_rate != null && f.vertical_rate < -1) {
      return { phase: 'in arrivo', airport: ap.name };
    }
    return { phase: 'in avvicinamento', airport: ap.name };
  }
  return { phase: 'in transito', airport: null };
}

function buildUrl() {
  const params = new URLSearchParams({
    lamin: String(LAT_MIN),
    lomin: String(LON_MIN),
    lamax: String(LAT_MAX),
    lomax: String(LON_MAX),
  });
  return `${OPENSKY_BASE_URL}/states/all?${params.toString()}`;
}

// Token OAuth2 cache-ato in memoria fino a (scadenza - 60s di margine).
let tokenCache = { value: null, exp: 0 };

async function getAccessToken() {
  if (!OPENSKY_CLIENT_ID || !OPENSKY_CLIENT_SECRET) return null;
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: OPENSKY_CLIENT_ID,
    client_secret: OPENSKY_CLIENT_SECRET,
  });
  try {
    // Timeout generoso: su host free la prima chiamata a freddo al Keycloak
    // OpenSky è lenta; il token poi resta in cache ~30min.
    const data = await getJson(OPENSKY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      timeout: 20_000,
    });
    const ttlMs = ((data.expires_in || 1800) - 60) * 1000;
    tokenCache = { value: data.access_token, exp: Date.now() + ttlMs };
    return tokenCache.value;
  } catch (err) {
    // Il server auth (auth.opensky-network.org) può essere irraggiungibile da
    // alcuni host (es. Render): NON far cadere i voli — si prosegue in anonimo,
    // che colpisce un host diverso (opensky-network.org/api) con limiti più bassi.
    logger.warn(`opensky.token_failed, fallback anonimo: ${err.message}`);
    return null;
  }
}

async function authHeaders() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Lo state vector OpenSky è un array posizionale: mappiamo solo i campi utili.
// https://openskynetwork.github.io/opensky-api/rest.html#response
function mapState(s) {
  const callsign = (s[1] || '').trim() || null;
  const f = {
    icao24: s[0],
    callsign,
    flight: callsign,
    airline: airlineFromCallsign(callsign),
    origin_country: s[2] ?? null,
    lng: s[5] ?? null,
    lat: s[6] ?? null,
    baro_altitude: s[7] ?? null,
    on_ground: s[8] ?? null,
    velocity: s[9] ?? null,
    true_track: s[10] ?? null,
    vertical_rate: s[11] ?? null,
    geo_altitude: s[13] ?? null,
  };
  const ph = flightPhase(f);
  f.phase = ph.phase;
  f.airport = ph.airport;
  return f;
}

function buildStats(flights) {
  const by_airline = {};
  const by_phase = {};
  for (const f of flights) {
    if (f.airline) by_airline[f.airline] = (by_airline[f.airline] || 0) + 1;
    by_phase[f.phase] = (by_phase[f.phase] || 0) + 1;
  }
  return { by_airline, by_phase };
}

async function fetchFlights() {
  try {
    const headers = await authHeaders();
    const data = await getJson(buildUrl(), { headers, timeout: 20_000 });
    const states = Array.isArray(data.states) ? data.states : [];
    const flights = states.map(mapState);
    // Ordina: prima chi opera sugli aeroporti sardi, poi per quota.
    const phaseRank = {
      'in arrivo': 0,
      'in partenza': 1,
      'in avvicinamento': 2,
      'a terra': 3,
      'in transito': 4,
    };
    flights.sort(
      (a, b) =>
        (phaseRank[a.phase] ?? 9) - (phaseRank[b.phase] ?? 9) ||
        (b.geo_altitude ?? 0) - (a.geo_altitude ?? 0),
    );
    return {
      available: true,
      count: flights.length,
      updated_at: data.time ? new Date(data.time * 1000).toISOString() : null,
      stats: buildStats(flights),
      flights,
    };
  } catch (err) {
    logger.warn(`flights.opensky.unavailable: ${err.message}`);
    return { available: false, count: 0, flights: [], error: 'Sorgente voli non disponibile' };
  }
}

function getFlights() {
  return getOrSet('flights:active', CACHE_TTL.flights, fetchFlights);
}

module.exports = { getFlights, mapState };
