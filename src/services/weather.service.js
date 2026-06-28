// src/services/weather.service.js
// Meteo via Open-Meteo (gratis, senza chiave). Una lookup puntuale per
// provincia usando il centroide del capoluogo. Cache TTL per non martellare
// l'API a ogni richiesta del FE.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OPEN_METEO_BASE_URL, CACHE_TTL } = require('../constants/sources.constants');
const { PROVINCES, getProvince } = require('../constants/provinces');

const CURRENT_FIELDS =
  'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,is_day';
const DAILY_FIELDS =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset';

function buildUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: CURRENT_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'Europe/Rome',
    forecast_days: '5',
  });
  return `${OPEN_METEO_BASE_URL}/forecast?${params.toString()}`;
}

async function fetchForProvince(province) {
  const raw = await getJson(buildUrl(province.lat, province.lng));
  return {
    province: { code: province.code, name: province.name },
    coordinates: { lat: province.lat, lng: province.lng },
    current: raw.current ?? null,
    units: { current: raw.current_units ?? null, daily: raw.daily_units ?? null },
    daily: raw.daily ?? null,
  };
}

// Meteo di una singola provincia (cache per-codice).
function getByProvince(code) {
  const province = getProvince(code);
  if (!province) {
    throw new AppError(`Provincia "${code}" non valida`, 400);
  }
  return getOrSet(`weather:${province.code}`, CACHE_TTL.weather, () => fetchForProvince(province));
}

// Meteo corrente di tutte le province (layer mappa meteo). Cache aggregata.
function getAll() {
  return getOrSet('weather:all', CACHE_TTL.weather, () =>
    Promise.all(PROVINCES.map((p) => fetchForProvince(p))),
  );
}

module.exports = { getByProvince, getAll };
