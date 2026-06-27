// src/validators/setting.validator.js

const Joi = require('joi');

const keyParamSchema = Joi.object({
  key: Joi.string()
    .pattern(/^[a-z0-9_.-]+$/i)
    .max(100)
    .required(),
});

const upsertSettingSchema = Joi.object({
  // value accetta qualsiasi JSON (oggetto, array, scalare, null).
  value: Joi.any().required(),
  description: Joi.string().trim().max(255).allow('', null),
});

module.exports = { keyParamSchema, upsertSettingSchema };
