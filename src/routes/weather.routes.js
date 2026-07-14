const express = require('express');
const router = express.Router();

const weatherController = require('../controllers/weather.controller');
const validate = require('../middlewares/validate');
const { weatherQuerySchema, weatherSearchSchema } = require('../validators/external.validator');

// GET /weather            → meteo (leggero) di tutte le province
// GET /weather?provincia=CA → meteo completo di una provincia
router.get('/', validate(weatherQuerySchema, 'query'), weatherController.get);

// GET /weather/search?q=Alghero → meteo completo per città (geocoding)
router.get('/search', validate(weatherSearchSchema, 'query'), weatherController.search);

module.exports = router;
