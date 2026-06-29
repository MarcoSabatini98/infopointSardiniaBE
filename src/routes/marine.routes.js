const express = require('express');
const router = express.Router();

const marineController = require('../controllers/marine.controller');
const validate = require('../middlewares/validate');
const { weatherQuerySchema } = require('../validators/external.validator');

// GET /marine            → mare di tutte le province (punti costieri)
// GET /marine?provincia=CA → mare di una provincia
router.get('/', validate(weatherQuerySchema, 'query'), marineController.get);

module.exports = router;
