// models/Events.js

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { EVENT_TYPES, ALL_CATEGORIES, EVENT_STATUS } = require('../constants/event.constants');
const { PROVINCE_CODES } = require('../constants/provinces');

// Tabella unica per i due macro-tipi (NATURALE | CULTURALE). La coerenza
// type↔category è validata da Joi al boundary (event.validator); qui l'ENUM
// è l'ultimo gate prima del DB. I feed esterni (incendi/allagamenti) NON
// finiscono qui: sono puro proxy+cache. type=NATURALE serve a registrare a
// mano eventi rilevanti.
const Event = sequelize.define(
  'Event',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4,
    },
    type: {
      type: DataTypes.ENUM(...Object.values(EVENT_TYPES)),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(...ALL_CATEGORIES),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: { notEmpty: true },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    province_code: {
      type: DataTypes.ENUM(...PROVINCE_CODES),
      allowNull: false,
    },
    comune: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: null,
    },
    lat: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      defaultValue: null,
    },
    lng: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      defaultValue: null,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
    },
    time: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    venue: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
    },
    icon_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    logo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    is_free: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    contacts: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    organizer: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(EVENT_STATUS)),
      allowNull: false,
      defaultValue: EVENT_STATUS.BOZZA,
    },
    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    tableName: 'events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['province_code'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['start_date'] },
    ],
  },
);

module.exports = Event;
