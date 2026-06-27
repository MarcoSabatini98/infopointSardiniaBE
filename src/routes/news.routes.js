const express = require('express');
const router = express.Router();

const newsController = require('../controllers/news.controller');
const validate = require('../middlewares/validate');
const { newsQuerySchema } = require('../validators/external.validator');

// GET /news?limit=30 → ultime notizie aggregate dai feed RSS
router.get('/', validate(newsQuerySchema, 'query'), newsController.get);

module.exports = router;
