// src/validators/event.validator.js

const Joi = require('joi');
const {
  EVENT_TYPES,
  CATEGORIES_BY_TYPE,
  ALL_CATEGORIES,
  EVENT_STATUS,
} = require('../constants/event.constants');
const { PROVINCE_CODES } = require('../constants/provinces');

const types = Object.values(EVENT_TYPES);
const statuses = Object.values(EVENT_STATUS);

// Valida che category appartenga al type scelto. `.when('type', ...)` è il
// modo affidabile in Joi per condizionare un campo a un fratello (gli
// ancestors in .custom non sono garantiti durante la validazione delle chiavi).
// Se `type` è assente (caso update parziale), si accetta qualsiasi categoria
// valida: la coerenza è ricontrollata nel service contro il type esistente.
const categoryForType = Joi.string()
  .when('type', {
    switch: [
      { is: 'NATURALE', then: Joi.valid(...CATEGORIES_BY_TYPE.NATURALE) },
      { is: 'CULTURALE', then: Joi.valid(...CATEGORIES_BY_TYPE.CULTURALE) },
    ],
    otherwise: Joi.valid(...ALL_CATEGORIES),
  })
  .messages({ 'any.only': 'Categoria non valida per il tipo di evento scelto' });

const createEventSchema = Joi.object({
  type: Joi.string()
    .valid(...types)
    .required(),
  category: categoryForType.required(),
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().trim().max(5000).allow('', null),
  province_code: Joi.string()
    .valid(...PROVINCE_CODES)
    .required(),
  comune: Joi.string().trim().max(120).allow('', null),
  lat: Joi.number().min(-90).max(90).allow(null),
  lng: Joi.number().min(-180).max(180).allow(null),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).allow(null),
  time: Joi.string().trim().max(20).allow('', null),
  venue: Joi.string().trim().max(200).allow('', null),
  icon_url: Joi.string().uri({ relativeOnly: false }).max(500).allow('', null),
  logo_url: Joi.string().uri({ relativeOnly: false }).max(500).allow('', null),
  is_free: Joi.boolean(),
  price: Joi.number().min(0).allow(null),
  website: Joi.string().uri().max(500).allow('', null),
  contacts: Joi.string().trim().max(255).allow('', null),
  organizer: Joi.string().trim().max(200).allow('', null),
  status: Joi.string().valid(...statuses),
});

// In update tutti i campi sono opzionali ma serve almeno uno.
const updateEventSchema = createEventSchema
  .fork(['type', 'category', 'title', 'province_code', 'start_date'], (s) => s.optional())
  .min(1);

const listEventsQuerySchema = Joi.object({
  type: Joi.string().valid(...types),
  category: Joi.string().valid(...ALL_CATEGORIES),
  province_code: Joi.string().valid(...PROVINCE_CODES),
  status: Joi.string().valid(...statuses),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  q: Joi.string().trim().max(120),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  uuidParamSchema,
};
