'use strict';

const NATURALE = [
  'incendio',
  'allagamento',
  'allerta_meteo',
  'frana',
  'ondata_calore',
  'vento_forte',
  'mareggiata',
  'altro',
];
const CULTURALE = [
  'sagra',
  'concerto',
  'mostra',
  'fiera',
  'sportivo',
  'religioso',
  'teatro',
  'altro',
];
const ALL_CATEGORIES = [...new Set([...NATURALE, ...CULTURALE])];
const PROVINCE_CODES = ['CA', 'SS', 'NU', 'OR', 'SU'];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.UUIDV4,
      },
      type: { type: Sequelize.ENUM('NATURALE', 'CULTURALE'), allowNull: false },
      category: { type: Sequelize.ENUM(...ALL_CATEGORIES), allowNull: false },
      title: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
      province_code: { type: Sequelize.ENUM(...PROVINCE_CODES), allowNull: false },
      comune: { type: Sequelize.STRING(120), allowNull: true, defaultValue: null },
      lat: { type: Sequelize.DECIMAL(9, 6), allowNull: true, defaultValue: null },
      lng: { type: Sequelize.DECIMAL(9, 6), allowNull: true, defaultValue: null },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: true, defaultValue: null },
      time: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
      venue: { type: Sequelize.STRING(200), allowNull: true, defaultValue: null },
      icon_url: { type: Sequelize.STRING(500), allowNull: true, defaultValue: null },
      logo_url: { type: Sequelize.STRING(500), allowNull: true, defaultValue: null },
      is_free: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: null },
      website: { type: Sequelize.STRING(500), allowNull: true, defaultValue: null },
      contacts: { type: Sequelize.STRING(255), allowNull: true, defaultValue: null },
      organizer: { type: Sequelize.STRING(200), allowNull: true, defaultValue: null },
      status: {
        type: Sequelize.ENUM('bozza', 'pubblicato', 'annullato'),
        allowNull: false,
        defaultValue: 'bozza',
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        defaultValue: null,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('events', ['province_code']);
    await queryInterface.addIndex('events', ['type']);
    await queryInterface.addIndex('events', ['status']);
    await queryInterface.addIndex('events', ['start_date']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('events');
  },
};
