// src/middlewares/require.role.middleware.js

const AppError = require('../errors/AppError');

// Factory per authz role-based. Va dopo verifyToken (che popola req.user).
//   requireRole([ROLES.ADMIN])  oppure  requireRole(ROLES.ADMIN)
function requireRole(...args) {
  const allowed = Array.isArray(args[0]) ? args[0] : args;

  return function (req, _res, next) {
    if (!req.user || !req.user.role) {
      return next(new AppError('Utente non autenticato', 401));
    }
    if (!allowed.includes(req.user.role)) {
      return next(new AppError('Utente non autorizzato', 403));
    }
    return next();
  };
}

module.exports = { requireRole };
