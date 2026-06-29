// src/validators/external.validator.js
// Schema query per gli endpoint di aggregazione dati esterni.

const Joi = require('joi');
const { PROVINCE_CODES } = require('../constants/provinces');

const weatherQuerySchema = Joi.object({
  provincia: Joi.string().valid(...PROVINCE_CODES),
});

const weatherSearchSchema = Joi.object({
  q: Joi.string().trim().min(2).max(80).required(),
});

const newsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(30),
});

const airQuerySchema = Joi.object({
  provincia: Joi.string().valid(...PROVINCE_CODES),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
}).oxor('provincia', 'lat');

module.exports = { weatherQuerySchema, weatherSearchSchema, newsQuerySchema, airQuerySchema };
