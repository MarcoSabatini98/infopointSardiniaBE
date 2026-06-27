// src/services/map.service.js
// Dati per la mappa interattiva: GeoJSON province (statico), metadati, layer
// selezionabili e aggregazione per provincia (click-provincia).

const fs = require('fs');
const path = require('path');
const AppError = require('../errors/AppError');
const { PROVINCES, PROVINCE_BY_CODE, getProvince } = require('../constants/provinces');
const { EVENT_TYPES, EVENT_STATUS } = require('../constants/event.constants');

const weatherService = require('./weather.service');
const firesService = require('./fires.service');
const floodsService = require('./floods.service');
const newsService = require('./news.service');
const flightsService = require('./flights.service');
const vesselsService = require('./vessels.service');
const trafficService = require('./traffic.service');
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

// Distanza haversine (km) — per assegnare un incendio alla provincia più vicina.
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ponytail: assegnazione incendio→provincia per centroide più vicino. È
// un'euristica; per precisione reale serve point-in-polygon sui confini ISTAT
// (quando il GeoJSON placeholder sarà sostituito con i poligoni veri).
function nearestProvinceCode(lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null;
  let bestDist = Infinity;
  for (const p of PROVINCES) {
    const d = distanceKm(lat, lng, p.lat, p.lng);
    if (d < bestDist) {
      bestDist = d;
      best = p.code;
    }
  }
  return best;
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
      const { data } = await eventRepository.findAll(
        { status: EVENT_STATUS.PUBBLICATO },
        { page: 1, limit: 100 },
      );
      return { count: data.length, events: data };
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

  const [weather, fires, floods, eventsResult] = await Promise.all([
    weatherService.getByProvince(province.code).catch(() => null),
    firesService.getActiveFires().catch(() => ({ fires: [] })),
    floodsService.getAlerts().catch(() => ({ alerts: [] })),
    eventRepository.findAll(
      {
        province_code: province.code,
        type: EVENT_TYPES.CULTURALE,
        status: EVENT_STATUS.PUBBLICATO,
      },
      { page: 1, limit: 20 },
    ),
  ]);

  const provinceFires = (fires.fires ?? []).filter(
    (f) => nearestProvinceCode(f.lat, f.lng) === province.code,
  );

  return {
    province: PROVINCE_BY_CODE[province.code],
    weather,
    fires: { count: provinceFires.length, items: provinceFires },
    alerts: { count: (floods.alerts ?? []).length, items: floods.alerts ?? [] },
    events: { count: eventsResult.data.length, items: eventsResult.data },
  };
}

module.exports = { getProvincesGeoJSON, getProvinces, getLayer, getProvinceInfo, LAYERS };
