// src/controllers/vessels.controller.js

const vesselsService = require('../services/vessels.service');
const { sendSuccess } = require('../utils/http.response');

function get(_req, res, next) {
  try {
    // Snapshot in-memory: niente Cache-Control aggressivo, i dati sono già
    // "live" dal collector. no-store di default va bene.
    return sendSuccess(res, 200, vesselsService.getVessels());
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
