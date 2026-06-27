const express = require('express');
const router = express.Router();

const weatherController = require('../controllers/weather.controller');
const validate = require('../middlewares/validate');
const { weatherQuerySchema } = require('../validators/external.validator');

// GET /weather            → meteo di tutte le province
// GET /weather?provincia=CA → meteo di una provincia
router.get('/', validate(weatherQuerySchema, 'query'), weatherController.get);

module.exports = router;
