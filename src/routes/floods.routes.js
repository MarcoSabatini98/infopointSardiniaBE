const express = require('express');
const router = express.Router();

const floodsController = require('../controllers/floods.controller');

// GET /floods → allerte idrogeologiche/allagamenti (Protezione Civile / ARPAS)
router.get('/', floodsController.get);

module.exports = router;
