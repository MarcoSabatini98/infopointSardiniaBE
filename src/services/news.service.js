// src/services/news.service.js
// News dalle testate sarde/nazionali via RSS (rss-parser). I feed sono
// configurati in sources.constants (override via env NEWS_FEEDS). Ogni feed
// è scaricato in parallelo; se uno fallisce non blocca gli altri.

const Parser = require('rss-parser');
const { getOrSet } = require('../utils/cache');
const logger = require('../utils/logger');
const { NEWS_FEEDS, CACHE_TTL } = require('../constants/sources.constants');

const parser = new Parser({ timeout: 10_000 });

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items ?? []).map((item) => ({
      source: feed.name,
      title: item.title ?? null,
      link: item.link ?? null,
      summary: item.contentSnippet ?? null,
      published_at: item.isoDate ?? item.pubDate ?? null,
    }));
  } catch (err) {
    logger.warn(`news.feed.unavailable ${feed.name}: ${err.message}`);
    return [];
  }
}

async function fetchAllNews(limit) {
  const lists = await Promise.all(NEWS_FEEDS.map(fetchFeed));
  const items = lists.flat();

  // Ordina per data discendente; gli item senza data finiscono in fondo.
  items.sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  return {
    sources: NEWS_FEEDS.map((f) => f.name),
    count: Math.min(items.length, limit),
    total: items.length,
    items: items.slice(0, limit),
  };
}

// limit fa parte della chiave cache: liste di lunghezza diversa non si pestano.
function getNews(limit = 30) {
  return getOrSet(`news:latest:${limit}`, CACHE_TTL.news, () => fetchAllNews(limit));
}

module.exports = { getNews };
