const express = require('express');
const router = express.Router();

const vesselsController = require('../controllers/vessels.controller');

// GET /vessels → snapshot navi live (aisstream collector) nella bbox Sardegna
router.get('/', vesselsController.get);

module.exports = router;
