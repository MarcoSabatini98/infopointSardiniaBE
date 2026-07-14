// src/services/air.service.js
// Qualità dell'aria + pollini via Open-Meteo Air Quality (gratis, senza chiave).

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OPEN_METEO_AIR_URL, CACHE_TTL } = require('../constants/sources.constants');
const { getProvince } = require('../constants/provinces');

const CURRENT = [
  'european_aqi',
  'pm10',
  'pm2_5',
  'ozone',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'carbon_monoxide',
  'uv_index',
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'olive_pollen',
  'ragweed_pollen',
].join(',');

// Etichetta qualità aria dall'European AQI.
function aqiLabel(aqi) {
  if (aqi == null) return null;
  if (aqi <= 20) return 'buona';
  if (aqi <= 40) return 'discreta';
  if (aqi <= 60) return 'moderata';
  if (aqi <= 80) return 'scarsa';
  if (aqi <= 100) return 'molto scarsa';
  return 'pessima';
}

function buildUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: CURRENT,
    timezone: 'Europe/Rome',
  });
  return `${OPEN_METEO_AIR_URL}?${params.toString()}`;
}

async function fetchPoint(lat, lng) {
  const raw = await getJson(buildUrl(lat, lng));
  const current = raw.current ?? null;
  return {
    coordinates: { lat, lng },
    current,
    units: raw.current_units ?? null,
    aqi_label: aqiLabel(current?.european_aqi),
  };
}

function getByCoords(lat, lng) {
  const key = `air:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  return getOrSet(key, CACHE_TTL.air, () => fetchPoint(lat, lng));
}

function getByProvince(code) {
  const p = getProvince(code);
  if (!p) throw new AppError(`Provincia "${code}" non valida`, 400);
  return getByCoords(p.lat, p.lng);
}

module.exports = { getByCoords, getByProvince, aqiLabel };
