// src/services/map.service.js
// Dati per la mappa interattiva: GeoJSON province (statico), metadati, layer
// selezionabili e aggregazione per provincia (click-provincia).

const fs = require('fs');
const path = require('path');
const AppError = require('../errors/AppError');
const {
  PROVINCES,
  PROVINCE_BY_CODE,
  getProvince,
  nearestProvinceCode,
} = require('../constants/provinces');
const { EVENT_STATUS } = require('../constants/event.constants');

const weatherService = require('./weather.service');
const firesService = require('./fires.service');
const floodsService = require('./floods.service');
const newsService = require('./news.service');
const flightsService = require('./flights.service');
const vesselsService = require('./vessels.service');
const trafficService = require('./traffic.service');
const agendaService = require('./agenda.service');
const eventRepository = require('../repositories/event.repository');

const GEOJSON_PATH = path.resolve(__dirname, '../data/provinces.geojson');

// Letto una volta sola e tenuto in memoria: file statico, non cambia a runtime.
let geojsonCache = null;
function getProvincesGeoJSON() {
  if (!geojsonCache) {
    geojsonCache = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  }
  return geojsonCache;
}

function getProvinces() {
  return PROVINCES;
}

const LAYERS = ['weather', 'fires', 'floods', 'news', 'events', 'flights', 'vessels', 'traffic'];

// Eventi mappabili in forma uniforme: eventi del DB (esclusi gli annullati,
// incluse le bozze così l'operatore vede anche i suoi appunti) con coordinate,
// più gli eventi esterni geocodati (un punto per ogni luogo).
async function getMappableEvents() {
  const [dbRes, ext] = await Promise.all([
    eventRepository.findAll({}, { page: 1, limit: 200 }).catch(() => ({ data: [] })),
    agendaService.getGeocodedEvents().catch(() => ({ events: [] })),
  ]);

  const dbEvents = (dbRes.data ?? [])
    .filter((e) => e.status !== EVENT_STATUS.ANNULLATO && e.lat != null && e.lng != null)
    .map((e) => ({
      title: e.title,
      lat: Number(e.lat),
      lng: Number(e.lng),
      province_code: e.province_code,
      comune: e.comune,
      date: e.start_date,
      category: e.category,
      status: e.status,
      source: 'Gestione',
      uuid: e.uuid,
    }));

  const extEvents = (ext.events ?? []).flatMap((e) =>
    (e.places ?? []).map((p) => ({
      title: e.title,
      lat: p.lat,
      lng: p.lng,
      province_code: p.province_code,
      comune: p.name,
      date: e.date,
      category: 'culturale',
      status: 'pubblicato',
      source: e.source,
      link: e.link,
    })),
  );

  return [...dbEvents, ...extEvents];
}

async function getLayer(layer) {
  switch (layer) {
    case 'weather':
      return weatherService.getAll();
    case 'fires':
      return firesService.getActiveFires();
    case 'floods':
      return floodsService.getAlerts();
    case 'news':
      return newsService.getNews(30);
    case 'flights':
      return flightsService.getFlights();
    case 'vessels':
      return vesselsService.getVessels();
    case 'traffic':
      return trafficService.getIncidents();
    case 'events': {
      const events = await getMappableEvents();
      return { count: events.length, events };
    }
    default:
      throw new AppError(`Layer "${layer}" non valido`, 400);
  }
}

// Aggregazione per il click su una provincia: meteo + incendi nelle vicinanze
// + allerte + eventi culturali in programma + ultime news.
async function getProvinceInfo(code) {
  const province = getProvince(code);
  if (!province) {
    throw new AppError(`Provincia "${code}" non valida`, 400);
  }

  const [weather, fires, floods, allEvents] = await Promise.all([
    weatherService.getByProvince(province.code).catch(() => null),
    firesService.getActiveFires().catch(() => ({ fires: [] })),
    floodsService.getAlerts().catch(() => ({ alerts: [] })),
    getMappableEvents().catch(() => []),
  ]);

  const provinceFires = (fires.fires ?? []).filter(
    (f) => nearestProvinceCode(f.lat, f.lng) === province.code,
  );
  const provinceEvents = allEvents.filter((e) => e.province_code === province.code);

  return {
    province: PROVINCE_BY_CODE[province.code],
    weather,
    fires: { count: provinceFires.length, items: provinceFires },
    alerts: { count: (floods.alerts ?? []).length, items: floods.alerts ?? [] },
    events: { count: provinceEvents.length, items: provinceEvents },
  };
}

module.exports = { getProvincesGeoJSON, getProvinces, getLayer, getProvinceInfo, LAYERS };
