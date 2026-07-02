// src/controllers/poi.controller.js

const poiService = require('../services/poi.service');
const AppError = require('../errors/AppError');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const { provincia, lat, lng, tipo } = req.query;
    let data;
    if (provincia) {
      data = await poiService.getByProvince(provincia, tipo);
    } else if (lat != null && lng != null) {
      data = await poiService.getByCoords(Number(lat), Number(lng), tipo);
    } else {
      throw new AppError('Specificare "provincia" oppure "lat" e "lng"', 400);
    }
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.poi}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

// GET /poi/search?q=...  — ricerca per nome su tutta la Sardegna.
async function search(req, res, next) {
  try {
    const { q, tipo } = req.query;
    const data = await poiService.searchByName(q, tipo);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.poi}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get, search };
