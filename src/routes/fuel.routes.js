const express = require('express');
const router = express.Router();

const fuelController = require('../controllers/fuel.controller');

// GET /fuel → impianti carburante della Sardegna con prezzi (MIMIT)
router.get('/', fuelController.get);

module.exports = router;
