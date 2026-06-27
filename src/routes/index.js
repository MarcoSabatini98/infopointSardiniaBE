const express = require('express');
const router = express.Router();

const cacheControl = require('../middlewares/cache.control.middleware');

const authRoutes = require('./auth.routes');
const eventRoutes = require('./event.routes');
const weatherRoutes = require('./weather.routes');
const firesRoutes = require('./fires.routes');
const floodsRoutes = require('./floods.routes');
const newsRoutes = require('./news.routes');
const mapRoutes = require('./map.routes');
const settingRoutes = require('./setting.routes');

// Cache-Control default no-store; i singoli handler "pubblici lenti" lo
// sovrascrivono con un max-age esplicito.
router.use(cacheControl);

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/weather', weatherRoutes);
router.use('/fires', firesRoutes);
router.use('/floods', floodsRoutes);
router.use('/news', newsRoutes);
router.use('/map', mapRoutes);
router.use('/settings', settingRoutes);

module.exports = router;
