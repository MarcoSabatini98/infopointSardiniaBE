// src/controllers/traffic.controller.js

const trafficService = require('../services/traffic.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(_req, res, next) {
  try {
    const data = await trafficService.getIncidents();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.traffic}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
