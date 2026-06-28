// src/services/fires.service.js
// Incendi attivi: EFFIS (Copernicus / JRC) come sorgente primaria, NASA FIRMS
// come fallback (stessi dati satellitari MODIS/VIIRS). Entrambi ritagliati
// sulla bbox Sardegna.
//
// EFFIS: WFS ies-ows.jrc.ec.europa.eu/effis, layer ms:ercc.hs_24hrs_point. Il
// suo backend Oracle può andare giù (risponde XML, HTTP 200). In quel caso
// proviamo FIRMS; se anche FIRMS non è configurato/risponde, degradiamo a
// `available:false` senza propagare errori.

const { getText } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const {
  EFFIS_BASE_URL,
  FIRMS_BASE_URL,
  FIRMS_MAP_KEY,
  FIRMS_SOURCE,
  FIRMS_DAY_RANGE,
  CACHE_TTL,
} = require('../constants/sources.constants');
const { SARDINIA_BBOX } = require('../constants/provinces');

const FIRE_TYPENAME = 'ms:ercc.hs_24hrs_point';

const UNAVAILABLE = Object.freeze({
  available: false,
  count: 0,
  fires: [],
  error: 'Sorgente incendi non disponibile',
});

// ── EFFIS (primario) ──────────────────────────────────────
function effisUrl() {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: FIRE_TYPENAME,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    bbox: SARDINIA_BBOX.join(','), // lon,lat,lon,lat (asse MapServer)
  });
  return `${EFFIS_BASE_URL}/effis?${params.toString()}`;
}

function mapEffisFeature(feature) {
  const [lng, lat] = feature.geometry?.coordinates ?? [null, null];
  const p = feature.properties ?? {};
  return {
    id: feature.id ?? p.id ?? null,
    lat,
    lng,
    acquired_at: p.acq_date ?? p.acquisitiondate ?? null,
    confidence: p.confidence ?? null,
    brightness: p.brightness ?? p.bright_t31 ?? null,
    source: 'EFFIS',
  };
}

// Ritorna l'array di fires se EFFIS risponde JSON valido, altrimenti null
// (così il chiamante prova il fallback).
async function tryEffis() {
  let body;
  try {
    body = await getText(effisUrl());
  } catch (err) {
    logger.warn(`fires.effis.unavailable: ${err.message}`);
    return null;
  }
  try {
    const data = JSON.parse(body);
    const features = Array.isArray(data.features) ? data.features : [];
    return features.map(mapEffisFeature);
  } catch {
    // MapServer risponde ExceptionReport XML (HTTP 200) col backend Oracle giù.
    logger.warn('fires.effis.unavailable: EFFIS ha risposto non-JSON (backend non disponibile)');
    return null;
  }
}

// ── NASA FIRMS (fallback) ─────────────────────────────────
function firmsUrl() {
  // area/csv/{KEY}/{SOURCE}/{west,south,east,north}/{dayRange}
  const [west, south, east, north] = SARDINIA_BBOX;
  const area = `${west},${south},${east},${north}`;
  return `${FIRMS_BASE_URL}/api/area/csv/${FIRMS_MAP_KEY}/${FIRMS_SOURCE}/${area}/${FIRMS_DAY_RANGE}`;
}

// Parser CSV minimale (i dati FIRMS non contengono virgole quotate).
function parseFirmsCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const idx = (name) => headers.indexOf(name);
  const iLat = idx('latitude');
  const iLng = idx('longitude');
  const iDate = idx('acq_date');
  const iTime = idx('acq_time');
  const iConf = idx('confidence');
  const iBright = idx('bright_ti4') !== -1 ? idx('bright_ti4') : idx('brightness');
  const iFrp = idx('frp');

  return lines.slice(1).map((line, n) => {
    const c = line.split(',');
    return {
      id: `firms-${n}`,
      lat: Number(c[iLat]),
      lng: Number(c[iLng]),
      acquired_at: iTime !== -1 ? `${c[iDate]} ${c[iTime]}` : (c[iDate] ?? null),
      confidence: iConf !== -1 ? c[iConf] : null,
      brightness: iBright !== -1 ? Number(c[iBright]) : null,
      frp: iFrp !== -1 ? Number(c[iFrp]) : null,
      source: 'NASA FIRMS',
    };
  });
}

async function tryFirms() {
  if (!FIRMS_MAP_KEY) {
    return null; // fallback non configurato
  }
  try {
    const text = await getText(firmsUrl());
    // Risposta d'errore FIRMS (chiave errata/limite) è testo non-CSV.
    if (/invalid|error|not\s/i.test(text.slice(0, 60)) && !text.startsWith('latitude')) {
      logger.warn(`fires.firms.unavailable: risposta inattesa (${text.slice(0, 60).trim()})`);
      return null;
    }
    return parseFirmsCsv(text);
  } catch (err) {
    logger.warn(`fires.firms.unavailable: ${err.message}`);
    return null;
  }
}

// ── Orchestrazione: EFFIS → FIRMS → unavailable ───────────
async function fetchActiveFires() {
  const effis = await tryEffis();
  if (effis) {
    return { available: true, source: 'EFFIS', count: effis.length, fires: effis };
  }
  const firms = await tryFirms();
  if (firms) {
    logger.info('fires: fallback su NASA FIRMS');
    return { available: true, source: 'NASA FIRMS', count: firms.length, fires: firms };
  }
  return UNAVAILABLE;
}

function getActiveFires() {
  return getOrSet('fires:active', CACHE_TTL.fires, fetchActiveFires);
}

module.exports = { getActiveFires };
