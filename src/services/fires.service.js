// src/services/fires.service.js
// Incendi attivi + storico (fino a 5 giorni, il massimo consentito dall'area
// API di FIRMS). Sorgente primaria: NASA FIRMS su più satelliti VIIRS
// (NOAA-20/21 + SNPP) uniti — un singolo satellite può non avere passaggi su
// un'area e tornare 0 focolai mentre gli altri li vedono. EFFIS (Copernicus /
// JRC, solo ultime 24h) resta come fallback se FIRMS non è configurato/risponde.
//
// EFFIS: WFS ies-ows.jrc.ec.europa.eu/effis, layer ms:ercc.hs_24hrs_point. Il
// suo backend Oracle è spesso giù (risponde XML, HTTP 200). Se anche EFFIS non
// risponde degradiamo a `available:false` senza propagare errori.

const { getText } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const {
  EFFIS_BASE_URL,
  FIRMS_BASE_URL,
  FIRMS_MAP_KEY,
  FIRMS_SOURCES,
  FIRMS_DAY_RANGE,
  CACHE_TTL,
} = require('../constants/sources.constants');
const { SARDINIA_BBOX, nearestProvinceCode } = require('../constants/provinces');

const FIRE_TYPENAME = 'ms:ercc.hs_24hrs_point';

const UNAVAILABLE = Object.freeze({
  available: false,
  count: 0,
  fires: [],
  updated_at: null,
  window_days: FIRMS_DAY_RANGE,
  stats: { by_province: {}, by_severity: {}, by_day: {}, max_frp: null },
  error: 'Sorgente incendi non disponibile',
});

// Severità da FRP (Fire Radiative Power, MW): proxy dell'intensità del focolaio.
function severityFromFrp(frp) {
  if (frp == null || Number.isNaN(frp)) return 'n/d';
  if (frp < 10) return 'bassa';
  if (frp < 50) return 'media';
  if (frp < 100) return 'alta';
  return 'estrema';
}

// Arricchisce ogni focolaio (provincia + severità), ordina per intensità e
// calcola statistiche aggregate per il pannello guardia-fuochi.
function finalize(rawFires, source) {
  const fires = rawFires.map((f) => ({
    ...f,
    province_code: nearestProvinceCode(f.lat, f.lng),
    severity: severityFromFrp(f.frp),
  }));

  fires.sort((a, b) => (b.frp ?? 0) - (a.frp ?? 0));

  const by_province = {};
  const by_severity = {};
  const by_day = {}; // giorno (YYYY-MM-DD) → n° focolai, per lo storico nel FE
  let max_frp = null;
  let updated_at = null;
  for (const f of fires) {
    if (f.province_code) by_province[f.province_code] = (by_province[f.province_code] || 0) + 1;
    by_severity[f.severity] = (by_severity[f.severity] || 0) + 1;
    if (f.acquired_at) {
      const day = f.acquired_at.slice(0, 10);
      by_day[day] = (by_day[day] || 0) + 1;
    }
    if (f.frp != null && (max_frp == null || f.frp > max_frp)) max_frp = f.frp;
    if (f.acquired_at && (updated_at == null || f.acquired_at > updated_at))
      updated_at = f.acquired_at;
  }

  return {
    available: true,
    source,
    count: fires.length,
    updated_at,
    window_days: FIRMS_DAY_RANGE,
    stats: { by_province, by_severity, by_day, max_frp },
    fires,
  };
}

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
    frp: p.frp != null ? Number(p.frp) : null,
    satellite: p.satellite ?? null,
    daynight: p.daynight ?? null,
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

// ── NASA FIRMS (primario, multi-satellite) ────────────────
function firmsUrl(source) {
  // area/csv/{KEY}/{SOURCE}/{west,south,east,north}/{dayRange}
  const [west, south, east, north] = SARDINIA_BBOX;
  const area = `${west},${south},${east},${north}`;
  return `${FIRMS_BASE_URL}/api/area/csv/${FIRMS_MAP_KEY}/${source}/${area}/${FIRMS_DAY_RANGE}`;
}

// Parser CSV minimale (i dati FIRMS non contengono virgole quotate). `source`
// entra nell'id per renderlo unico quando si uniscono più satelliti.
function parseFirmsCsv(text, source) {
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
  const iSat = idx('satellite');
  const iDayNight = idx('daynight');

  return lines.slice(1).map((line, n) => {
    const c = line.split(',');
    // acq_time è HHMM UTC, spesso senza zeri iniziali ("41" = 00:41). Lo
    // normalizziamo a un timestamp ISO così il FE lo formatta correttamente.
    const hhmm =
      iTime !== -1
        ? String(c[iTime] ?? '')
            .trim()
            .padStart(4, '0')
        : '';
    const acquired_at = hhmm
      ? `${c[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`
      : (c[iDate] ?? null);
    return {
      id: `firms-${source}-${n}`,
      lat: Number(c[iLat]),
      lng: Number(c[iLng]),
      acquired_at,
      confidence: iConf !== -1 ? c[iConf] : null,
      brightness: iBright !== -1 ? Number(c[iBright]) : null,
      frp: iFrp !== -1 ? Number(c[iFrp]) : null,
      satellite: iSat !== -1 ? c[iSat] : null,
      daynight: iDayNight !== -1 ? (c[iDayNight] === 'D' ? 'giorno' : 'notte') : null,
      source: 'NASA FIRMS',
    };
  });
}

// Un singolo satellite VIIRS. null se fallisce/risposta inattesa.
async function fetchFirmsSource(source) {
  try {
    const text = await getText(firmsUrl(source));
    // Risposta d'errore FIRMS (chiave errata/limite/day range) è testo non-CSV.
    if (/invalid|error|not\s/i.test(text.slice(0, 60)) && !text.startsWith('latitude')) {
      logger.warn(`fires.firms.${source}.unavailable: ${text.slice(0, 60).trim()}`);
      return null;
    }
    return parseFirmsCsv(text, source);
  } catch (err) {
    logger.warn(`fires.firms.${source}.unavailable: ${err.message}`);
    return null;
  }
}

// Interroga tutti i satelliti in parallelo e unisce. Ritorna l'array unito se
// almeno un satellite ha risposto, altrimenti null (→ fallback EFFIS).
async function tryFirms() {
  if (!FIRMS_MAP_KEY) {
    return null; // FIRMS non configurato
  }
  const settled = await Promise.allSettled(FIRMS_SOURCES.map(fetchFirmsSource));
  const ok = settled.filter((s) => s.status === 'fulfilled' && s.value !== null);
  if (ok.length === 0) return null;
  return ok.flatMap((s) => s.value);
}

// ── Orchestrazione: FIRMS (multi-sat, storico) → EFFIS (24h) → unavailable ──
async function fetchActiveFires() {
  const firms = await tryFirms();
  if (firms) {
    return finalize(firms, 'NASA FIRMS');
  }
  logger.info('fires: FIRMS non disponibile, fallback su EFFIS (solo 24h)');
  const effis = await tryEffis();
  if (effis) {
    return finalize(effis, 'EFFIS');
  }
  return UNAVAILABLE;
}

function getActiveFires() {
  return getOrSet('fires:active', CACHE_TTL.fires, fetchActiveFires);
}

module.exports = { getActiveFires };
