// src/validators/external.validator.js
// Schema query per gli endpoint di aggregazione dati esterni.

const Joi = require('joi');
const { PROVINCE_CODES } = require('../constants/provinces');

const weatherQuerySchema = Joi.object({
  provincia: Joi.string().valid(...PROVINCE_CODES),
});

const newsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(30),
});

module.exports = { weatherQuerySchema, newsQuerySchema };
