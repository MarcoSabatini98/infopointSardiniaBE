// models/Settings.js
// Key/value store per la configurazione della dashboard (toggle layer mappa,
// intervalli di refresh consigliati al FE, ecc). `value` JSON per flessibilità.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Setting = sequelize.define(
  'Setting',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { notEmpty: true },
    },
    value: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    tableName: 'settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

module.exports = Setting;
