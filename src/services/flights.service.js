// src/services/flights.service.js
// Traffico aereo live via OpenSky Network (gratis, REST). Stati ADS-B degli
// aerei nella bbox Sardegna. Credenziali opzionali (account free alza i
// limiti); anonimo se assenti. Cache TTL breve: gli aerei si muovono in fretta
// ma il free tier è limitato → 60s è il compromesso.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const {
  OPENSKY_BASE_URL,
  OPENSKY_USER,
  OPENSKY_PASS,
  CACHE_TTL,
} = require('../constants/sources.constants');
const { SARDINIA_BBOX } = require('../constants/provinces');

const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = SARDINIA_BBOX;

function buildUrl() {
  const params = new URLSearchParams({
    lamin: String(LAT_MIN),
    lomin: String(LON_MIN),
    lamax: String(LAT_MAX),
    lomax: String(LON_MAX),
  });
  return `${OPENSKY_BASE_URL}/states/all?${params.toString()}`;
}

function authHeaders() {
  if (!OPENSKY_USER || !OPENSKY_PASS) return {};
  const token = Buffer.from(`${OPENSKY_USER}:${OPENSKY_PASS}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

// Lo state vector OpenSky è un array posizionale: mappiamo solo i campi utili.
// https://openskynetwork.github.io/opensky-api/rest.html#response
function mapState(s) {
  return {
    icao24: s[0],
    callsign: (s[1] || '').trim() || null,
    origin_country: s[2] ?? null,
    lng: s[5] ?? null,
    lat: s[6] ?? null,
    baro_altitude: s[7] ?? null,
    on_ground: s[8] ?? null,
    velocity: s[9] ?? null,
    true_track: s[10] ?? null,
    geo_altitude: s[13] ?? null,
  };
}

async function fetchFlights() {
  try {
    const data = await getJson(buildUrl(), { headers: authHeaders() });
    const states = Array.isArray(data.states) ? data.states : [];
    return {
      available: true,
      count: states.length,
      updated_at: data.time ? new Date(data.time * 1000).toISOString() : null,
      flights: states.map(mapState),
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
