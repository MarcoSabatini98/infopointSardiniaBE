const express = require('express');
const router = express.Router();

const settingController = require('../controllers/setting.controller');
const validate = require('../middlewares/validate');
const { verifyToken } = require('../middlewares/verify.access.token.middleware');
const { requireRole } = require('../middlewares/require.role.middleware');
const { ROLES } = require('../constants/roles');
const { keyParamSchema, upsertSettingSchema } = require('../validators/setting.validator');

// Lettura pubblica (la dashboard legge i toggle/config)
router.get('/', settingController.list);
router.get('/:key', validate(keyParamSchema, 'params'), settingController.getOne);

// Scrittura: solo admin
router.put(
  '/:key',
  verifyToken,
  requireRole(ROLES.ADMIN),
  validate(keyParamSchema, 'params'),
  validate(upsertSettingSchema),
  settingController.upsert,
);

module.exports = router;
