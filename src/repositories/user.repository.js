// src/repositories/user.repository.js

const crypto = require('crypto');
const { User } = require('../models');

// Campi mai esposti in response/JWT.
const EXCLUDED_USER_ATTRS = ['password_hash', 'refresh_token'];

// SHA-256 del refresh token: in DB salviamo solo l'hash, mai il token raw.
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function findByEmail(email) {
  return User.findOne({ where: { email } });
}

function findActiveByEmail(email) {
  return User.findOne({ where: { email, is_active: true } });
}

function findByUuid(uuid) {
  return User.findOne({ where: { uuid } });
}

function findActiveByUuid(uuid) {
  return User.findOne({ where: { uuid, is_active: true } });
}

// Variante "safe" senza campi sensibili — per le response (GET /auth/me).
function findActiveByUuidSafe(uuid) {
  return User.findOne({
    where: { uuid, is_active: true },
    attributes: { exclude: EXCLUDED_USER_ATTRS },
  });
}

function createUser(data) {
  return User.create(data);
}

function updateLastLogin(uuid) {
  return User.update({ last_login: new Date() }, { where: { uuid } });
}

function saveRefreshToken(uuid, token) {
  return User.update({ refresh_token: hashRefreshToken(token) }, { where: { uuid } });
}

function clearRefreshTokenByUuid(uuid, options = {}) {
  return User.update({ refresh_token: null }, { where: { uuid }, ...options });
}

// Invalida la sessione a partire dal token raw (logout). Ritorna [affectedRows].
function deleteRefreshToken(token) {
  return User.update(
    { refresh_token: null },
    { where: { refresh_token: hashRefreshToken(token) } },
  );
}

function updatePassword(uuid, password_hash, options = {}) {
  return User.update({ password_hash }, { where: { uuid }, ...options });
}

module.exports = {
  EXCLUDED_USER_ATTRS,
  hashRefreshToken,
  findByEmail,
  findActiveByEmail,
  findByUuid,
  findActiveByUuid,
  findActiveByUuidSafe,
  createUser,
  updateLastLogin,
  saveRefreshToken,
  clearRefreshTokenByUuid,
  deleteRefreshToken,
  updatePassword,
};
