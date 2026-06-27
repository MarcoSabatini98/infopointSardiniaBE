// server.js
process.env.TZ = 'Europe/Rome';
require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./src/models');
const logger = require('./src/utils/logger');
const { startCollector, stopCollector } = require('./src/services/vessels.service');

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server;
let shuttingDown = false;

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Connessione al database riuscita');

    server = app.listen(PORT, () => {
      logger.info(`Server avviato su http://localhost:${PORT}`);
      logger.info(`Documentazione su http://localhost:${PORT}/api-docs`);
    });

    // Collector AIS (traffico marittimo): si avvia solo se AISSTREAM_API_KEY
    // è impostata; altrimenti logga e resta inattivo. Fire-and-forget.
    startCollector();
  } catch (error) {
    logger.error('Errore connessione database', error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`${signal} ricevuto — avvio shutdown`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timeout superato — exit forzato');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    stopCollector();
    if (server && server.listening) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') return reject(err);
          resolve();
        });
      });
    }
    await sequelize.close();
    logger.info('Shutdown completato');
    process.exit(0);
  } catch (err) {
    logger.error('Errore durante lo shutdown', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  shutdown('uncaughtException');
});

start();
