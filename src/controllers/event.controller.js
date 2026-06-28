// src/controllers/event.controller.js

const eventService = require('../services/event.service');
const agendaService = require('../services/agenda.service');
const userRepository = require('../repositories/user.repository');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function list(req, res, next) {
  try {
    const { page, limit, ...filters } = req.query;
    const result = await eventService.listEvents(filters, { page, limit });
    return sendSuccess(res, 200, result);
  } catch (error) {
    return next(error);
  }
}

// Eventi culturali dalla fonte ufficiale esterna (SardegnaTurismo, scraping).
async function listExternal(_req, res, next) {
  try {
    const data = await agendaService.getExternalEvents();
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.agenda}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const event = await eventService.getEvent(req.params.id);
    return sendSuccess(res, 200, event);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    // req.user.sub è l'uuid: risolvo l'id interno per la FK created_by.
    const user = await userRepository.findActiveByUuid(req.user.sub);
    const event = await eventService.createEvent(req.body, user?.id);
    return sendSuccess(res, 201, event);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const event = await eventService.updateEvent(req.params.id, req.body);
    return sendSuccess(res, 200, event);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await eventService.deleteEvent(req.params.id);
    return sendSuccess(res, 200, { message: 'Evento eliminato' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, listExternal, getOne, create, update, remove };
