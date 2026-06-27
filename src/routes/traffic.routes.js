const express = require('express');
const router = express.Router();

const trafficController = require('../controllers/traffic.controller');

// GET /traffic → incidenti/traffico stradale (TomTom) nella bbox Sardegna
router.get('/', trafficController.get);

module.exports = router;
