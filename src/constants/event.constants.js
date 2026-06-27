// src/constants/event.constants.js
// Due macro-tipi di evento + categorie per tipo (enum fissa).
//   NATURALE  → fenomeni meteo/ambientali/distruttivi (anche inseribili a mano)
//   CULTURALE → eventi sociali/culturali gestiti dagli operatori

const EVENT_TYPES = Object.freeze({
  NATURALE: 'NATURALE',
  CULTURALE: 'CULTURALE',
});

const CATEGORIES_BY_TYPE = Object.freeze({
  NATURALE: Object.freeze([
    'incendio',
    'allagamento',
    'allerta_meteo',
    'frana',
    'ondata_calore',
    'vento_forte',
    'mareggiata',
    'altro',
  ]),
  CULTURALE: Object.freeze([
    'sagra',
    'concerto',
    'mostra',
    'fiera',
    'sportivo',
    'religioso',
    'teatro',
    'altro',
  ]),
});

// Lista piatta di tutte le categorie valide (per validazione veloce).
const ALL_CATEGORIES = Object.freeze([
  ...new Set([...CATEGORIES_BY_TYPE.NATURALE, ...CATEGORIES_BY_TYPE.CULTURALE]),
]);

const EVENT_STATUS = Object.freeze({
  BOZZA: 'bozza',
  PUBBLICATO: 'pubblicato',
  ANNULLATO: 'annullato',
});

module.exports = {
  EVENT_TYPES,
  CATEGORIES_BY_TYPE,
  ALL_CATEGORIES,
  EVENT_STATUS,
};
