// src/services/poi.service.js
// Punti d'interesse turistici via OSM Overpass API (gratis, senza chiave).

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OVERPASS_ENDPOINTS, POI_RADIUS_M, CACHE_TTL } = require('../constants/sources.constants');
const { getProvince, SARDINIA_BBOX } = require('../constants/provinces');

const LIMIT = 80;
// Categorie tourism di default (in assenza di ?tipo=). L'enum è validato a monte
// dal validator, quindi `tipo` non può iniettare Overpass QL.
const DEFAULT_TOURISM = 'information|museum|attraction|viewpoint|artwork|gallery|theme_park|zoo';

// Bbox Sardegna in ordine Overpass (south,west,north,east).
function overpassBbox() {
  const [w, s, e, n] = SARDINIA_BBOX; // [lon_min, lat_min, lon_max, lat_max]
  return `${s},${w},${n},${e}`;
}

// Neutralizza i metacaratteri regex: `q` finisce in un match Overpass "~".
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQuery(lat, lng, radius, tipo) {
  const around = `around:${radius},${lat},${lng}`;
  const filters = tipo
    ? `nwr["tourism"="${tipo}"](${around});`
    : `nwr["tourism"~"^(${DEFAULT_TOURISM})$"](${around});nwr["historic"](${around});`;
  return `[out:json][timeout:25];(${filters});out center ${LIMIT};`;
}

// Ricerca per nome su tutta la Sardegna (case-insensitive). Timeout server alto:
// il match regex sul nome per l'intera bbox isola è pesante.
function buildSearchQuery(q, tipo) {
  const bbox = overpassBbox();
  const name = `["name"~"${escapeRegex(q)}",i]`;
  const filters = tipo
    ? `nwr["tourism"="${tipo}"]${name}(${bbox});`
    : `nwr["tourism"]${name}(${bbox});nwr["historic"]${name}(${bbox});`;
  return `[out:json][timeout:60];(${filters});out center ${LIMIT};`;
}

function mapElement(el) {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const tags = el.tags ?? {};
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name ?? null,
    kind: tags.tourism ?? tags.historic ?? null,
    lat,
    lng,
  };
}

// POST a Overpass. UA reale + Accept: col default di Node fetch risponde 406.
function overpassPost(url, ql, timeout) {
  return getJson(url, {
    method: 'POST',
    timeout,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'infopointSardinia/1.0',
      Accept: 'application/json',
    },
    body: `data=${encodeURIComponent(ql)}`,
  });
}

// Prova le istanze in ordine; su errore (429/504/timeout) passa alla successiva.
// Overpass può rispondere 200 ma con `remark` di timeout server-side (risultato
// vuoto): lo trattiamo come fallimento e proviamo l'istanza dopo.
async function overpassQuery(ql, timeout = 30_000) {
  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const data = await overpassPost(url, ql, timeout);
      if (data?.remark && /timed out|runtime error/i.test(data.remark)) {
        throw new AppError(`Overpass remark: ${data.remark}`, 504);
      }
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function toItems(raw) {
  // solo POI nominati e localizzabili
  return (raw.elements ?? [])
    .map(mapElement)
    .filter((p) => p.name && p.lat != null && p.lng != null);
}

async function fetchPoi(lat, lng, radius, tipo) {
  const items = toItems(await overpassQuery(buildQuery(lat, lng, radius, tipo)));
  return { available: true, center: { lat, lng }, radius_m: radius, count: items.length, items };
}

// ponytail: centroide provincia + raggio = euristica "nei dintorni". Per coprire
// l'intera provincia servirebbe bbox/poligono GeoJSON; per un infopoint va bene così.
async function getByCoords(lat, lng, tipo) {
  const radius = POI_RADIUS_M;
  const key = `poi:${lat.toFixed(2)}:${lng.toFixed(2)}:${tipo || 'all'}`;
  try {
    return await getOrSet(key, CACHE_TTL.poi, () => fetchPoi(lat, lng, radius, tipo));
  } catch {
    return { available: false, center: { lat, lng }, radius_m: radius, count: 0, items: [] };
  }
}

function getByProvince(code, tipo) {
  const p = getProvince(code);
  if (!p) throw new AppError(`Provincia "${code}" non valida`, 400);
  return getByCoords(p.lat, p.lng, tipo);
}

async function fetchSearch(q, tipo) {
  const items = toItems(await overpassQuery(buildSearchQuery(q, tipo), 60_000));
  return { available: true, query: q, count: items.length, items };
}

async function searchByName(q, tipo) {
  const key = `poi:search:${q.trim().toLowerCase()}:${tipo || 'all'}`;
  try {
    return await getOrSet(key, CACHE_TTL.poi, () => fetchSearch(q.trim(), tipo));
  } catch {
    return { available: false, query: q, count: 0, items: [] };
  }
}

module.exports = { getByCoords, getByProvince, searchByName };
