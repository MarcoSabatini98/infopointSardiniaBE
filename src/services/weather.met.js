// src/services/weather.met.js
// Fallback meteo: MET Norway (api.met.no) Locationforecast/2.0 compact.
// Gratis, senza chiave, raggiungibile dagli IP dei datacenter — Open-Meteo
// invece risponde 429 sull'IP di uscita condiviso di Render. Mappa la risposta
// MET nello stesso shape "raw" di Open-Meteo, così weather.service.buildResult
// e il frontend restano invariati. I campi che MET compact non fornisce
// (temperatura apparente, raffiche, probabilità pioggia, UV, alba/tramonto)
// diventano null: il FE li tollera già.

const { getJson } = require('../utils/httpClient');

const MET_URL =
  process.env.MET_FORECAST_URL || 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
// MET richiede uno User-Agent identificativo con contatto, altrimenti risponde 403.
const UA =
  process.env.MET_USER_AGENT ||
  'infopointSardinia/1.0 (dashboard regionale Sardegna; admin@infopoint.sardegna.it)';

const TZ = 'Europe/Rome';
// en-CA → "YYYY-MM-DD"; ora locale a 24h per raggruppare i giorni nel fuso IT.
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false });
const localDay = (iso) => dayFmt.format(new Date(iso));
const localHour = (iso) => Number(hourFmt.format(new Date(iso)));

// MET dà il vento in m/s; Open-Meteo (default) in km/h → convertiamo per non
// toccare le etichette del FE.
const msToKmh = (v) => (v == null ? null : Math.round(v * 3.6 * 10) / 10);

const CURRENT_UNITS = {
  temperature_2m: '°C',
  apparent_temperature: '°C',
  relative_humidity_2m: '%',
  wind_speed_10m: 'km/h',
  wind_direction_10m: '°',
  wind_gusts_10m: 'km/h',
  precipitation: 'mm',
  pressure_msl: 'hPa',
  cloud_cover: '%',
};
const DAILY_UNITS = {
  temperature_2m_max: '°C',
  temperature_2m_min: '°C',
  precipitation_sum: 'mm',
  wind_speed_10m_max: 'km/h',
};
const HOURLY_UNITS = {
  temperature_2m: '°C',
  relative_humidity_2m: '%',
  precipitation: 'mm',
  wind_speed_10m: 'km/h',
  wind_direction_10m: '°',
};

function symbolOf(ts) {
  const d = ts.data;
  return (
    d.next_1_hours?.summary?.symbol_code ||
    d.next_6_hours?.summary?.symbol_code ||
    d.next_12_hours?.summary?.symbol_code ||
    null
  );
}
function isDay(sym) {
  if (!sym) return null;
  if (sym.endsWith('_day')) return 1;
  if (sym.endsWith('_night')) return 0;
  return null;
}

// symbol_code MET → codice meteo WMO (quello che il FE usa per icona/etichetta).
// Approccio a parole chiave: copre tutte le varianti (light/heavy, showers,
// *andthunder) senza elencarle una a una.
function symbolToWmo(sym) {
  if (!sym) return 3;
  const s = sym.replace(/_(day|night|polartwilight)$/, '');
  const heavy = s.includes('heavy');
  const light = s.includes('light');
  const showers = s.includes('showers');
  if (s.includes('thunder')) return heavy ? 99 : 95;
  if (s.includes('sleet')) return light ? 66 : 67;
  if (s.includes('snow')) {
    if (showers) return heavy ? 86 : 85;
    return heavy ? 75 : light ? 71 : 73;
  }
  if (s.includes('rain')) {
    if (showers) return heavy ? 82 : light ? 80 : 81;
    return heavy ? 65 : light ? 61 : 63;
  }
  if (s.includes('drizzle')) return 51;
  if (s === 'fog') return 45;
  if (s === 'cloudy') return 3;
  if (s === 'partlycloudy') return 2;
  if (s === 'fair') return 1;
  if (s === 'clearsky') return 0;
  return 3;
}

function buildCurrent(ts0) {
  const d = ts0.data.instant.details || {};
  const sym = symbolOf(ts0);
  return {
    time: ts0.time,
    temperature_2m: d.air_temperature ?? null,
    apparent_temperature: null,
    relative_humidity_2m: d.relative_humidity ?? null,
    weather_code: symbolToWmo(sym),
    wind_speed_10m: msToKmh(d.wind_speed),
    wind_direction_10m: d.wind_from_direction ?? null,
    wind_gusts_10m: null,
    precipitation: ts0.data.next_1_hours?.details?.precipitation_amount ?? 0,
    pressure_msl: d.air_pressure_at_sea_level ?? null,
    cloud_cover: d.cloud_area_fraction ?? null,
    is_day: isDay(sym),
  };
}

