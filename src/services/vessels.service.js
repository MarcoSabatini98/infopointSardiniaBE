// src/services/vessels.service.js
// Traffico marittimo live via aisstream.io. L'AIS è uno stream WebSocket, non
// una REST: teniamo un piccolo collector che mantiene in memoria l'ultima
// posizione per nave (per MMSI) e l'endpoint ne restituisce lo snapshot.
//
// ponytail: collector minimale in-process. Un solo socket, una Map. Si avvia
// solo se AISSTREAM_API_KEY è impostata (altrimenti l'endpoint torna
// available:false). Usa il WebSocket globale di Node (>=22) → niente dipendenza
// `ws`. Per scalare multi-istanza servirebbe un collector dedicato + store
// condiviso, ma per single-instance questo basta.

const logger = require('../utils/logger');
const {
  AISSTREAM_URL,
  AISSTREAM_API_KEY,
  AISSTREAM_MAX_AGE_MS,
} = require('../constants/sources.constants');
const { SARDINIA_BBOX } = require('../constants/provinces');

const [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX] = SARDINIA_BBOX;
// aisstream vuole le bbox come [[ [lat_min, lon_min], [lat_max, lon_max] ]].
const SUBSCRIPTION_BBOX = [
  [
    [LAT_MIN, LON_MIN],
    [LAT_MAX, LON_MAX],
  ],
];

const RECONNECT_DELAY_MS = 10_000;

// Stato del collector (module-level singleton).
const vessels = new Map(); // MMSI → ultima posizione
let socket = null;
let stopping = false;
let reconnectTimer = null;

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.MessageType !== 'PositionReport') return;

  const meta = msg.MetaData || {};
  const report = msg.Message?.PositionReport || {};
  const mmsi = meta.MMSI;
  if (!mmsi) return;

  vessels.set(mmsi, {
    mmsi,
    name: (meta.ShipName || '').trim() || null,
    lat: meta.latitude ?? report.Latitude ?? null,
    lng: meta.longitude ?? report.Longitude ?? null,
    sog: report.Sog ?? null, // speed over ground (nodi)
    cog: report.Cog ?? null, // course over ground
    heading: report.TrueHeading ?? null,
    updated_at: meta.time_utc || new Date().toISOString(),
    // received_at numerico per il pruning: il time_utc di aisstream
    // ("... +0000 UTC") non è parsabile da Date.parse → NaN.
    received_at: Date.now(),
  });
}

function connect() {
  socket = new WebSocket(AISSTREAM_URL);
  // aisstream invia i frame come binario: il WebSocket di Node li consegna
  // come Blob di default (toString → "[object Blob]" → parse fallisce).
  // arraybuffer permette di decodificarli in sincrono con Buffer.
  socket.binaryType = 'arraybuffer';

  socket.addEventListener('open', () => {
    logger.info('vessels.aisstream.connected');
    socket.send(
      JSON.stringify({
        APIKey: AISSTREAM_API_KEY,
        BoundingBoxes: SUBSCRIPTION_BBOX,
        FilterMessageTypes: ['PositionReport'],
      }),
    );
  });

  socket.addEventListener('message', (event) => {
    let data = null;
    if (typeof event.data === 'string') {
      data = event.data;
    } else if (event.data instanceof ArrayBuffer) {
      data = Buffer.from(event.data).toString('utf8');
    }
    if (data) handleMessage(data);
  });

  socket.addEventListener('error', (event) => {
    logger.warn(`vessels.aisstream.error: ${event.message || 'socket error'}`);
  });

  socket.addEventListener('close', () => {
    if (stopping) return;
    logger.warn(`vessels.aisstream.closed — riconnessione tra ${RECONNECT_DELAY_MS}ms`);
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    reconnectTimer.unref?.();
  });
}

function startCollector() {
  if (!AISSTREAM_API_KEY) {
    logger.warn('vessels.aisstream.disabled — AISSTREAM_API_KEY non impostata');
    return;
  }
  if (socket) return; // già avviato
  stopping = false;
  connect();
}

function stopCollector() {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) {
    try {
      socket.close();
    } catch {
      /* noop */
    }
    socket = null;
  }
}

// Snapshot delle navi con posizione recente (scarta le stale).
function getVessels() {
  if (!AISSTREAM_API_KEY) {
    return { available: false, count: 0, vessels: [], note: 'AISSTREAM_API_KEY non impostata' };
  }
  const now = Date.now();
  const fresh = [];
  for (const v of vessels.values()) {
    if (now - v.received_at <= AISSTREAM_MAX_AGE_MS) {
      // received_at è interno: non esporlo nella response.
      const { received_at, ...vessel } = v;
      void received_at;
      fresh.push(vessel);
    }
  }
  return { available: true, count: fresh.length, vessels: fresh };
}

module.exports = { startCollector, stopCollector, getVessels };
