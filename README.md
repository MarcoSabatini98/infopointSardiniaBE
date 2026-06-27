# infopointSardiniaBE

Backend della dashboard gestionale degli eventi locali in Sardegna: gestione eventi
(CRUD) + aggregazione in tempo (quasi) reale di **meteo**, **incendi**, **allagamenti/allerte**
e **news**, più i dati per una **mappa interattiva** a livello provinciale.

## Stack

Express 5 · Sequelize + MySQL · JWT (operatore admin) · Joi · Winston · Swagger ·
`node-cache` (cache TTL in-memory) · `rss-parser` (news) · Jest + Supertest ·
ESLint + Prettier + Husky.

Niente socket.io / multer / cron: gli aggiornamenti live sono **polling + cache** lato FE,
le immagini eventi sono asset statici serviti dal BE.

## Architettura

```
routes → controllers → services → repositories → models (Sequelize)
                       └→ services esterni (fetch + cache)
```

- **CRUD su DB**: `events`, `settings`, `users` (auth).
- **Aggregatori (puro proxy + cache, niente DB)**: weather (Open-Meteo), fires (EFFIS),
  floods/alerts (Protezione Civile / ARPAS), news (RSS).
- **Map**: GeoJSON statico delle 5 province + endpoint di aggregazione per provincia.

## Avvio rapido

```bash
cp .env.example .env        # compila i valori
docker compose up -d        # MySQL
npm install
npm run migrate
npm run seed                # crea l'admin (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run dev
```

- API: `http://localhost:3000/api/v1`
- Docs Swagger: `http://localhost:3000/api-docs`
- Health: `http://localhost:3000/health`

## Endpoint principali (v1)

| Area | Rotta | Auth |
| --- | --- | --- |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | mista |
| Eventi | `GET /events`, `GET /events/:id`, `POST/PATCH/DELETE /events/:id` | read pubblica, write admin |
| Meteo | `GET /weather?provincia=CA` | pubblica |
| Incendi | `GET /fires` | pubblica |
| Allagamenti | `GET /floods` | pubblica |
| News | `GET /news` | pubblica |
| Mappa | `GET /map/provinces`, `GET /map/provinces/:code`, `GET /map/layers/:layer` | pubblica |
| Settings | `GET /settings`, `PUT /settings/:key` | read pubblica, write admin |

## Fonti dati

- **Meteo**: [Open-Meteo](https://open-meteo.com) — gratis, senza chiave.
- **Incendi**: [EFFIS / Copernicus](https://effis.jrc.ec.europa.eu).
- **Allagamenti/allerte**: Protezione Civile Sardegna / ARPAS (feed da configurare in `.env`).
- **News**: feed RSS (ANSA Sardegna, Unione Sarda, La Nuova Sardegna, SkyTG24).
