// src/controllers/air.controller.js

const airService = require('../services/air.service');
const AppError = require('../errors/AppError');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const { provincia, lat, lng } = req.query;
    let data;
    if (provincia) {
      data = await airService.getByProvince(provincia);
    } else if (lat != null && lng != null) {
      data = await airService.getByCoords(Number(lat), Number(lng));
    } else {
      throw new AppError('Specificare "provincia" oppure "lat" e "lng"', 400);
    }
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.air}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
