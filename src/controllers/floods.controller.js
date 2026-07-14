// src/controllers/floods.controller.js

const floodsService = require('../services/floods.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(_req, res, next) {
  try {
    const data = await floodsService.getAlerts();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.floods}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
