const express = require('express');
const router = express.Router();

const eventController = require('../controllers/event.controller');
const validate = require('../middlewares/validate');
const { verifyToken } = require('../middlewares/verify.access.token.middleware');
const { requireRole } = require('../middlewares/require.role.middleware');
const { ROLES } = require('../constants/roles');
const {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  uuidParamSchema,
} = require('../validators/event.validator');

// Lettura pubblica
router.get('/', validate(listEventsQuerySchema, 'query'), eventController.list);
// /external prima di /:id, altrimenti verrebbe intercettata come uuid.
router.get('/external', eventController.listExternal);
router.get('/:id', validate(uuidParamSchema, 'params'), eventController.getOne);

// Scrittura: solo admin
router.post(
  '/',
  verifyToken,
  requireRole(ROLES.ADMIN),
  validate(createEventSchema),
  eventController.create,
);
router.patch(
  '/:id',
  verifyToken,
  requireRole(ROLES.ADMIN),
  validate(uuidParamSchema, 'params'),
  validate(updateEventSchema),
  eventController.update,
);
router.delete(
  '/:id',
  verifyToken,
  requireRole(ROLES.ADMIN),
  validate(uuidParamSchema, 'params'),
  eventController.remove,
);

module.exports = router;
