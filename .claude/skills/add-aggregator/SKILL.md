---
name: add-aggregator
description: Scaffolda un nuovo aggregatore dati esterno (route + controller + service + costanti + validator + swagger) seguendo il pattern proxy+cache+degrado di infopointSardiniaBE. Usa quando l'utente vuole aggiungere una nuova fonte/dominio esterno (es. INGV terremoti, Open-Meteo Flood, ARPAS balneazione, OSM Overpass).
---

# add-aggregator

Crea un dominio aggregatore completo replicando il pattern esistente (`air`, `marine`, `fuel`, …):
**proxy verso fonte esterna → cache → degrado `available:false` → fallback opzionale**.

## Input da raccogliere

Chiedi (o deduci dal messaggio) prima di generare:

1. **Nome dominio** in kebab/lower singolo token → `<name>` (es. `quakes`, `flood`, `bathing`).
2. **Fonte**: URL base + se richiede chiave API (OAuth/query key) o è free senza chiave.
3. **Input query**: per-provincia (`?provincia=CA`), per-coordinate (`?lat=&lng=`), entrambi, o nessuno (lista regionale).
4. **Fallback** su seconda fonte? (come incendi EFFIS→FIRMS). Default no.

Se la fonte è senza chiave e per-provincia/coordinate, `air` è il modello 1:1 — copialo.

## Regole del pattern (NON violarle)

- Business logic e I/O esterno **solo nel service**. Controller = parse+risposta.
- Chiamate via `utils/httpClient.js` (`getJson(url)`), **sempre con timeout** (già dentro httpClient).
- Cache via `utils/cache.js` (`getOrSet(key, ttl, fn)`), TTL nuovo in `CACHE_TTL`.
- Fonte giù/errore → ritorna `{ available: false, ... }`, **non lanciare 500**. `AppError(msg, code)` solo per input invalido (400).
- Endpoint/URL configurabili via `.env` con default hard-coded (vedi `sources.constants.js`).
- **Mai loggare chiavi API.** Se serve chiave: leggerla da env in `sources.constants.js`, aggiungere riga in `.env.example` e in HANDOFF.md tabella chiavi.
- Validazione query con Joi in `validators/external.validator.js`, montata da `middlewares/validate.js`.

## File da creare/modificare

### 1. `src/constants/sources.constants.js` (modifica)

- Aggiungi TTL: dentro `CACHE_TTL`, `<name>: num(process.env.CACHE_TTL_<NAME>, <secondi>),`.
- Aggiungi URL: `const <NAME>_URL = process.env.<NAME>_URL || '<url>';` e esportalo in `module.exports`.
- Se serve chiave: `const <NAME>_KEY = process.env.<NAME>_KEY || '';` + export.

### 2. `src/validators/external.validator.js` (modifica, solo se ha input)

Aggiungi lo schema e esportalo. Per provincia+coordinate mutuamente esclusive, copia `airQuerySchema`:

```js
const <name>QuerySchema = Joi.object({
  provincia: Joi.string().valid(...PROVINCE_CODES),
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
}).oxor('provincia', 'lat');
```

### 3. `src/services/<name>.service.js` (nuovo)

```js
// src/services/<name>.service.js
// <descrizione fonte> (<free / chiave>).

const { getJson } = require('../utils/httpClient');
const { getOrSet } = require('../utils/cache');
const AppError = require('../errors/AppError');
const { <NAME>_URL, CACHE_TTL } = require('../constants/sources.constants');
const { getProvince } = require('../constants/provinces');

function buildUrl(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    // ...parametri specifici della fonte
    timezone: 'Europe/Rome',
  });
  return `${<NAME>_URL}?${params.toString()}`;
}

async function fetchPoint(lat, lng) {
  try {
    const raw = await getJson(buildUrl(lat, lng));
    return {
      available: true,
      coordinates: { lat, lng },
      // ...mappa i campi utili di raw
    };
  } catch {
    // Fonte giù → degrado, non 500.
    return { available: false, coordinates: { lat, lng } };
  }
}

function getByCoords(lat, lng) {
  const key = `<name>:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  return getOrSet(key, CACHE_TTL.<name>, () => fetchPoint(lat, lng));
}

function getByProvince(code) {
  const p = getProvince(code);
  if (!p) throw new AppError(`Provincia "${code}" non valida`, 400);
  return getByCoords(p.lat, p.lng);
}

module.exports = { getByCoords, getByProvince };
```

Variante **lista regionale** (nessun input, es. terremoti/incendi): esporta un solo
`getAll()` che cacha con chiave fissa `<name>:all` e ritorna `{ available, source, items }`.
Con fallback: prova fonte A, su errore/formato inatteso prova fonte B, imposta `source` di
conseguenza (modello `fires.service.js`).

### 4. `src/controllers/<name>.controller.js` (nuovo)

```js
// src/controllers/<name>.controller.js

const <name>Service = require('../services/<name>.service');
const AppError = require('../errors/AppError');
const { sendSuccess } = require('../utils/http.response');
const { CACHE_TTL } = require('../constants/sources.constants');

async function get(req, res, next) {
  try {
    const { provincia, lat, lng } = req.query;
    let data;
    if (provincia) {
      data = await <name>Service.getByProvince(provincia);
    } else if (lat != null && lng != null) {
      data = await <name>Service.getByCoords(Number(lat), Number(lng));
    } else {
      throw new AppError('Specificare "provincia" oppure "lat" e "lng"', 400);
    }
    res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL.<name>}`);
    return sendSuccess(res, 200, data);
  } catch (error) {
    return next(error);
  }
}

module.exports = { get };
```

### 5. `src/routes/<name>.routes.js` (nuovo)

```js
const express = require('express');
const router = express.Router();

const <name>Controller = require('../controllers/<name>.controller');
const validate = require('../middlewares/validate');
const { <name>QuerySchema } = require('../validators/external.validator');

// GET /<name>?provincia=CA  oppure  GET /<name>?lat=..&lng=..
router.get('/', validate(<name>QuerySchema, 'query'), <name>Controller.get);

module.exports = router;
```

### 6. `src/routes/index.js` (modifica)

- Import in cima con gli altri: `const <name>Routes = require('./<name>.routes');`
- Mount con gli altri: `router.use('/<name>', <name>Routes);`

### 7. `docs/paths/<name>.yaml` (nuovo)

Documenta l'endpoint in stile Swagger come gli altri file in `docs/paths/` (verifica come
sono strutturati aggregators.yaml/traffic.yaml e copia lo schema).

## Verifica finale (obbligatoria)

- `npm run lint`
- `npm test`
- Avvia `npm run dev` e prova: `GET http://localhost:3000/<name>?provincia=CA` → 200 con
  `available:true`; simula fonte giù (URL fittizio) → `available:false`, **non** 500.

Se hai aggiunto una chiave: aggiornata `.env.example` e la tabella chiavi in `../HANDOFF.md`?

## Commit

Messaggio senza riferimenti a Claude/AI (regola progetto). Lavoro su branch `feat/<name>`.
