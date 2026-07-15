const express = require('express');
const router = express.Router();

const firesController = require('../controllers/fires.controller');

// GET /fires → incendi attivi + storico (NASA FIRMS multi-satellite, fallback EFFIS)
router.get('/', firesController.get);

module.exports = router;
