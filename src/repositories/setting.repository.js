// src/repositories/setting.repository.js

const { Setting } = require('../models');

function findAll() {
  return Setting.findAll({ order: [['key', 'ASC']] });
}

function findByKey(key) {
  return Setting.findOne({ where: { key } });
}

// Upsert per chiave: crea o aggiorna. Ritorna il record aggiornato.
async function upsert(key, value, description, updatedBy) {
  const existing = await Setting.findOne({ where: { key } });
  if (existing) {
    await existing.update({
      value,
      ...(description !== undefined ? { description } : {}),
      updated_by: updatedBy ?? null,
    });
    return existing;
  }
  return Setting.create({
    key,
    value,
    description: description ?? null,
    updated_by: updatedBy ?? null,
  });
}

module.exports = { findAll, findByKey, upsert };
