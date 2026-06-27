const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const configs = require('./sequelize.config');

const env = process.env.NODE_ENV || 'development';
const config = configs[env] || configs.development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  timezone: config.timezone,
  pool: config.pool,
  dialectOptions: config.dialectOptions,
  logging:
    String(process.env.DB_LOGGING ?? 'false').toLowerCase() === 'true'
      ? (msg) => logger.debug(msg)
      : false,
});

module.exports = sequelize;
