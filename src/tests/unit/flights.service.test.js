const { mapState } = require('../../services/flights.service');

describe('flights.service mapState (adsb.lol)', () => {
  it('mappa un aereo adsb.lol nei campi utili, con conversione unità e arricchimenti', () => {
    const ac = {
      hex: 'abc123',
      flight: 'RYR123  ',
      t: 'B738',
      r: 'EI-DYL',
      lat: 39.22,
      lon: 9.12,
      alt_baro: 32800, // ft
      alt_geom: 34400, // ft
      gs: 250, // kn
      track: 180,
      baro_rate: 0,
    };
    const m = mapState(ac);
    expect(m.icao24).toBe('abc123');
    expect(m.callsign).toBe('RYR123'); // trim
    expect(m.airline).toBe('Ryanair'); // prefisso RYR
    expect(m.aircraft_type).toBe('B738');
    expect(m.registration).toBe('EI-DYL');
    expect(m.origin_country).toBe('Irlanda'); // EI → Irlanda
    expect(m.lat).toBe(39.22);
    expect(m.lng).toBe(9.12);
    expect(m.on_ground).toBe(false);
    expect(m.geo_altitude).toBe(Math.round(34400 * 0.3048)); // ft → m
    expect(m.velocity).toBeCloseTo(250 * 0.514444, 3); // kn → m/s
  });

  it('alt_baro "ground" → on_ground e quota 0; callsign vuoto → null', () => {
    const m = mapState({ hex: 'x', flight: '   ', lat: 39, lon: 9, alt_baro: 'ground' });
    expect(m.on_ground).toBe(true);
    expect(m.baro_altitude).toBe(0);
    expect(m.callsign).toBeNull();
  });
});
