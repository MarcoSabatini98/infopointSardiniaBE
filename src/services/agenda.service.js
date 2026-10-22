// src/services/agenda.service.js
// Eventi culturali dalla fonte ufficiale SardegnaTurismo (scraping della pagina
// /it/eventi, Drupal). Due viste:
//   - getExternalEvents(): veloce, per la pagina Eventi (luoghi come testo).
//   - getGeocodedEvents(): luoghi geocodati (lat/lng + provincia) per la mappa
//     e per il filtro per provincia. Multi-luogo supportato.

const cheerio = require('cheerio');
const { getText } = require('../utils/httpClient');
const { getOrSet, get } = require('../utils/cache');
const logger = require('../utils/logger');
const { geocode } = require('./geocode.service');
const { SARDEGNATURISMO_EVENTS_URL, CACHE_TTL } = require('../constants/sources.constants');

const BASE = 'https://www.sardegnaturismo.it';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Luoghi generici non mappabili → nessuna geocodifica.
const GENERIC = [
  'diverse località',
  'diverse localita',
  'varie località',
  'più sedi',
  'diverse sedi',
  'vari comuni',
  'tutta la sardegna',
  'sardegna',
  'itinerante',
  'online',
];

function abs(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : `${BASE}${href}`;
}
function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim() || null;
}

// Estrae i nomi di luogo concreti dal campo location ("Cagliari", "Alghero,
// Bosa", "Diverse località"). Scarta i termini generici.
function parsePlaces(location) {
  if (!location) return [];
  return location
    .split(/\s*[,;/·]\s*|\s+-\s+|\s+e\s+/i)
    .map((s) => clean(s))
    .filter((s) => s && !GENERIC.includes(s.toLowerCase()) && s.length > 2);
}

function parse(html) {
  const $ = cheerio.load(html);
  const events = [];
  $('.node-evento.node-teaser').each((_, el) => {
    const node = $(el);
    // Il sito ha rinominato la classe (field-name-title-field → field--name-title):
    // teniamo entrambe così un ritorno al vecchio markup non svuota di nuovo la lista.
    const titleA = node.find('.field--name-title a, .field-name-title-field a').first();
    const title = clean(titleA.text());
    if (!title) return;
    const location = clean(node.find('.field-name-field-riassunto-tappe-nomi').first().text());
    events.push({
      title,
      link: abs(titleA.attr('href')),
      date: clean(node.find('.field-name-field-riassunto-tappe-data').first().text()),
      location,
      placeNames: parsePlaces(location),
      image: abs(node.find('.field-name-field-immagine-top img').first().attr('src')),
      source: 'SardegnaTurismo',
    });
  });
  return events;
}

async function fetchExternalEvents() {
  try {
    const html = await getText(SARDEGNATURISMO_EVENTS_URL, { headers: { 'User-Agent': UA } });
    const events = parse(html);
    return { available: true, source: 'SardegnaTurismo', count: events.length, events };
  } catch (err) {
    logger.warn(`agenda.sardegnaturismo.unavailable: ${err.message}`);
    return { available: false, count: 0, events: [], error: 'Sorgente eventi non disponibile' };
  }
}

function getExternalEvents() {
  return getOrSet('agenda:external', CACHE_TTL.agenda, fetchExternalEvents);
}

// Versione geocodata: ogni evento ottiene `places: [{name,lat,lng,province_code}]`.
// I nomi di luogo sono deduplicati per minimizzare le chiamate a Nominatim.
async function buildGeocodedEvents() {
  const base = await fetchExternalEvents();
  if (!base.available) return base;

  const uniqueNames = [...new Set(base.events.flatMap((e) => e.placeNames))];
  const geoByName = new Map();
  for (const name of uniqueNames) {
    geoByName.set(name, await geocode(name));
  }

  const events = base.events.map((e) => ({
    title: e.title,
    link: e.link,
    date: e.date,
    location: e.location,
    image: e.image,
    source: e.source,
    places: e.placeNames
      .map((name) => {
        const g = geoByName.get(name);
        return g ? { name, lat: g.lat, lng: g.lng, province_code: g.province_code } : null;
      })
      .filter(Boolean),
  }));

  return { available: true, source: 'SardegnaTurismo', count: events.length, events };
}

// Non-bloccante: il geocoding dei luoghi (coda Nominatim ~1/s) può metterci
// secondi a freddo. Se la cache è pronta la ritorniamo; altrimenti avviamo il
// build in background e rispondiamo subito senza eventi esterni (compaiono al
// giro dopo). Evita che il click-provincia / layer mappa restino appesi 10-15s.
let geocodedBuilding = false;
function getGeocodedEvents() {
  const cached = get('agenda:geocoded');
  if (cached) return Promise.resolve(cached);
  if (!geocodedBuilding) {
    geocodedBuilding = true;
    getOrSet('agenda:geocoded', CACHE_TTL.agenda, buildGeocodedEvents)
      .catch((err) => logger.warn(`agenda.geocoded.build_failed: ${err.message}`))
      .finally(() => {
        geocodedBuilding = false;
      });
  }
  return Promise.resolve({ available: true, source: 'SardegnaTurismo', count: 0, events: [] });
}

module.exports = { getExternalEvents, getGeocodedEvents, parse };
