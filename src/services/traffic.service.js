// src/services/traffic.service.js
// Traffico stradale + incidenti via TomTom Traffic (Incident Details v5),
// ritagliato sulla bbox Sardegna. Free tier con API key. Se la key manca,
// l'endpoint torna available:false invece di fallire.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { TOMTOM_BASE_URL, TOMTOM_API_KEY, CACHE_TTL } = require('../constants/sources.constants');
const { SARDINIA_BBOX } = require('../constants/provinces');

const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = SARDINIA_BBOX;

// Categorie iconCategory TomTom → etichetta leggibile (it).
const ICON_CATEGORY = {
  0: 'sconosciuto',
  1: 'incidente',
  2: 'nebbia',
  3: 'condizioni pericolose',
  4: 'pioggia',
  5: 'ghiaccio',
  6: 'coda',
  7: 'corsia chiusa',
  8: 'strada chiusa',
  9: 'lavori in corso',
  10: 'vento',
  11: 'allagamento',
  14: 'veicolo fermo',
};

// Campi richiesti dall'API v5 (obbligatorio specificarli).
const FIELDS =
  '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,startTime,endTime,from,to,length,delay,roadNumbers,events{description,code,iconCategory}}}}';

// TomTom limita la bbox a 10.000 km²; la Sardegna è ~47.000 km². Spezziamo
// l'area in una griglia di tile sotto soglia (~85x92 km ≈ 7.800 km² ciascuno)
// e interroghiamo in parallelo, poi uniamo e dedupliciamo per id.
const GRID_COLS = 2;
const GRID_ROWS = 3;

function buildTiles() {
  const tiles = [];
  const lonStep = (LON_MAX - LON_MIN) / GRID_COLS;
  const latStep = (LAT_MAX - LAT_MIN) / GRID_ROWS;
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const lonMin = LON_MIN + c * lonStep;
      const latMin = LAT_MIN + r * latStep;
      tiles.push([lonMin, latMin, lonMin + lonStep, latMin + latStep]);
    }
  }
  return tiles;
}

function buildUrl([lonMin, latMin, lonMax, latMax]) {
  const params = new URLSearchParams({
    key: TOMTOM_API_KEY,
    bbox: `${lonMin},${latMin},${lonMax},${latMax}`,
    fields: FIELDS,
    language: 'it-IT',
    timeValidityFilter: 'present',
  });
  return `${TOMTOM_BASE_URL}/traffic/services/5/incidentDetails?${params.toString()}`;
}

function mapIncident(inc) {
  const p = inc.properties || {};
  return {
    id: p.id ?? null,
    category: ICON_CATEGORY[p.iconCategory] ?? 'sconosciuto',
    icon_category: p.iconCategory ?? null,
    magnitude_of_delay: p.magnitudeOfDelay ?? null,
    description: p.events?.[0]?.description ?? null,
    from: p.from ?? null,
    to: p.to ?? null,
    road_numbers: p.roadNumbers ?? null,
    length_m: p.length ?? null,
    delay_s: p.delay ?? null,
    start_time: p.startTime ?? null,
    end_time: p.endTime ?? null,
    geometry: inc.geometry ?? null,
  };
}

async function fetchIncidents() {
  if (!TOMTOM_API_KEY) {
    return {
      available: false,
      count: 0,
      incidents: [],
      note: 'TOMTOM_API_KEY non impostata',
    };
  }
  try {
    // Una richiesta per tile, in parallelo. Un tile che fallisce non blocca
    // gli altri (Promise.allSettled).
    const results = await Promise.allSettled(buildTiles().map((tile) => getJson(buildUrl(tile))));

    const byId = new Map();
    for (const res of results) {
      if (res.status !== 'fulfilled') continue;
      for (const inc of res.value.incidents ?? []) {
        const mapped = mapIncident(inc);
        // Dedup: i tile possono sovrapporsi sui bordi.
        byId.set(mapped.id ?? Symbol(), mapped);
      }
    }

    const incidents = [...byId.values()];
    return { available: true, count: incidents.length, incidents };
  } catch (err) {
    logger.warn(`traffic.tomtom.unavailable: ${err.message}`);
    return {
      available: false,
      count: 0,
      incidents: [],
      error: 'Sorgente traffico non disponibile',
    };
  }
}

function getIncidents() {
  return getOrSet('traffic:incidents', CACHE_TTL.traffic, fetchIncidents);
}

module.exports = { getIncidents, mapIncident };
