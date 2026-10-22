// Parser SardegnaTurismo: markup attuale (titolo in .field--name-title).
const { parse } = require('../../services/agenda.service');

const HTML = `
<div class="node node-evento node-teaser clearfix">
  <div class="field-name-field-immagine-top"><a href="/it/eventi/jazzalguer"><img src="/sites/default/files/ja26.jpg"></a></div>
  <div class="field-name-field-riassunto-tappe-data"><span>10 Aprile - 30 Ottobre</span></div>
  <div class="field-name-field-riassunto-tappe-nomi"><div>Alghero, Bosa</div></div>
  <div class="field field--name-title"><h2><a href="/it/eventi/jazzalguer">JazzAlguer</a></h2></div>
</div>`;

describe('agenda parse', () => {
  it('estrae titolo, link, data, luoghi e immagine dal markup attuale', () => {
    const [e] = parse(HTML);
    expect(e).toMatchObject({
      title: 'JazzAlguer',
      link: 'https://www.sardegnaturismo.it/it/eventi/jazzalguer',
      date: '10 Aprile - 30 Ottobre',
      placeNames: ['Alghero', 'Bosa'],
      image: 'https://www.sardegnaturismo.it/sites/default/files/ja26.jpg',
    });
  });
});
