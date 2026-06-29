// src/services/marine.service.js
// Condizioni del mare via Open-Meteo Marine (gratis, senza chiave). Un punto
// costiero rappresentativo per provincia (il capoluogo di Nuoro è interno →
// usiamo punti sulla costa).

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OPEN_METEO_MARINE_URL, CACHE_TTL } = require('../constants/sources.constants');

// Punti costieri per provincia.
const COAST = [
  { code: 'CA', name: 'Cagliari', lat: 39.18, lng: 9.12 },
  { code: 'SS', name: 'Sassari (Alghero)', lat: 40.55, lng: 8.3 },
  { code: 'NU', name: 'Nuoro (Orosei)', lat: 40.38, lng: 9.7 },
  { code: 'OR', name: 'Oristano', lat: 39.87, lng: 8.49 },
  { code: 'SU', name: 'Sud Sardegna (Sant’Antioco)', lat: 39.07, lng: 8.44 },
];
const BY_CODE = Object.fromEntries(COAST.map((c) => [c.code, c]));

const CURRENT = 'wave_height,wave_direction,wave_period,sea_surface_temperature';
const DAILY = 'wave_height_max,wave_direction_dominant,wave_period_max';

function buildUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: CURRENT,
    daily: DAILY,
    timezone: 'Europe/Rome',
    forecast_days: '3',
  });
  return `${OPEN_METEO_MARINE_URL}?${params.toString()}`;
}

async function fetchPoint(p) {
  const raw = await getJson(buildUrl(p.lat, p.lng));
  return {
    province: { code: p.code, name: p.name },
    coordinates: { lat: p.lat, lng: p.lng },
    current: raw.current ?? null,
    units: { current: raw.current_units ?? null, daily: raw.daily_units ?? null },
    daily: raw.daily ?? null,
  };
}

function getByProvince(code) {
  const p = BY_CODE[String(code).toUpperCase()];
  if (!p) throw new AppError(`Provincia "${code}" non valida`, 400);
  return getOrSet(`marine:${p.code}`, CACHE_TTL.marine, () => fetchPoint(p));
}

function getAll() {
  return getOrSet('marine:all', CACHE_TTL.marine, () => Promise.all(COAST.map(fetchPoint)));
}

module.exports = { getByProvince, getAll };
