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

function buildUrl() {
  const params = new URLSearchParams({
    key: TOMTOM_API_KEY,
    bbox: `${LON_MIN},${LAT_MIN},${LON_MAX},${LAT_MAX}`,
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
    const data = await getJson(buildUrl());
    const incidents = Array.isArray(data.incidents) ? data.incidents : [];
    return { available: true, count: incidents.length, incidents: incidents.map(mapIncident) };
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
