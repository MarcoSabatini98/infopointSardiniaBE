# infopointSardiniaBE — guida per Claude

Backend REST della dashboard di monitoraggio regionale Sardegna (meteo, incendi, allerte,
traffico strada/aria/mare, news, eventi). Node.js + Express 5, MySQL + Sequelize.

## Architettura a livelli

Flusso fisso, rispettalo sempre:

```
routes/ → controllers/ → services/ → repositories/ → models/
```

- **routes**: solo wiring Express + middleware (auth, validate, cache-control).
- **controllers**: parse richiesta, chiama service, formatta risposta via `utils/http.response.js`.
- **services**: logica + I/O esterno. La business logic vive qui.
- **repositories**: accesso DB Sequelize (solo domini persistiti: event, setting, user).
- **models**: schema Sequelize.

Validazione con **Joi** in `validators/`, montata da `middlewares/validate.js`.
Errori: lancia `errors/AppError.js` (mai `throw new Error` grezzo nei service).

## Pattern aggregatore (domini API esterne)

I domini `weather, marine, air, fires, floods, flights, vessels, traffic, news, fuel` sono
**proxy verso fonti esterne**, non DB. Contratto comune per ognuno:

1. Service fa la chiamata via `utils/httpClient.js`, con **timeout**.
2. Risposta **cache** con `utils/cache.js` (node-cache) — TTL per dominio.
3. Fonte giù/errore → **degrada** a `{ available: false, ... }`, non lanciare 500.
4. Fallback dove esiste (es. incendi: EFFIS → NASA FIRMS; indica `source`).
5. **Mai loggare chiavi API.**

Nuovo aggregatore = replica questo pattern (route + controller + service + costanti in
`constants/` + validator se prende input). Domini valutati ma non ancora integrati: INGV terremoti,
Open-Meteo Flood, ARPAS balneazione, OSM Overpass.

## Geocoding

`services/geocode.service.js` — forward + reverse via Nominatim, **coda 1 req/s**, cache 30gg.
Reverse-geocoding pesante (es. comune traffico) va fatto **in background con budget**, non nel
path della risposta.

## Auth

JWT operatore admin: access token in body, refresh in cookie httpOnly, **rotation-reuse**.
bcrypt per password. Guard rotte via `middlewares/require.role.middleware.js` +
`verify.access.token.middleware.js`.

## DB

Sequelize + `sequelize-cli`. Migration in `database/migrations/` (naming `YYYYMMDDHHmmss-*`),
seeder in `database/seeders/`. MySQL via `docker compose up -d`.

- `npm run migrate` / `npm run seed` / `npm run db:reset`
- Non editare `.env` (chiavi reali) né `package-lock.json` — hook li blocca.

## Verifiche (prima di PR)

- `npm run lint`
- `npm test` (unit + integration, split Jest)

## Git flow

`develop` è il branch di sviluppo. Lavoro su `feat/xxx` → push → PR su `develop`.
Merge su `main` lo fa l'utente.

**Commit: nessun riferimento a Claude/AI nei messaggi** (richiesta esplicita dell'utente).
Nessun `Co-Authored-By` Claude, nessun footer generato.
