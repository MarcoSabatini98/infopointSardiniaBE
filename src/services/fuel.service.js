// src/services/fuel.service.js
// Prezzi carburanti praticati via MIMIT (open data, due CSV aggiornati ogni
// giorno: anagrafica impianti + prezzi). Uniamo per idImpianto e filtriamo
// sulle province sarde. Cache lunga (i prezzi cambiano ~1 volta al giorno).

const { getText } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const {
  MIMIT_PRICES_URL,
  MIMIT_STATIONS_URL,
  CACHE_TTL,
} = require('../constants/sources.constants');
const { PROVINCE_CODES } = require('../constants/provinces');

const SARDINIA = new Set(PROVINCE_CODES); // CA, SS, NU, OR, SU

// Due CSV nazionali da ~4 MB l'uno: il timeout di default (10s) scatta prima
// che finisca il download dal datacenter. Cache lunga, quindi attesa rara.
const MIMIT_TIMEOUT_MS = 45_000;

// I CSV MIMIT hanno una prima riga con la data di estrazione, poi l'header,
// poi i dati. Separatore '|'.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return { header: [], rows: [] };
  const header = lines[1].split('|');
  const rows = lines.slice(2).map((l) => l.split('|'));
  return { header, rows };
}

function num(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function fetchFuel() {
  let stationsCsv, pricesCsv;
  try {
    [stationsCsv, pricesCsv] = await Promise.all([
      getText(MIMIT_STATIONS_URL, { timeout: MIMIT_TIMEOUT_MS }),
      getText(MIMIT_PRICES_URL, { timeout: MIMIT_TIMEOUT_MS }),
    ]);
  } catch (err) {
    logger.warn(`fuel.mimit.unavailable: ${err.message}`);
    return { available: false, count: 0, stations: [], error: 'Sorgente prezzi non disponibile' };
  }

  // Anagrafica: idImpianto;Gestore;Bandiera;Tipo Impianto;Nome Impianto;Indirizzo;Comune;Provincia;Latitudine;Longitudine
  const st = parseCsv(stationsCsv);
  const stations = new Map();
  for (const c of st.rows) {
    const provincia = (c[7] || '').trim().toUpperCase();
    if (!SARDINIA.has(provincia)) continue;
    const id = c[0];
    stations.set(id, {
      id,
      brand: (c[2] || '').trim() || null,
      name: (c[4] || '').trim() || null,
      address: (c[5] || '').trim() || null,
      comune: (c[6] || '').trim() || null,
      province_code: provincia,
      lat: num(c[8]),
      lng: num(c[9]),
      fuels: [],
    });
  }

  // Prezzi: idImpianto;descCarburante;prezzo;isSelf;dtComu
  const pr = parseCsv(pricesCsv);
  let updated_at = null;
  for (const c of pr.rows) {
    const station = stations.get(c[0]);
    if (!station) continue;
    const price = num(c[2]);
    if (price == null) continue;
    station.fuels.push({
      type: (c[1] || '').trim(),
      price,
      self: c[3] === '1' || /self/i.test(c[3] || ''),
    });
    const dt = (c[4] || '').trim();
    if (dt && (!updated_at || dt > updated_at)) updated_at = dt;
  }

  // Solo impianti con almeno un prezzo.
  const list = [...stations.values()].filter((s) => s.fuels.length > 0);

  const by_province = {};
  for (const s of list) by_province[s.province_code] = (by_province[s.province_code] || 0) + 1;

  return {
    available: true,
    count: list.length,
    updated_at,
    stats: { by_province },
    stations: list,
  };
}

function getStations() {
  return getOrSet('fuel:sardinia', CACHE_TTL.fuel, fetchFuel);
}

module.exports = { getStations };
