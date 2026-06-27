// src/controllers/auth.controller.js

const authService = require('../services/auth.service');
const AppError = require('../errors/AppError');
const { sendSuccess } = require('../utils/http.response');

const isProduction = () => process.env.NODE_ENV === 'production';

// __Host- prefix solo in prod (richiede Secure=true, non usabile su http://localhost).
function getRefreshCookieName() {
  return isProduction() ? '__Host-refresh_token' : 'refresh_token';
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'Strict' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function clearRefreshCookieOptions() {
  // eslint-disable-next-line no-unused-vars
  const { maxAge, ...rest } = refreshCookieOptions();
  return rest;
}

function toAuthUserDTO(user) {
  return { uuid: user.uuid, nome: user.name, email: user.email, role: user.role };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.cookie(getRefreshCookieName(), result.refreshToken, refreshCookieOptions());
    const { utente, accessToken } = result;
    return sendSuccess(res, 200, {
      message: 'Login effettuato',
      accessToken,
      user: toAuthUserDTO(utente),
    });
  } catch (error) {
    return next(error);
  }
}

async function refreshToken(req, res, next) {
  try {
    const token = req.cookies[getRefreshCookieName()];
    const { accessToken, newRefreshToken, user } = await authService.refreshToken(token);
    res.cookie(getRefreshCookieName(), newRefreshToken, refreshCookieOptions());
    return sendSuccess(res, 200, {
      message: 'Token rigenerati',
      accessToken,
      user: toAuthUserDTO(user),
    });
  } catch (error) {
    return next(error);
  }
}

// Idempotente: cookie mancante o token già invalido → 200 comunque.
async function logout(req, res, next) {
  try {
    const cookieName = getRefreshCookieName();
    const token = req.cookies[cookieName];
    if (token) {
      try {
        await authService.logout(token);
      } catch (err) {
        if (!(err instanceof AppError && err.statusCode === 401)) {
          return next(err);
        }
      }
    }
    res.clearCookie(cookieName, clearRefreshCookieOptions());
    return sendSuccess(res, 200, { message: 'Logout effettuato' });
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getInfo(req.user.sub);
    return sendSuccess(res, 200, toAuthUserDTO(user));
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    await authService.changePassword(req.user.sub, current_password, new_password);
    return sendSuccess(res, 200, { message: 'Password aggiornata con successo' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, refreshToken, logout, getMe, changePassword };
