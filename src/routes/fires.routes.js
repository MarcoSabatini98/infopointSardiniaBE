const express = require('express');
const router = express.Router();

const firesController = require('../controllers/fires.controller');

// GET /fires → incendi attivi (EFFIS) nella bbox Sardegna
router.get('/', firesController.get);

module.exports = router;
