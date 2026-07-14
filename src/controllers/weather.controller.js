// src/controllers/weather.controller.js

const weatherService = require('../services/weather.service');
const { geocode } = require('../services/geocode.service');
const AppError = require('../errors/AppError');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');
const { getProvince } = require('../constants/provinces');

async function get(req, res, next) {
  try {
    const { provincia } = req.query;
    const data = provincia
      ? await weatherService.getByProvince(provincia)
      : await weatherService.getAll();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.weather}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

// Ricerca città → geocoding (Sardegna) → meteo completo nel punto trovato.
async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      throw new AppError('Parametro "q" mancante', 400);
    }
    const geo = await geocode(q);
    if (!geo) {
      throw new AppError(`Località "${q}" non trovata in Sardegna`, 404);
    }
    const provinceName = getProvince(geo.province_code)?.name ?? null;
    const data = await weatherService.getByCoords(geo.lat, geo.lng, q, geo.province_code);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.weather}`);
    return sendSuccess(res, 200, { ...data, query: q, province_name: provinceName });
  } catch (error) {
    return next(error);
  }
}

module.exports = { get, search };
