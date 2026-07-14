const express = require('express');
const router = express.Router();

const cacheControl = require('../middlewares/cache.control.middleware');

const authRoutes = require('./auth.routes');
const eventRoutes = require('./event.routes');
const weatherRoutes = require('./weather.routes');
const firesRoutes = require('./fires.routes');
const floodsRoutes = require('./floods.routes');
const newsRoutes = require('./news.routes');
const flightsRoutes = require('./flights.routes');
const vesselsRoutes = require('./vessels.routes');
const trafficRoutes = require('./traffic.routes');
const marineRoutes = require('./marine.routes');
const airRoutes = require('./air.routes');
const fuelRoutes = require('./fuel.routes');
const floodRoutes = require('./flood.routes');
const poiRoutes = require('./poi.routes');
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
router.use('/flights', flightsRoutes);
router.use('/vessels', vesselsRoutes);
router.use('/traffic', trafficRoutes);
router.use('/marine', marineRoutes);
router.use('/air', airRoutes);
router.use('/fuel', fuelRoutes);
router.use('/flood', floodRoutes);
router.use('/poi', poiRoutes);
router.use('/map', mapRoutes);
router.use('/settings', settingRoutes);

module.exports = router;
