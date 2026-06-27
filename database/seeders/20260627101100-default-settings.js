'use strict';

// Config iniziale della dashboard: layer mappa abilitati di default e
// intervalli di refresh (secondi) consigliati al FE per il polling.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const settings = [
      {
        key: 'map.default_layer',
        value: JSON.stringify('weather'),
        description: 'Layer mostrato all’apertura della mappa',
      },
      {
        key: 'map.enabled_layers',
        value: JSON.stringify(['weather', 'fires', 'floods', 'news', 'events']),
        description: 'Layer selezionabili dal selettore mappa',
      },
      {
        key: 'refresh_intervals',
        value: JSON.stringify({ weather: 900, fires: 600, floods: 600, news: 900 }),
        description: 'Intervalli di polling (secondi) consigliati al frontend',
      },
    ];

    for (const s of settings) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM settings WHERE `key` = :key LIMIT 1',
        { replacements: { key: s.key }, type: queryInterface.sequelize.QueryTypes.SELECT },
      );
      if (existing) continue;
      await queryInterface.bulkInsert('settings', [{ ...s, created_at: now, updated_at: now }]);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('settings', {
      key: ['map.default_layer', 'map.enabled_layers', 'refresh_intervals'],
    });
  },
};
