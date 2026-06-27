// src/controllers/setting.controller.js

const settingService = require('../services/setting.service');
const userRepository = require('../repositories/user.repository');
const { sendSuccess } = require('../utils/http.response');

async function list(_req, res, next) {
  try {
    return sendSuccess(res, 200, await settingService.getAll());
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    return sendSuccess(res, 200, await settingService.get(req.params.key));
  } catch (error) {
    return next(error);
  }
}

async function upsert(req, res, next) {
  try {
    const user = await userRepository.findActiveByUuid(req.user.sub);
    const { value, description } = req.body;
    const setting = await settingService.set(req.params.key, value, description, user?.id);
    return sendSuccess(res, 200, setting);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, getOne, upsert };
