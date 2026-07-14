const express = require('express');
const router = express.Router();

const poiController = require('../controllers/poi.controller');
const validate = require('../middlewares/validate');
const { poiQuerySchema, poiSearchSchema } = require('../validators/external.validator');

// GET /poi/search?q=nuraghe[&tipo=...] — ricerca per nome su tutta la Sardegna.
router.get('/search', validate(poiSearchSchema, 'query'), poiController.search);

// GET /poi?provincia=CA[&tipo=museum]  oppure  GET /poi?lat=..&lng=..
router.get('/', validate(poiQuerySchema, 'query'), poiController.get);

module.exports = router;
