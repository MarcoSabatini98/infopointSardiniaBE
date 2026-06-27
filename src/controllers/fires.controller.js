// src/controllers/fires.controller.js

const firesService = require('../services/fires.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(_req, res, next) {
  try {
    const data = await firesService.getActiveFires();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.fires}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
