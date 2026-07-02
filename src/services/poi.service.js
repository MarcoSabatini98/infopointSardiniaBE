// src/services/poi.service.js
// Punti d'interesse turistici via OSM Overpass API (gratis, senza chiave).

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OVERPASS_URL, POI_RADIUS_M, CACHE_TTL } = require('../constants/sources.constants');
const { getProvince } = require('../constants/provinces');

const LIMIT = 80;
// Categorie tourism di default (in assenza di ?tipo=). L'enum è validato a monte
// dal validator, quindi `tipo` non può iniettare Overpass QL.
const DEFAULT_TOURISM = 'information|museum|attraction|viewpoint|artwork|gallery|theme_park|zoo';

function buildQuery(lat, lng, radius, tipo) {
  const around = `around:${radius},${lat},${lng}`;
  const filters = tipo
    ? `nwr["tourism"="${tipo}"](${around});`
    : `nwr["tourism"~"^(${DEFAULT_TOURISM})$"](${around});nwr["historic"](${around});`;
  return `[out:json][timeout:25];(${filters});out center ${LIMIT};`;
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

async function fetchPoi(lat, lng, radius, tipo) {
  const raw = await getJson(OVERPASS_URL, {
    method: 'POST',
    timeout: 30_000,
    // Overpass.de risponde 406 al default UA di Node fetch: serve UA reale + Accept.
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'infopointSardinia/1.0',
      Accept: 'application/json',
    },
    body: `data=${encodeURIComponent(buildQuery(lat, lng, radius, tipo))}`,
  });
  const items = (raw.elements ?? [])
    .map(mapElement)
    .filter((p) => p.name && p.lat != null && p.lng != null); // solo POI nominati e localizzabili
  return {
    available: true,
    center: { lat, lng },
    radius_m: radius,
    count: items.length,
    items,
  };
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

module.exports = { getByCoords, getByProvince };
