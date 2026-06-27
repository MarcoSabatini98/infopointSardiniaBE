// src/constants/roles.js
// Ruoli applicativi. Per ora un solo operatore (admin). L'enum resta
// estendibile: aggiungere un ruolo qui + ALTER TABLE sull'ENUM DB.
const ROLES = Object.freeze({
  ADMIN: 'admin',
});

// Ruoli che possono autenticarsi (qualsiasi account attivo).
const AUTHENTICATED_ROLES = Object.freeze([ROLES.ADMIN]);

module.exports = { ROLES, AUTHENTICATED_ROLES };
