// src/services/event.service.js

const eventRepository = require('../repositories/event.repository');
const AppError = require('../errors/AppError');
const { CATEGORIES_BY_TYPE } = require('../constants/event.constants');

// La coerenza type↔category è già validata da Joi al boundary; questo è
// l'ultimo gate di business prima del DB (es. write da script/seed).
function assertCategoryMatchesType(type, category) {
  const allowed = CATEGORIES_BY_TYPE[type] || [];
  if (!allowed.includes(category)) {
    throw new AppError(`Categoria "${category}" non valida per il tipo ${type}`, 400);
  }
}

function listEvents(filters, pagination) {
  return eventRepository.findAll(filters, pagination);
}

async function getEvent(uuid) {
  const event = await eventRepository.findByUuid(uuid);
  if (!event) {
    throw new AppError('Evento non trovato', 404);
  }
  return event;
}

function createEvent(data, userId) {
  assertCategoryMatchesType(data.type, data.category);
  return eventRepository.create({ ...data, created_by: userId ?? null });
}

async function updateEvent(uuid, data) {
  const existing = await eventRepository.findByUuid(uuid);
  if (!existing) {
    throw new AppError('Evento non trovato', 404);
  }
  // Type/category possono cambiare entrambi: ricontrolla la coppia risultante.
  const type = data.type ?? existing.type;
  const category = data.category ?? existing.category;
  assertCategoryMatchesType(type, category);

  return eventRepository.updateByUuid(uuid, data);
}

async function deleteEvent(uuid) {
  const deleted = await eventRepository.deleteByUuid(uuid);
  if (!deleted) {
    throw new AppError('Evento non trovato', 404);
  }
}

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent };
