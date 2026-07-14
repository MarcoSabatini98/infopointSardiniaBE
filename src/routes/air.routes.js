const express = require('express');
const router = express.Router();

const airController = require('../controllers/air.controller');
const validate = require('../middlewares/validate');
const { airQuerySchema } = require('../validators/external.validator');

// GET /air?provincia=CA  oppure  GET /air?lat=..&lng=..
router.get('/', validate(airQuerySchema, 'query'), airController.get);

module.exports = router;
