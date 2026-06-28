// src/services/geocode.service.js
// Geocoding luoghi (comuni Sardegna) via Nominatim/OSM. Usato per piazzare gli
// eventi esterni sulla mappa. Cache lunga (i comuni non si spostano) e coda a
// 1 richiesta/secondo per rispettare la usage policy di Nominatim.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { NOMINATIM_URL, GEOCODE_TTL } = require('../constants/sources.constants');
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

function provinceFromAddress(addr, lat, lng) {
  const candidates = [addr?.county, addr?.province, addr?.state_district]
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  for (const c of candidates) {
    for (const [name, code] of Object.entries(PROVINCE_NAME_TO_CODE)) {
      if (c.includes(name)) return code;
    }
  }
  return nearestProvinceCode(lat, lng);
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

// Geocodifica una query (cache-ata). Ritorna {lat,lng,province_code} o null.
function geocode(query) {
  const key = `geocode:${query.toLowerCase().trim()}`;
  return getOrSet(key, GEOCODE_TTL, () =>
    enqueue(() =>
      fetchGeocode(query).catch((err) => {
        logger.warn(`geocode.unavailable "${query}": ${err.message}`);
        return null;
      }),
    ),
  );
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
// arrotondate (~100m) per riusare i punti vicini.
function reverse(lat, lng) {
  if (lat == null || lng == null) return Promise.resolve(null);
  const key = `revgeo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  return getOrSet(key, GEOCODE_TTL, () =>
    enqueue(() =>
      fetchReverse(lat, lng).catch((err) => {
        logger.warn(`geocode.reverse.unavailable ${lat},${lng}: ${err.message}`);
        return null;
      }),
    ),
  );
}

module.exports = { geocode, reverse };
