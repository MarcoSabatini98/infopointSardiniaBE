// src/services/flood.service.js
// Portata fiumi / rischio piena via Open-Meteo Flood (GloFAS, gratis, senza chiave).

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OPEN_METEO_FLOOD_URL, CACHE_TTL } = require('../constants/sources.constants');
const { getProvince } = require('../constants/provinces');

function buildUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'river_discharge',
    forecast_days: '7',
    timezone: 'Europe/Rome',
  });
  return `${OPEN_METEO_FLOOD_URL}?${params.toString()}`;
}

async function fetchPoint(lat, lng) {
  const raw = await getJson(buildUrl(lat, lng));
  const daily = raw.daily ?? null;
  const series = Array.isArray(daily?.river_discharge) ? daily.river_discharge : [];
  const valid = series.filter((v) => v != null);
  return {
    available: true,
    coordinates: { lat, lng },
    unit: raw.daily_units?.river_discharge ?? 'm³/s',
    today: series[0] ?? null,
    max_7d: valid.length ? Math.max(...valid) : null,
    daily,
  };
}

// Successo → cache; fonte giù → available:false NON cachato (retry al prossimo giro).
async function getByCoords(lat, lng) {
  const key = `flood:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  try {
    return await getOrSet(key, CACHE_TTL.flood, () => fetchPoint(lat, lng));
  } catch {
    return { available: false, coordinates: { lat, lng } };
  }
}

function getByProvince(code) {
  const p = getProvince(code);
  if (!p) throw new AppError(`Provincia "${code}" non valida`, 400);
  return getByCoords(p.lat, p.lng);
}

module.exports = { getByCoords, getByProvince };
