// src/services/geocode.service.js
// Geocoding luoghi (comuni Sardegna) via Nominatim/OSM. Usato per piazzare gli
// eventi esterni sulla mappa. Cache lunga (i comuni non si spostano) e coda a
// 1 richiesta/secondo per rispettare la usage policy di Nominatim.

const { getJson } = require('../utils/httpClient');
const { get: cacheGet, set: cacheSet } = require('../utils/cache');
const logger = require('../utils/logger');
const {
  NOMINATIM_URL,
  OPEN_METEO_GEOCODING_URL,
  GEOCODE_TTL,
} = require('../constants/sources.constants');
const { nearestProvinceCode } = require('../constants/provinces');

const UA = 'infopointSardinia/1.0 (dashboard regionale; contatto: admin@infopoint.sardegna.it)';

// bbox Sardegna come viewbox Nominatim: left,top,right,bottom (lon/lat).
const VIEWBOX = '8.0,41.3,10.0,38.8';

// Nome provincia (da Nominatim address) → codice.
const PROVINCE_NAME_TO_CODE = {
  cagliari: 'CA',
  sassari: 'SS',
  nuoro: 'NU',
  oristano: 'OR',
  'sud sardegna': 'SU',
  'provincia del sud sardegna': 'SU',
};

// Coda sequenziale: serializza le richieste con ~1.1s tra una e l'altra.
let chain = Promise.resolve();
function enqueue(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

// Nome (comune/provincia) → codice provincia, per substring. null se sconosciuto.
function provinceCodeFromName(name) {
  if (!name) return null;
  const c = name.toLowerCase();
  for (const [key, code] of Object.entries(PROVINCE_NAME_TO_CODE)) {
    if (c.includes(key)) return code;
  }
  return null;
}

function provinceFromAddress(addr, lat, lng) {
  const candidates = [addr?.county, addr?.province, addr?.state_district].filter(Boolean);
  for (const c of candidates) {
    const code = provinceCodeFromName(c);
    if (code) return code;
  }
  return nearestProvinceCode(lat, lng);
}

// ── Open-Meteo Geocoding (sorgente primaria: gratis, senza chiave, cloud-ok) ──
// A differenza di Nominatim non impone rate-limit aggressivi sugli IP dei
// datacenter (Render), che invece riceve 429. Filtra i risultati alla Sardegna.
async function fetchOpenMeteo(query) {
  const params = new URLSearchParams({
    name: query,
    count: '5',
    language: 'it',
    format: 'json',
  });
  const data = await getJson(`${OPEN_METEO_GEOCODING_URL}?${params.toString()}`);
  const results = Array.isArray(data?.results) ? data.results : [];
  const hit = results.find(
    (r) => r.country_code === 'IT' && /sardegna|sardinia/i.test(r.admin1 || ''),
  );
  if (!hit) return null;
  const lat = Number(hit.latitude);
  const lng = Number(hit.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const province_code =
    provinceCodeFromName(hit.admin2) ||
    provinceCodeFromName(hit.admin3) ||
    nearestProvinceCode(lat, lng);
  return { lat, lng, province_code };
}

async function fetchGeocode(query) {
  const params = new URLSearchParams({
    q: `${query}, Sardegna, Italia`,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'it',
    addressdetails: '1',
    'accept-language': 'it',
    viewbox: VIEWBOX,
    bounded: '1',
  });
  const url = `${NOMINATIM_URL}?${params.toString()}`;
  const data = await getJson(url, { headers: { 'User-Agent': UA } });
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, province_code: provinceFromAddress(hit.address, lat, lng) };
}

// Risolve una query: Open-Meteo (cloud-friendly) → fallback Nominatim (in coda
// 1/s). Solo la fonte primaria è sincrona; Nominatim resta serializzato.
async function resolveGeocode(query) {
  try {
    const hit = await fetchOpenMeteo(query);
    if (hit) return hit;
  } catch (err) {
    logger.warn(`geocode.openmeteo.unavailable "${query}": ${err.message}`);
  }
  return enqueue(() =>
    fetchGeocode(query).catch((err) => {
      logger.warn(`geocode.nominatim.unavailable "${query}": ${err.message}`);
      return null;
    }),
  );
}

// Geocodifica una query. Ritorna {lat,lng,province_code} o null. Cache SOLO i
// successi: un errore transitorio (429/timeout) non deve avvelenare la cache
// per 30 giorni facendo sparire città valide.
async function geocode(query) {
  const key = `geocode:${query.toLowerCase().trim()}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await resolveGeocode(query);
  if (result) cacheSet(key, result, GEOCODE_TTL);
  return result;
}

const NOMINATIM_REVERSE = NOMINATIM_URL.replace(/\/search$/, '/reverse');

async function fetchReverse(lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '14',
    addressdetails: '1',
    'accept-language': 'it',
  });
  const data = await getJson(`${NOMINATIM_REVERSE}?${params.toString()}`, {
    headers: { 'User-Agent': UA },
  });
  const a = data?.address;
  if (!a) return null;
  const comune = a.city || a.town || a.village || a.municipality || a.hamlet || null;
  return { comune, province_code: provinceFromAddress(a, lat, lng) };
}

// Reverse-geocoding (coord → comune + provincia). Cache lunga, chiave su coord
// arrotondate (~100m) per riusare i punti vicini. Cache SOLO i successi: i 429
// di Nominatim non devono restare bloccati in cache per 30 giorni.
async function reverse(lat, lng) {
  if (lat == null || lng == null) return null;
  const key = `revgeo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const result = await enqueue(() =>
    fetchReverse(lat, lng).catch((err) => {
      logger.warn(`geocode.reverse.unavailable ${lat},${lng}: ${err.message}`);
      return null;
    }),
  );
  if (result) cacheSet(key, result, GEOCODE_TTL);
  return result;
}

module.exports = { geocode, reverse };
