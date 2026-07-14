// models/index.js

const sequelize = require('../config/db');

const User = require('./Users');
const Event = require('./Events');
const Setting = require('./Settings');

// ─────────────────────────────────────
// ASSOCIAZIONI
// ─────────────────────────────────────
// User ↔ Event (creatore). FK nullable: ON DELETE SET NULL (un evento
// sopravvive alla cancellazione dell'operatore che l'ha creato).
User.hasMany(Event, { foreignKey: 'created_by', as: 'created_events' });
Event.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// User ↔ Setting (ultimo che ha modificato).
User.hasMany(Setting, { foreignKey: 'updated_by', as: 'updated_settings' });
Setting.belongsTo(User, { foreignKey: 'updated_by', as: 'updated_by_user' });

module.exports = {
  sequelize,
  User,
  Event,
  Setting,
};
