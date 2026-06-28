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

// Distanza haversine (km).
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Provincia col centroide più vicino a un punto (euristica).
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

module.exports = {
  PROVINCES,
  PROVINCE_CODES,
  PROVINCE_BY_CODE,
  getProvince,
  SARDINIA_BBOX,
  nearestProvinceCode,
};
