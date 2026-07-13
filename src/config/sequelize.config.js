// Config condivisa tra CLI (sequelize-cli) e runtime (src/config/db.js).
// Singola fonte di verità per credenziali, host, pool e timezone.
//
// DB_DIALECT: 'postgres' (driver pg) è la combo stabile con Sequelize 6.
// DB_SSL: true per DB gestiti tipo Neon (connessione cifrata obbligatoria).

require('dotenv').config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
});

const Joi = require('joi');

const schema = Joi.object({
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_DIALECT: Joi.string().default('postgres'),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),
  DB_POOL_MIN: Joi.number().integer().min(0).default(0),
  DB_POOL_ACQUIRE: Joi.number().integer().min(1000).default(30000),
  DB_POOL_IDLE: Joi.number().integer().min(1000).default(10000),
}).unknown(true);

const { error, value: env } = schema.validate(process.env);
if (error) {
  throw new Error(`Invalid database config: ${error.message}`);
}

// Neon (e ogni Postgres gestito) esige SSL; in locale il container non lo usa.
// rejectUnauthorized:false accetta il certificato del provider senza CA locale.
const dialectOptions = env.DB_SSL ? { ssl: { require: true, rejectUnauthorized: false } } : {};

const config = {
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: env.DB_DIALECT,
  logging: false,
  pool: {
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    acquire: env.DB_POOL_ACQUIRE,
    idle: env.DB_POOL_IDLE,
  },
  dialectOptions,
};

module.exports = {
  development: config,
  test: config,
  production: config,
};
