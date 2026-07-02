// src/controllers/flood.controller.js

const floodService = require('../services/flood.service');
const AppError = require('../errors/AppError');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const { provincia, lat, lng } = req.query;
    let data;
    if (provincia) {
      data = await floodService.getByProvince(provincia);
    } else if (lat != null && lng != null) {
      data = await floodService.getByCoords(Number(lat), Number(lng));
    } else {
      throw new AppError('Specificare "provincia" oppure "lat" e "lng"', 400);
    }
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.flood}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
