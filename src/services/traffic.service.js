// src/services/traffic.service.js
// Traffico stradale + incidenti via TomTom Traffic (Incident Details v5),
// ritagliato sulla bbox Sardegna. Free tier con API key. Se la key manca,
// l'endpoint torna available:false invece di fallire.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { reverse } = require('./geocode.service');
const { TOMTOM_BASE_URL, TOMTOM_API_KEY, CACHE_TTL } = require('../constants/sources.constants');
const { SARDINIA_BBOX, nearestProvinceCode } = require('../constants/provinces');

const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = SARDINIA_BBOX;

// Quante segnalazioni arricchire con il comune (reverse-geocoding) per refresh.
// Le altre restano con la sola provincia (assegnata dal centroide). I risultati
// reverse sono cache-ati a lungo, quindi il costo è sostanzialmente una-tantum.
const REVERSE_BUDGET = 40;

// magnitudeOfDelay TomTom → etichetta severità.
const SEVERITY = { 0: 'n/d', 1: 'lieve', 2: 'moderata', 3: 'grave', 4: 'chiusura' };
const SEVERITY_RANK = { chiusura: 4, grave: 3, moderata: 2, lieve: 1, 'n/d': 0 };

// Coordinata rappresentativa [lng,lat] da una geometria GeoJSON.
function firstCoord(geometry) {
  let c = geometry?.coordinates;
  if (!c) return null;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === 'number' ? [c[0], c[1]] : null;
}

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
  const c = firstCoord(inc.geometry);
  const lat = c ? c[1] : null;
  const lng = c ? c[0] : null;
  return {
    id: p.id ?? null,
    category: ICON_CATEGORY[p.iconCategory] ?? 'sconosciuto',
    icon_category: p.iconCategory ?? null,
    magnitude_of_delay: p.magnitudeOfDelay ?? null,
    severity: SEVERITY[p.magnitudeOfDelay] ?? 'n/d',
    description: p.events?.[0]?.description ?? null,
    from: p.from ?? null,
    to: p.to ?? null,
    road_numbers: p.roadNumbers ?? null,
    length_m: p.length ?? null,
    delay_s: p.delay ?? null,
    start_time: p.startTime ?? null,
    end_time: p.endTime ?? null,
    lat,
    lng,
    comune: null,
    province_code: nearestProvinceCode(lat, lng),
    geometry: inc.geometry ?? null,
  };
}

// Reverse-geocoding del comune in BACKGROUND: muta in place gli oggetti (che
// restano in cache via getOrSet), così la risposta è immediata e il comune si
// popola entro pochi secondi per le richieste successive nella finestra di
// cache. La provincia (da centroide) è già presente subito.
function enrichComuniInBackground(incidents) {
  (async () => {
    let used = 0;
    for (const inc of incidents) {
      if (used >= REVERSE_BUDGET) break;
      if (inc.lat == null) continue;
      used++;
      try {
        const rev = await reverse(inc.lat, inc.lng);
        if (rev?.comune) inc.comune = rev.comune;
      } catch {
        /* ignorato: degrada a solo provincia */
      }
    }
  })();
}

// Ordina per gravità poi ritardo, calcola le stats (provincia da centroide,
// coerente) e avvia l'arricchimento comuni in background.
function finalize(incidents) {
  incidents.sort(
    (a, b) =>
      (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
      (b.delay_s ?? 0) - (a.delay_s ?? 0),
  );

  const by_province = {};
  const by_severity = {};
  for (const inc of incidents) {
    if (inc.province_code)
      by_province[inc.province_code] = (by_province[inc.province_code] || 0) + 1;
    by_severity[inc.severity] = (by_severity[inc.severity] || 0) + 1;
  }

  enrichComuniInBackground(incidents);

  return {
    available: true,
    count: incidents.length,
    stats: { by_province, by_severity },
    incidents,
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
    return finalize(incidents);
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
