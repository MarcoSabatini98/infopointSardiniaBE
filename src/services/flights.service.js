// src/services/flights.service.js
// Traffico aereo live via adsb.lol (ADS-B community, gratis, senza chiave,
// raggiungibile da IP cloud — OpenSky bloccava i datacenter). Aerei intorno
// alla Sardegna. Cache TTL breve: gli aerei si muovono in fretta.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { ADSB_BASE_URL, CACHE_TTL } = require('../constants/sources.constants');
const { distanceKm } = require('../constants/provinces');
const { AIRPORTS, airlineFromCallsign, countryFromReg } = require('../constants/aviation');

// Centro Sardegna + raggio (miglia nautiche) che copre l'isola e il mare intorno.
const SARDINIA_CENTER = [40.05, 9.05];
const SEARCH_RADIUS_NM = 100;

// Conversioni verso le unità usate dal frontend (metri, m/s).
const FT_TO_M = 0.3048;
const KN_TO_MS = 0.514444;
const FTMIN_TO_MS = 0.00508;

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
// + rateo di salita/discesa). ADS-B non fornisce la rotta pianificata.
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
  const [lat, lon] = SARDINIA_CENTER;
  return `${ADSB_BASE_URL}/v2/lat/${lat}/lon/${lon}/dist/${SEARCH_RADIUS_NM}`;
}

// Aereo adsb.lol → shape usata da FE e mappa (unità convertite in metri/m·s⁻¹).
// https://api.adsb.lol/docs
function mapState(a) {
  const callsign = (a.flight || '').trim() || null;
  const onGround = a.alt_baro === 'ground';
  const baroFt = onGround ? 0 : typeof a.alt_baro === 'number' ? a.alt_baro : null;
  const geomFt = typeof a.alt_geom === 'number' ? a.alt_geom : null;
  const rateFtMin = a.baro_rate ?? a.geom_rate ?? null;
  const f = {
    icao24: a.hex ?? null,
    callsign,
    flight: callsign,
    airline: airlineFromCallsign(callsign),
    aircraft_type: a.t || null,
    registration: a.r || null,
    origin_country: countryFromReg(a.r),
    lat: a.lat ?? null,
    lng: a.lon ?? null,
    on_ground: onGround,
    baro_altitude: baroFt != null ? Math.round(baroFt * FT_TO_M) : null,
    geo_altitude: geomFt != null ? Math.round(geomFt * FT_TO_M) : null,
    velocity: typeof a.gs === 'number' ? a.gs * KN_TO_MS : null,
    true_track: a.track ?? null,
    vertical_rate: typeof rateFtMin === 'number' ? rateFtMin * FTMIN_TO_MS : null,
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
    const data = await getJson(buildUrl(), {
      headers: { 'User-Agent': 'infopointSardinia/1.0 (dashboard regionale)' },
      timeout: 30_000,
    });
    const ac = Array.isArray(data.ac) ? data.ac : [];
    const flights = ac.filter((a) => a.lat != null && a.lon != null).map(mapState);
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
      updated_at: data.now ? new Date(data.now).toISOString() : null,
      stats: buildStats(flights),
      flights,
    };
  } catch (err) {
    logger.warn(`flights.adsb.unavailable: ${err.message}`);
    return { available: false, count: 0, flights: [], error: 'Sorgente voli non disponibile' };
  }
}

function getFlights() {
  return getOrSet('flights:active', CACHE_TTL.flights, fetchFlights);
}

module.exports = { getFlights, mapState };
