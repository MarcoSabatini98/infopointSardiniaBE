// src/repositories/event.repository.js

const { Op } = require('sequelize');
const { Event, User } = require('../models');

const CREATOR_ATTRS = ['uuid', 'name'];

// Costruisce la clause WHERE dai filtri opzionali. Centralizzata così
// findAll e count restano coerenti.
function buildWhere(filters = {}) {
  const where = {};
  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = filters.category;
  if (filters.province_code) where.province_code = filters.province_code;
  if (filters.status) where.status = filters.status;

  if (filters.from || filters.to) {
    where.start_date = {};
    if (filters.from) where.start_date[Op.gte] = filters.from;
    if (filters.to) where.start_date[Op.lte] = filters.to;
  }

  if (filters.q) {
    where.title = { [Op.like]: `%${filters.q}%` };
  }
  return where;
}

async function findAll(filters = {}, { page = 1, limit = 20 } = {}) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;

  const { rows, count } = await Event.findAndCountAll({
    where,
    include: [{ model: User, as: 'creator', attributes: CREATOR_ATTRS }],
    order: [
      ['start_date', 'DESC'],
      ['id', 'DESC'],
    ],
    limit,
    offset,
  });

  return {
    data: rows,
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
  };
}

function findByUuid(uuid) {
  return Event.findOne({
    where: { uuid },
    include: [{ model: User, as: 'creator', attributes: CREATOR_ATTRS }],
  });
}

function create(data) {
  return Event.create(data);
}

async function updateByUuid(uuid, data) {
  const [affected] = await Event.update(data, { where: { uuid } });
  if (!affected) return null;
  return findByUuid(uuid);
}

function deleteByUuid(uuid) {
  return Event.destroy({ where: { uuid } });
}

module.exports = { findAll, findByUuid, create, updateByUuid, deleteByUuid };
