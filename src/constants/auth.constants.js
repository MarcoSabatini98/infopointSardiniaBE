// src/constants/auth.constants.js

module.exports = Object.freeze({
  // Token TTL
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '7d',

  // bcrypt cost factor
  BCRYPT_COST: 12,

  // Rate limiter login (anti brute-force)
  LOGIN_LIMITER_WINDOW_MS: 15 * 60 * 1000,
  LOGIN_LIMITER_MAX: 10,

  // Rate limiter refresh
  REFRESH_LIMITER_WINDOW_MS: 5 * 60 * 1000,
  REFRESH_LIMITER_MAX: 30,
});
