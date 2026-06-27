// src/services/fires.service.js
// Incendi attivi via EFFIS (Copernicus). Interroghiamo il layer hotspot
// satellitari (MODIS/VIIRS) in formato GeoJSON, ritagliato sulla bbox Sardegna.
//
// ponytail: l'endpoint WFS esatto di EFFIS va confermato in fase di
// integrazione (i path GWIS cambiano nel tempo). È isolato qui dietro
// EFFIS_BASE_URL + buildUrl, così l'adattamento è un one-liner. Se la
// sorgente non risponde, il service degrada a lista vuota con `available:false`
// invece di propagare un 502 che romperebbe la dashboard.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { EFFIS_BASE_URL, CACHE_TTL } = require('../constants/sources.constants');
const { SARDINIA_BBOX } = require('../constants/provinces');

const FIRE_TYPENAME = 'ms:modis.hs';

function buildUrl() {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: FIRE_TYPENAME,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    bbox: `${SARDINIA_BBOX.join(',')},EPSG:4326`,
  });
  return `${EFFIS_BASE_URL}/gwis?${params.toString()}`;
}

// Normalizza una feature GeoJSON EFFIS in un oggetto piatto e prevedibile.
function mapFeature(feature) {
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
    raw: p,
  };
}

async function fetchActiveFires() {
  try {
    const data = await getJson(buildUrl());
    const features = Array.isArray(data.features) ? data.features : [];
    return { available: true, count: features.length, fires: features.map(mapFeature) };
  } catch (err) {
    logger.warn(`fires.effis.unavailable: ${err.message}`);
    return { available: false, count: 0, fires: [], error: 'Sorgente incendi non disponibile' };
  }
}

function getActiveFires() {
  return getOrSet('fires:active', CACHE_TTL.fires, fetchActiveFires);
}

module.exports = { getActiveFires };
