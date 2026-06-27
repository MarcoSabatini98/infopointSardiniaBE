// src/controllers/news.controller.js

const newsService = require('../services/news.service');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const data = await newsService.getNews(req.query.limit);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.news}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
