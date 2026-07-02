const express = require('express');
const router = express.Router();

const floodController = require('../controllers/flood.controller');
const validate = require('../middlewares/validate');
const { floodQuerySchema } = require('../validators/external.validator');

// GET /flood?provincia=CA  oppure  GET /flood?lat=..&lng=..
router.get('/', validate(floodQuerySchema, 'query'), floodController.get);

module.exports = router;
