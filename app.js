// app.js
require('dotenv').config();

// ─────────────────────────────────────
// BOOT-TIME ENV VALIDATION (fail-fast)
// Senza i secret JWT l'app partirebbe e crasherebbe alla prima richiesta auth.
// ─────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH'];
const REQUIRED_ENV_PROD = ['JWT_ISSUER', 'JWT_AUDIENCE', 'CORS_ORIGIN'];

for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
}
if (process.env.NODE_ENV === 'production') {
  for (const name of REQUIRED_ENV_PROD) {
    if (!process.env[name]) {
      throw new Error(`Missing required env var (prod): ${name}`);
    }
  }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./src/config/swagger');
const logger = require('./src/utils/logger');
const { sendFail, sendError } = require('./src/utils/http.response');
const routes = require('./src/routes');

const app = express();
app.set('etag', 'strong');

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

app.use(compression({ threshold: 1024 }));

// ─────────────────────────────────────
// SECURITY (Helmet)
// crossOriginResourcePolicy rilassata: il FE (porta diversa) carica le icone
// statiche degli eventi servite da questo BE.
// ─────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─────────────────────────────────────
// CORS — strip trailing slash dagli origin per tollerare entrambi i formati.
// ─────────────────────────────────────
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, '')),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ─────────────────────────────────────
// RATE LIMITING globale
// ─────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  skip: (req) => {
    const isLocal = ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip);
    return process.env.NODE_ENV === 'test' && isLocal;
  },
  message: {
    status: 'fail',
    success: false,
    message: 'Troppe richieste — riprova tra un minuto',
    data: { message: 'Troppe richieste — riprova tra un minuto' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1', generalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, { stream: { write: (m) => logger.info(m.trim()) } }));

// ─────────────────────────────────────
// ASSET STATICI (icone/loghi eventi già pronti)
// ─────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────
// SWAGGER UI
// ─────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────
app.use('/api/v1', routes);

// ─────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────
app.get('/health', (_req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─────────────────────────────────────
// 404
// ─────────────────────────────────────
app.use((_req, res) => sendFail(res, 404, { message: 'Risorsa non trovata' }));

// ─────────────────────────────────────
// GLOBAL ERROR HANDLER (JSend: 4xx → fail, 5xx → error)
// ─────────────────────────────────────
const ERROR_MAP = {
  JsonWebTokenError: { status: 401, message: 'Token non valido' },
  TokenExpiredError: { status: 401, message: 'Token scaduto' },
  SequelizeUniqueConstraintError: { status: 409, message: 'Dato già esistente' },
  SequelizeForeignKeyConstraintError: { status: 400, message: 'Riferimento a record inesistente' },
  SequelizeDatabaseError: { status: 400, message: 'Errore database' },
};

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  logger.error(`${req.method} ${req.originalUrl} → ${err.message}`, err);

  if (err.type === 'entity.parse.failed') {
    return sendFail(res, 400, { message: 'JSON malformato' });
  }
  if (err.name === 'SequelizeValidationError') {
    return sendFail(res, 400, {
      message: 'Dati non validi',
      errors: err.errors.map((e) => e.message),
    });
  }

  const mapped = ERROR_MAP[err.name];
  if (mapped) {
    return sendFail(res, mapped.status, { message: mapped.message });
  }

  if (err.statusCode) {
    if (err.statusCode < 500) {
      return sendFail(res, err.statusCode, { message: err.message });
    }
    return sendError(res, err.statusCode, err.message);
  }

  return sendError(
    res,
    500,
    process.env.NODE_ENV === 'production' ? 'Errore interno del server' : err.message,
  );
});

module.exports = app;
