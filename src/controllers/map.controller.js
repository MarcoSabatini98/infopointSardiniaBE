// src/controllers/map.controller.js

const mapService = require('../services/map.service');
const { sendSuccess } = require('../utils/http.response');

function getProvinces(_req, res, next) {
  try {
    return sendSuccess(res, 200, mapService.getProvinces());
  } catch (error) {
    return next(error);
  }
}

function getProvincesGeoJSON(_req, res, next) {
  try {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // GeoJSON è uno standard: lo serviamo direttamente (non wrappato in JSend).
    return res.status(200).json(mapService.getProvincesGeoJSON());
  } catch (error) {
    return next(error);
  }
}

async function getProvinceInfo(req, res, next) {
  try {
    const data = await mapService.getProvinceInfo(req.params.code);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

async function getLayer(req, res, next) {
  try {
    const data = await mapService.getLayer(req.params.layer);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getProvinces, getProvincesGeoJSON, getProvinceInfo, getLayer };
