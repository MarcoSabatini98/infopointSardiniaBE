// src/services/auth.service.js
// Auth operatore (admin). ponytail: niente registrazione self-service né
// verifica email — l'unico operatore è creato dal seeder. Qui solo login,
// refresh, logout, profilo e cambio password.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');
const AppError = require('../errors/AppError');
const { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, BCRYPT_COST } = require('../constants/auth.constants');

const SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH;

const JWT_OPTIONS = {
  issuer: process.env.JWT_ISSUER || 'http://localhost:3000',
  audience: process.env.JWT_AUDIENCE || 'http://localhost:4200',
};

// Hash dummy a module-load: pareggia il tempo di login quando l'email non
// esiste, eliminando il timing attack per enumerazione.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

function buildTokenPair(user) {
  const payload = { sub: user.uuid, role: user.role };
  return {
    accessToken: jwt.sign(payload, SECRET, { ...JWT_OPTIONS, expiresIn: ACCESS_TOKEN_TTL }),
    refreshToken: jwt.sign(payload, REFRESH_SECRET, {
      ...JWT_OPTIONS,
      expiresIn: REFRESH_TOKEN_TTL,
    }),
  };
}

async function login(email, password) {
  const utente = await userRepository.findActiveByEmail(email);

  if (!utente) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError('Credenziali non valide', 401);
  }

  const valid = await bcrypt.compare(password, utente.password_hash);
  if (!valid) {
    throw new AppError('Credenziali non valide', 401);
  }

  await userRepository.updateLastLogin(utente.uuid);

  const tokens = buildTokenPair(utente);
  await userRepository.saveRefreshToken(utente.uuid, tokens.refreshToken);

  return { utente, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

async function refreshToken(oldToken) {
  if (!oldToken) {
    throw new AppError('Refresh token assente', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(oldToken, REFRESH_SECRET, JWT_OPTIONS);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      throw new AppError('Refresh token non valido o scaduto', 401);
    }
    throw err;
  }

  const user = await userRepository.findActiveByUuid(decoded.sub);
  if (!user) {
    throw new AppError('Refresh token non valido', 401);
  }

  // Rotation-reuse: token presentato ≠ token salvato → invalida la sessione.
  if (user.refresh_token !== userRepository.hashRefreshToken(oldToken)) {
    logger.warn('auth.refresh.reuse_detected', { user_uuid: user.uuid });
    await userRepository.clearRefreshTokenByUuid(user.uuid);
    throw new AppError('Refresh token non valido', 401);
  }

  const { accessToken, refreshToken: newRefreshToken } = buildTokenPair(user);
  await userRepository.saveRefreshToken(user.uuid, newRefreshToken);

  return { accessToken, newRefreshToken, user };
}

async function logout(token) {
  const deleted = await userRepository.deleteRefreshToken(token);
  if (!deleted[0]) {
    throw new AppError('Refresh token non valido', 401);
  }
}

async function getInfo(uuid) {
  const user = await userRepository.findActiveByUuidSafe(uuid);
  if (!user) {
    throw new AppError('Utente non trovato', 404);
  }
  return user;
}

async function changePassword(uuid, currentPassword, newPassword) {
  const user = await userRepository.findByUuid(uuid);
  if (!user) {
    throw new AppError('Utente non trovato', 404);
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new AppError('Password attuale non corretta', 400);
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await userRepository.updatePassword(uuid, newHash);
  // Invalida la sessione corrente: forza re-login con la nuova password.
  await userRepository.clearRefreshTokenByUuid(uuid);

  logger.info('auth.password_changed', { user_uuid: uuid });
}

module.exports = {
  login,
  refreshToken,
  logout,
  getInfo,
  changePassword,
};
