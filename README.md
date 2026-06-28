# infopoint Sardegna — Back End

**infopoint Sardegna** è una dashboard gestionale per il monitoraggio regionale della Sardegna in
tempo (quasi) reale: meteo, incendi, allagamenti/allerte, traffico stradale, traffico aereo e
marittimo, news ed eventi, il tutto su una mappa interattiva a livello provinciale.

Questo repository è il **back end**: un'API REST che aggrega le sorgenti dati esterne (con cache),
gestisce gli eventi su database e serve i dati per la mappa.

- **Frontend:** Angular → `infopointSardiniaFE`
- **Backend:** Node.js + Express → `infopointSardiniaBE`

---

## Prerequisiti

| Strumento | Versione minima |
| --------- | --------------- |
| Node.js   | 18.x (testato su 24.x) |
| npm       | 9.x             |
| MySQL     | 8.x             |
| Docker    | opzionale (per il DB) |

---

## Installazione

```bash
# 1. Clona il repository
git clone https://github.com/MarcoSabatini98/infopointSardiniaBE.git
cd infopointSardiniaBE

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente
cp .env.example .env
# Apri .env e compila i valori (vedi tabella sotto)

# 4. Avvia il database (oppure usa un MySQL già attivo)
docker compose up -d

# 5. Migrazioni + seed (crea l'utente admin)
npm run migrate
npm run seed

# 6. Avvio
npm run dev      # sviluppo (nodemon)
npm start        # produzione
```

---

## Accesso ai servizi

| Servizio | URL |
| -------- | --- |
| API (base) | http://localhost:3000/api/v1 |
| Swagger (API docs) | http://localhost:3000/api-docs |
| Health check | http://localhost:3000/health |

> L'utente admin viene creato dal seed con le credenziali definite in `.env`
> (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

---

## Stack

Express 5 · Sequelize + MySQL · JWT (operatore admin) · Joi · Winston · Swagger ·
`node-cache` (cache TTL) · `rss-parser` (news/allerte) · `cheerio` (scraping eventi) ·
`fetch` nativo + `WebSocket` nativo (collector AIS) · Jest + Supertest · ESLint + Prettier + Husky.

Architettura a livelli: `routes → controllers → services → repositories → models`.
Gli aggregatori esterni sono **proxy + cache** (nessuna persistenza); se una sorgente è giù,
l'endpoint degrada a `available:false` senza propagare errori.

---

## Variabili d'ambiente

### Server / DB / JWT
| Variabile | Obbligatoria | Descrizione |
| --------- | :---: | ----------- |
| `PORT` | ❌ | Porta server (default `3000`) |
| `NODE_ENV` | ❌ | `development` \| `production` \| `test` |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | ✅ | Connessione MySQL |
| `DB_DIALECT` | ❌ | `mysql` (default) |
| `DB_TIMEZONE` | ❌ | Offset numerico, es. `+02:00` |
| `JWT_SECRET` `JWT_REFRESH` | ✅ | Chiavi firma access/refresh token |
| `JWT_ISSUER` `JWT_AUDIENCE` | ✅ (prod) | Issuer/Audience dei token |
| `CORS_ORIGIN` | ✅ (prod) | Origin del frontend (CSV) |
| `ADMIN_EMAIL` `ADMIN_PASSWORD` `ADMIN_NAME` | ✅ | Credenziali admin per il seed |

### Sorgenti dati esterne
| Variabile | Obbligatoria | Descrizione |
| --------- | :---: | ----------- |
| `OPEN_METEO_BASE_URL` | ❌ | Meteo (gratis, senza chiave) |
| `EFFIS_BASE_URL` | ❌ | Incendi EFFIS (JRC) |
| `FIRMS_MAP_KEY` | ❌ | Fallback incendi NASA FIRMS — [richiedi key](https://firms.modaps.eosdis.nasa.gov/api/map_key) |
| `PROTEZIONE_CIVILE_FEED_URL` | ❌ | Feed allerte (default: RSS idrogeologico SardegnaTurismo) |
| `OPENSKY_CLIENT_ID` `OPENSKY_CLIENT_SECRET` | ❌ | Voli OpenSky (OAuth2) |
| `AISSTREAM_API_KEY` | ❌ | Navi AIS — [richiedi key](https://aisstream.io) |
| `TOMTOM_API_KEY` | ❌ | Traffico stradale — [richiedi key](https://developer.tomtom.com) |
| `SARDEGNATURISMO_EVENTS_URL` | ❌ | Pagina eventi ufficiale (scraping) |
| `CACHE_TTL_*` | ❌ | TTL cache per sorgente (secondi) |

> Le sorgenti senza chiave configurata rispondono `available:false` (nessun crash).

---

## Endpoint principali (`/api/v1`)

| Area | Rotta | Auth |
| --- | --- | --- |
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` | mista |
| Eventi (DB) | `GET /events` · `GET /events/:id` · `POST/PATCH/DELETE /events/:id` | read pubblica, write admin |
| Eventi (esterni) | `GET /events/external` (SardegnaTurismo) | pubblica |
| Meteo | `GET /weather?provincia=CA` | pubblica |
| Incendi | `GET /fires` (EFFIS → fallback FIRMS) | pubblica |
| Allerte | `GET /floods` | pubblica |
| News | `GET /news` | pubblica |
| Voli | `GET /flights` | pubblica |
| Navi | `GET /vessels` | pubblica |
| Traffico | `GET /traffic` | pubblica |
| Mappa | `GET /map/provinces` · `GET /map/provinces/geojson` · `GET /map/provinces/:code` · `GET /map/layers/:layer` | pubblica |
| Settings | `GET /settings` · `GET /settings/:key` · `PUT /settings/:key` | read pubblica, write admin |

Risposte in formato **JSend** (`{ status, success, data }`).

---

## Fonti dati

| Dominio | Fonte | Note |
| --- | --- | --- |
| Meteo | [Open-Meteo](https://open-meteo.com) | gratis, senza chiave |
| Incendi | [EFFIS](https://forest-fire.emergency.copernicus.eu) + fallback [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) | EFFIS backend Oracle talvolta giù → fallback FIRMS |
| Allerte | Protezione Civile Sardegna (RSS idrogeologico) | |
| News | RSS: ANSA Sardegna, L'Unione Sarda, SkyTG24 | La Nuova Sardegna esclusa (bloccata, 403) |
| Voli | [OpenSky Network](https://opensky-network.org) (OAuth2) | |
| Navi | [aisstream.io](https://aisstream.io) (WebSocket) | collector in-process, snapshot REST |
| Traffico | [TomTom Traffic](https://developer.tomtom.com) | bbox tiling per limite 10.000 km² |
| Eventi | [SardegnaTurismo](https://www.sardegnaturismo.it/it/eventi) | scraping (no API/RSS) |

---

## Script

| Comando | Azione |
| --- | --- |
| `npm run dev` | Avvio con nodemon |
| `npm start` | Avvio produzione |
| `npm run migrate` / `seed` | Migrazioni / seed DB |
| `npm run db:reset` | Drop + create + migrate + seed |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Test unit + integration (Jest) |
