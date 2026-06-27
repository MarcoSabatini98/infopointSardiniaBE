'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Seed dell'operatore admin unico. Credenziali da .env (ADMIN_EMAIL /
// ADMIN_PASSWORD). Idempotente: salta se l'email esiste già.
module.exports = {
  up: async (queryInterface) => {
    const email = process.env.ADMIN_EMAIL || 'admin@infopoint.sardegna.it';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe_123!';
    const name = process.env.ADMIN_NAME || 'Admin';

    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email }, type: queryInterface.sequelize.QueryTypes.SELECT },
    );
    if (existing) {
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        uuid: crypto.randomUUID(),
        email,
        password_hash,
        role: 'admin',
        name,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    const email = process.env.ADMIN_EMAIL || 'admin@infopoint.sardegna.it';
    await queryInterface.bulkDelete('users', { email });
  },
};
