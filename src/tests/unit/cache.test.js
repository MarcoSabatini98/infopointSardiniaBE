const { getOrSet, flush, del } = require('../../utils/cache');

describe('utils/cache getOrSet', () => {
  beforeEach(() => flush());

  it('esegue il producer al miss e ritorna il valore', async () => {
    const producer = jest.fn().mockResolvedValue(42);
    const v = await getOrSet('k1', 10, producer);
    expect(v).toBe(42);
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('al secondo accesso serve dalla cache senza richiamare il producer', async () => {
    const producer = jest.fn().mockResolvedValue('ciao');
    await getOrSet('k2', 10, producer);
    const v = await getOrSet('k2', 10, producer);
    expect(v).toBe('ciao');
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('dopo del() ri-esegue il producer', async () => {
    const producer = jest.fn().mockResolvedValue(1);
    await getOrSet('k3', 10, producer);
    del('k3');
    await getOrSet('k3', 10, producer);
    expect(producer).toHaveBeenCalledTimes(2);
  });
});
