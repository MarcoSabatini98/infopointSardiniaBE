// src/services/weather.service.js
// Meteo via Open-Meteo (gratis, senza chiave).
//  - getAll(): versione leggera (corrente + 5 giorni) per il layer mappa.
//  - getByProvince()/getByCoords(): versione completa (corrente dettagliata +
//    orario 48h + giornaliero fino a 14 giorni + avvisi derivati) per la
//    pagina meteo.

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { OPEN_METEO_BASE_URL, CACHE_TTL } = require('../constants/sources.constants');
const { PROVINCES, getProvince } = require('../constants/provinces');

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'precipitation',
  'pressure_msl',
  'cloud_cover',
  'is_day',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
].join(',');

const DAILY_FULL = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'uv_index_max',
  'sunrise',
  'sunset',
].join(',');

const DAILY_LIGHT = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';

const FORECAST_DAYS = Math.min(Number(process.env.WEATHER_FORECAST_DAYS) || 14, 16);
const FORECAST_HOURS = 48;

function buildUrl(lat, lng, full) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: CURRENT_FIELDS,
    daily: full ? DAILY_FULL : DAILY_LIGHT,
    timezone: 'Europe/Rome',
    forecast_days: String(full ? FORECAST_DAYS : 5),
  });
  if (full) {
    params.set('hourly', HOURLY_FIELDS);
    params.set('forecast_hours', String(FORECAST_HOURS));
  }
  return `${OPEN_METEO_BASE_URL}/forecast?${params.toString()}`;
}

// Avvisi meteo derivati dai valori giornalieri (oggi + domani). Open-Meteo non
// fornisce bollettini ufficiali: questi sono soglie indicative, da affiancare
// alle allerte della Protezione Civile.
function deriveAdvisories(daily) {
  if (!daily || !Array.isArray(daily.time)) return [];
  const out = [];
  for (let i = 0; i < Math.min(2, daily.time.length); i++) {
    const day = daily.time[i];
    const tmax = daily.temperature_2m_max?.[i];
    const gust = daily.wind_gusts_10m_max?.[i];
    const rain = daily.precipitation_sum?.[i];
    const uv = daily.uv_index_max?.[i];
    if (tmax != null && tmax >= 35) {
      out.push({
        type: 'caldo',
        level: tmax >= 38 ? 'danger' : 'warn',
        label: `Ondata di calore (${Math.round(tmax)}°)`,
        day,
      });
    }
    if (gust != null && gust >= 70) {
      out.push({
        type: 'vento',
        level: gust >= 90 ? 'danger' : 'warn',
        label: `Vento forte (raffiche ${Math.round(gust)} km/h)`,
        day,
      });
    }
    if (rain != null && rain >= 40) {
      out.push({
        type: 'pioggia',
        level: rain >= 80 ? 'danger' : 'warn',
        label: `Pioggia intensa (${Math.round(rain)} mm) — rischio allagamenti`,
        day,
      });
    }
    if (uv != null && uv >= 8) {
      out.push({
        type: 'uv',
        level: 'warn',
        label: `Indice UV molto alto (${Math.round(uv)})`,
        day,
      });
    }
  }
  return out;
}

function buildResult(raw, meta, full) {
  const base = {
    coordinates: { lat: meta.lat, lng: meta.lng },
    current: raw.current ?? null,
    units: { current: raw.current_units ?? null, daily: raw.daily_units ?? null },
    daily: raw.daily ?? null,
  };
  if (meta.code) {
    base.province = { code: meta.code, name: meta.name };
  } else {
    base.location = {
      name: meta.name,
      lat: meta.lat,
      lng: meta.lng,
      province_code: meta.province_code ?? null,
    };
  }
  if (full) {
    base.hourly = raw.hourly ?? null;
    base.units.hourly = raw.hourly_units ?? null;
    base.advisories = deriveAdvisories(raw.daily);
  }
  return base;
}

async function fetchPoint(meta, full) {
  const raw = await getJson(buildUrl(meta.lat, meta.lng, full));
  return buildResult(raw, meta, full);
}

// Meteo completo di una provincia (centroide capoluogo).
function getByProvince(code) {
  const province = getProvince(code);
  if (!province) {
    throw new AppError(`Provincia "${code}" non valida`, 400);
  }
  return getOrSet(`weather:full:${province.code}`, CACHE_TTL.weather, () =>
    fetchPoint(
      { lat: province.lat, lng: province.lng, code: province.code, name: province.name },
      true,
    ),
  );
}

// Meteo completo per coordinate arbitrarie (ricerca città).
function getByCoords(lat, lng, name, province_code) {
  const key = `weather:full:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  return getOrSet(key, CACHE_TTL.weather, () =>
    fetchPoint({ lat, lng, name, province_code }, true),
  );
}

// Versione leggera di tutte le province (layer mappa).
function getAll() {
  return getOrSet('weather:all', CACHE_TTL.weather, () =>
    Promise.all(
      PROVINCES.map((p) =>
        fetchPoint({ lat: p.lat, lng: p.lng, code: p.code, name: p.name }, false),
      ),
    ),
  );
}

module.exports = { getByProvince, getByCoords, getAll };
