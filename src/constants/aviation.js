// src/constants/aviation.js
// Compagnie aeree per prefisso callsign ICAO (3 lettere) e aeroporti sardi.

const AIRLINES = Object.freeze({
  RYR: 'Ryanair',
  RUK: 'Ryanair UK',
  WZZ: 'Wizz Air',
  WMT: 'Wizz Air Malta',
  EZY: 'easyJet',
  EJU: 'easyJet Europe',
  ITY: 'ITA Airways',
  VOE: 'Volotea',
  NOS: 'Neos',
  EWG: 'Eurowings',
  DLH: 'Lufthansa',
  AFR: 'Air France',
  KLM: 'KLM',
  BAW: 'British Airways',
  VLG: 'Vueling',
  TAP: 'TAP Air Portugal',
  SWR: 'Swiss',
  AUA: 'Austrian Airlines',
  TRA: 'Transavia',
  TVF: 'Transavia France',
  THY: 'Turkish Airlines',
  UAE: 'Emirates',
  ENT: 'Enter Air',
  BTI: 'airBaltic',
  FIN: 'Finnair',
  SAS: 'SAS',
  IBE: 'Iberia',
  IBS: 'Iberia Express',
  AEE: 'Aegean',
  LOT: 'LOT Polish Airlines',
  SXS: 'SunExpress',
  NAX: 'Norwegian',
  NSZ: 'Norwegian',
  AZA: 'ITA Airways',
  CAI: 'Corendon',
  EXS: 'Jet2',
  BEL: 'Brussels Airlines',
  AEA: 'Air Europa',
  RYS: 'Ryanair',
});

// Aeroporti principali della Sardegna.
const AIRPORTS = Object.freeze([
  { code: 'CAG', name: 'Cagliari Elmas', lat: 39.2515, lng: 9.0543 },
  { code: 'OLB', name: 'Olbia Costa Smeralda', lat: 40.8987, lng: 9.5176 },
  { code: 'AHO', name: 'Alghero Fertilia', lat: 40.6321, lng: 8.2908 },
]);

// Compagnia dal callsign (prime 3 lettere = codice ICAO operatore).
function airlineFromCallsign(callsign) {
  if (!callsign) return null;
  const prefix = callsign.trim().slice(0, 3).toUpperCase();
  return AIRLINES[prefix] || null;
}

// Paese dal prefisso della marca di immatricolazione (tail number). Copre
// Europa/Mediterraneo/Golfo/USA — il grosso del traffico sulla Sardegna.
const REG_COUNTRY = Object.freeze({
  I: 'Italia',
  D: 'Germania',
  F: 'Francia',
  G: 'Regno Unito',
  EC: 'Spagna',
  PH: 'Paesi Bassi',
  OO: 'Belgio',
  OE: 'Austria',
  HB: 'Svizzera',
  SE: 'Svezia',
  LN: 'Norvegia',
  OY: 'Danimarca',
  EI: 'Irlanda',
  CS: 'Portogallo',
  SP: 'Polonia',
  OK: 'Cechia',
  HA: 'Ungheria',
  LZ: 'Bulgaria',
  YR: 'Romania',
  '9H': 'Malta',
  SX: 'Grecia',
  TC: 'Turchia',
  LX: 'Lussemburgo',
  '9A': 'Croazia',
  S5: 'Slovenia',
  OM: 'Slovacchia',
  ES: 'Estonia',
  YL: 'Lettonia',
  LY: 'Lituania',
  '4X': 'Israele',
  TS: 'Tunisia',
  CN: 'Marocco',
  SU: 'Egitto',
  UR: 'Ucraina',
  A6: 'Emirati Arabi Uniti',
  A7: 'Qatar',
  HZ: 'Arabia Saudita',
  M: 'Isola di Man',
});

// Paese dall'immatricolazione (es. "9H-VCC" → Malta, "N123AB" → Stati Uniti).
function countryFromReg(r) {
  if (!r) return null;
  const reg = r.toUpperCase().trim();
  if (/^N\d/.test(reg)) return 'Stati Uniti'; // USA: N + numero, senza trattino
  const prefix = reg.split('-')[0];
  return REG_COUNTRY[prefix] || null;
}

module.exports = { AIRLINES, AIRPORTS, airlineFromCallsign, countryFromReg };
