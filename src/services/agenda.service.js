// src/services/agenda.service.js
// Eventi culturali caricati dalla fonte ufficiale SardegnaTurismo (Regione
// Sardegna). Niente API/RSS eventi disponibile → scraping mirato della pagina
// /it/eventi (Drupal). Isolato qui: se cambia il markup si aggiorna solo questo
// parser. Cache lunga (gli eventi cambiano lentamente).
//
// ponytail: scraping perché non esiste un feed strutturato; selettori basati
// sulle classi field Drupal stabili (field-name-title-field, ...-data, ...-nomi).

const cheerio = require('cheerio');
const { getText } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { SARDEGNATURISMO_EVENTS_URL, CACHE_TTL } = require('../constants/sources.constants');

const BASE = 'https://www.sardegnaturismo.it';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function abs(href) {
  if (!href) return null;
  return href.startsWith('http') ? href : `${BASE}${href}`;
}

function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim() || null;
}

function parse(html) {
  const $ = cheerio.load(html);
  const events = [];
  $('.node-evento.node-teaser').each((_, el) => {
    const node = $(el);
    const titleA = node.find('.field-name-title-field a').first();
    const title = clean(titleA.text());
    if (!title) return;
    const img = node.find('.field-name-field-immagine-top img').first().attr('src');
    events.push({
      title,
      link: abs(titleA.attr('href')),
      date: clean(node.find('.field-name-field-riassunto-tappe-data').first().text()),
      location: clean(node.find('.field-name-field-riassunto-tappe-nomi').first().text()),
      image: abs(img),
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

module.exports = { getExternalEvents, parse };
