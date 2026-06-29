// src/controllers/marine.controller.js

const marineService = require('../services/marine.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const { provincia } = req.query;
    const data = provincia
      ? await marineService.getByProvince(provincia)
      : await marineService.getAll();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.marine}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
