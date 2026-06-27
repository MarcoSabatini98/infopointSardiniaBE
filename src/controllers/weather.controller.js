// src/controllers/weather.controller.js

const weatherService = require('../services/weather.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const { provincia } = req.query;
    const data = provincia
      ? await weatherService.getByProvince(provincia)
      : await weatherService.getAll();
    // Dati pubblici e "lenti": consenti al browser/proxy una cache breve.
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.weather}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
