const { mapState } = require('../../services/flights.service');

describe('flights.service mapState', () => {
  it('mappa lo state vector posizionale OpenSky nei campi utili', () => {
    // [icao24, callsign, origin_country, time_position, last_contact, lng, lat,
    //  baro_altitude, on_ground, velocity, true_track, vertical_rate, sensors, geo_altitude]
    const state = [
      'abc123',
      'RYR123  ',
      'Ireland',
      1700000000,
      1700000001,
      9.12,
      39.22,
      10000,
      false,
      230,
      180,
      0,
      null,
      10500,
    ];
    const m = mapState(state);
    expect(m.icao24).toBe('abc123');
    expect(m.callsign).toBe('RYR123'); // trimmed
    expect(m.lat).toBe(39.22);
    expect(m.lng).toBe(9.12);
    expect(m.geo_altitude).toBe(10500);
  });

  it('callsign vuoto → null', () => {
    const m = mapState(['x', '   ', 'Italy', 0, 0, 9, 39, 0, true, 0, 0, 0, null, 0]);
    expect(m.callsign).toBeNull();
  });
});
