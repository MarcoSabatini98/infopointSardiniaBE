const { createEventSchema } = require('../../validators/event.validator');

const base = {
  title: 'Sagra del pane',
  province_code: 'OR',
  start_date: '2026-07-01',
};

describe('event.validator coerenza type↔category', () => {
  it('accetta NATURALE + incendio', () => {
    const { error } = createEventSchema.validate({
      ...base,
      type: 'NATURALE',
      category: 'incendio',
    });
    expect(error).toBeUndefined();
  });

  it('accetta CULTURALE + sagra', () => {
    const { error } = createEventSchema.validate({
      ...base,
      type: 'CULTURALE',
      category: 'sagra',
    });
    expect(error).toBeUndefined();
  });

  it('rifiuta NATURALE + concerto (categoria di altro tipo)', () => {
    const { error } = createEventSchema.validate({
      ...base,
      type: 'NATURALE',
      category: 'concerto',
    });
    expect(error).toBeDefined();
  });

  it('rifiuta provincia non valida', () => {
    const { error } = createEventSchema.validate({
      ...base,
      province_code: 'XX',
      type: 'CULTURALE',
      category: 'sagra',
    });
    expect(error).toBeDefined();
  });
});
