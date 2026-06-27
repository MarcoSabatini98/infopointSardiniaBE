// src/controllers/flights.controller.js

const flightsService = require('../services/flights.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(_req, res, next) {
  try {
    const data = await flightsService.getFlights();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.flights}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
