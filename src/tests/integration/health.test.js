const request = require('supertest');
const app = require('../../../app');

describe('GET /health', () => {
  it('risponde 200 con status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/v1/map/provinces', () => {
  it('ritorna le 5 province (no DB richiesto)', async () => {
    const res = await request(app).get('/api/v1/map/provinces');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(5);
  });
});
