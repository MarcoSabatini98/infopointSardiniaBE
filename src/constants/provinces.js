// src/constants/provinces.js
// Le 5 province della Sardegna (assetto dal 2016). `code` = sigla ufficiale,
// usata come chiave stabile in tutta l'app (eventi, layer mappa, meteo).
// `lat`/`lng` = centroide del capoluogo, usato per le lookup meteo puntuali.

const PROVINCES = Object.freeze([
  { code: 'CA', name: 'Cagliari', capoluogo: 'Cagliari', lat: 39.2238, lng: 9.1217 },
  { code: 'SS', name: 'Sassari', capoluogo: 'Sassari', lat: 40.7259, lng: 8.5557 },
  { code: 'NU', name: 'Nuoro', capoluogo: 'Nuoro', lat: 40.3209, lng: 9.3286 },
  { code: 'OR', name: 'Oristano', capoluogo: 'Oristano', lat: 39.9036, lng: 8.5912 },
  { code: 'SU', name: 'Sud Sardegna', capoluogo: 'Carbonia', lat: 39.1672, lng: 8.5226 },
]);

// bbox Sardegna [lon_min, lat_min, lon_max, lat_max] — usata per ritagliare i
// dati esterni (incendi, voli, navi, traffico) sull'area regionale.
const SARDINIA_BBOX = Object.freeze([8.0, 38.8, 10.0, 41.3]);

const PROVINCE_CODES = Object.freeze(PROVINCES.map((p) => p.code));

const PROVINCE_BY_CODE = Object.freeze(Object.fromEntries(PROVINCES.map((p) => [p.code, p])));

function getProvince(code) {
  return PROVINCE_BY_CODE[String(code).toUpperCase()] || null;
}

module.exports = { PROVINCES, PROVINCE_CODES, PROVINCE_BY_CODE, getProvince, SARDINIA_BBOX };
