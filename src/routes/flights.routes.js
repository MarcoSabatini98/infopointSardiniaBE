const express = require('express');
const router = express.Router();

const flightsController = require('../controllers/flights.controller');

// GET /flights → aerei live (OpenSky) nella bbox Sardegna
router.get('/', flightsController.get);

module.exports = router;
