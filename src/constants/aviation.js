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

module.exports = { AIRLINES, AIRPORTS, airlineFromCallsign };
