// src/middlewares/verify.access.token.middleware.js

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, accessToken] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !accessToken) {
    return res.status(401).json({ success: false, message: 'Token non presente' });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    });
    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn(`JWT scaduto: ${req.method} ${req.path} ip=${req.ip}`);
      return res.status(401).json({ success: false, message: 'Token scaduto' });
    }
    if (error.name === 'JsonWebTokenError') {
      logger.warn(`JWT invalido: ${error.message} ${req.method} ${req.path} ip=${req.ip}`);
      return res.status(401).json({ success: false, message: 'Token non valido' });
    }
    return next(error);
  }
}

module.exports = { verifyToken };