function buildHourly(series, hours) {
  // Solo le voci a risoluzione oraria (next_1_hours), i primi ~2-3 giorni.
  const rows = series.filter((t) => t.data.next_1_hours).slice(0, hours);
  return {
    time: rows.map((t) => t.time),
    temperature_2m: rows.map((t) => t.data.instant.details?.air_temperature ?? null),
    apparent_temperature: rows.map(() => null),
    relative_humidity_2m: rows.map((t) => t.data.instant.details?.relative_humidity ?? null),
    precipitation_probability: rows.map(() => null),
    precipitation: rows.map((t) => t.data.next_1_hours?.details?.precipitation_amount ?? null),
    weather_code: rows.map((t) => symbolToWmo(symbolOf(t))),
    wind_speed_10m: rows.map((t) => msToKmh(t.data.instant.details?.wind_speed)),
    wind_direction_10m: rows.map((t) => t.data.instant.details?.wind_from_direction ?? null),
  };
}

function buildDaily(series, maxDays) {
  const byDay = new Map();
  for (const t of series) {
    const day = localDay(t.time);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(t);
  }
  const days = [...byDay.keys()].sort().slice(0, maxDays);
  const daily = {
    time: [],
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    apparent_temperature_max: [],
    precipitation_sum: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: [],
    wind_gusts_10m_max: [],
    uv_index_max: [],
    sunrise: [],
    sunset: [],
  };
  for (const day of days) {
    const items = byDay.get(day);
    const temps = items
      .map((t) => t.data.instant.details?.air_temperature)
      .filter((v) => v != null);
    const winds = items.map((t) => t.data.instant.details?.wind_speed).filter((v) => v != null);
    // Precipitazione: blocchi 1h dove presenti; per i giorni più lontani (solo
    // blocchi 6h) sommiamo un blocco ogni 6h sulla griglia locale per non doppiare.
    let precip = 0;
    for (const t of items) {
      const p1 = t.data.next_1_hours?.details?.precipitation_amount;
      if (p1 != null) {
        precip += p1;
        continue;
      }
      const p6 = t.data.next_6_hours?.details?.precipitation_amount;
      if (p6 != null && localHour(t.time) % 6 === 0) precip += p6;
    }
    // Codice del giorno: quello intorno a mezzogiorno locale, altrimenti il primo.
    const noon = items.find((t) => localHour(t.time) >= 12) || items[0];
    daily.time.push(day);
    daily.weather_code.push(symbolToWmo(symbolOf(noon)));
    daily.temperature_2m_max.push(temps.length ? Math.round(Math.max(...temps) * 10) / 10 : null);
    daily.temperature_2m_min.push(temps.length ? Math.round(Math.min(...temps) * 10) / 10 : null);
    daily.apparent_temperature_max.push(null);
    daily.precipitation_sum.push(Math.round(precip * 10) / 10);
    daily.precipitation_probability_max.push(null);
    daily.wind_speed_10m_max.push(winds.length ? msToKmh(Math.max(...winds)) : null);
    daily.wind_gusts_10m_max.push(null);
    daily.uv_index_max.push(null);
    daily.sunrise.push(null);
    daily.sunset.push(null);
  }
  return daily;
}

// Ritorna un oggetto "raw" identico a quello di Open-Meteo (current/daily/hourly
// + *_units), pronto per weather.service.buildResult.
async function fetchMetRaw(lat, lng, full, { days = 14, hours = 48 } = {}) {
  const url = `${MET_URL}?lat=${lat}&lon=${lng}`;
  const json = await getJson(url, { headers: { 'User-Agent': UA }, timeout: 12_000 });
  const series = Array.isArray(json?.properties?.timeseries) ? json.properties.timeseries : [];
  if (series.length === 0) throw new Error('MET: timeseries vuota');
  const raw = {
    current: buildCurrent(series[0]),
    current_units: CURRENT_UNITS,
    daily: buildDaily(series, days),
    daily_units: DAILY_UNITS,
  };
  if (full) {
    raw.hourly = buildHourly(series, hours);
    raw.hourly_units = HOURLY_UNITS;
  }
  return raw;
}

module.exports = { fetchMetRaw, symbolToWmo };
