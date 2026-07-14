const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { loginSchema, changePasswordSchema } = require('../validators/auth.validator');
const { verifyToken } = require('../middlewares/verify.access.token.middleware');
const { requireRole } = require('../middlewares/require.role.middleware');
const { AUTHENTICATED_ROLES } = require('../constants/roles');
const {
  LOGIN_LIMITER_WINDOW_MS,
  LOGIN_LIMITER_MAX,
  REFRESH_LIMITER_WINDOW_MS,
  REFRESH_LIMITER_MAX,
} = require('../constants/auth.constants');

const ipKeyByRequest = (req) => ipKeyGenerator(req.ip);
const jsonRateMsg = (text) => ({
  status: 'fail',
  success: false,
  message: text,
  data: { message: text },
});

const loginLimiter = rateLimit({
  windowMs: LOGIN_LIMITER_WINDOW_MS,
  max: LOGIN_LIMITER_MAX,
  keyGenerator: ipKeyByRequest,
  skipSuccessfulRequests: true,
  message: jsonRateMsg('Troppi tentativi di login — riprova tra 15 minuti'),
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: REFRESH_LIMITER_WINDOW_MS,
  max: REFRESH_LIMITER_MAX,
  keyGenerator: ipKeyByRequest,
  message: jsonRateMsg('Troppe richieste di refresh — riprova tra qualche minuto'),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, requireRole(AUTHENTICATED_ROLES), authController.getMe);
router.post(
  '/change-password',
  verifyToken,
  requireRole(AUTHENTICATED_ROLES),
  validate(changePasswordSchema),
  authController.changePassword,
);

module.exports = router;
