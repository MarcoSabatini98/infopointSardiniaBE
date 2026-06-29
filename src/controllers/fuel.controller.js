// src/controllers/fuel.controller.js

const fuelService = require('../services/fuel.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(_req, res, next) {
  try {
    const data = await fuelService.getStations();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.fuel}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
