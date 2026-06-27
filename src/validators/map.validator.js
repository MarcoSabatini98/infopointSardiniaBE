// src/validators/map.validator.js

const Joi = require('joi');
const { PROVINCE_CODES } = require('../constants/provinces');
const { LAYERS } = require('../services/map.service');

const provinceCodeParamSchema = Joi.object({
  code: Joi.string()
    .valid(...PROVINCE_CODES)
    .required(),
});

const layerParamSchema = Joi.object({
  layer: Joi.string()
    .valid(...LAYERS)
    .required(),
});

module.exports = { provinceCodeParamSchema, layerParamSchema };
