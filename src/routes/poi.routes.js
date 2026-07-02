const express = require('express');
const router = express.Router();

const poiController = require('../controllers/poi.controller');
const validate = require('../middlewares/validate');
const { poiQuerySchema } = require('../validators/external.validator');

// GET /poi?provincia=CA[&tipo=museum]  oppure  GET /poi?lat=..&lng=..
router.get('/', validate(poiQuerySchema, 'query'), poiController.get);

module.exports = router;
