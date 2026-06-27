const express = require('express');
const router = express.Router();

const mapController = require('../controllers/map.controller');
const validate = require('../middlewares/validate');
const { provinceCodeParamSchema, layerParamSchema } = require('../validators/map.validator');

// GeoJSON + metadati province
router.get('/provinces', mapController.getProvinces);
router.get('/provinces/geojson', mapController.getProvincesGeoJSON);

// Layer selezionabili: weather | fires | floods | news | events
router.get('/layers/:layer', validate(layerParamSchema, 'params'), mapController.getLayer);

// Click su una provincia: aggregazione meteo + incendi + allerte + eventi
router.get(
  '/provinces/:code',
  validate(provinceCodeParamSchema, 'params'),
  mapController.getProvinceInfo,
);

module.exports = router;
