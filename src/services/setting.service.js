// src/services/setting.service.js

const settingRepository = require('../repositories/setting.repository');
const AppError = require('../errors/AppError');

function getAll() {
  return settingRepository.findAll();
}

async function get(key) {
  const setting = await settingRepository.findByKey(key);
  if (!setting) {
    throw new AppError('Impostazione non trovata', 404);
  }
  return setting;
}

function set(key, value, description, userId) {
  return settingRepository.upsert(key, value, description, userId);
}

module.exports = { getAll, get, set };
