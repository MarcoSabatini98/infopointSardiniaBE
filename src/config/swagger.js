const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const { version } = require('../../package.json');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'infopointSardinia API',
      version,
      description:
        'API della dashboard gestionale degli eventi locali in Sardegna: eventi, meteo, incendi, allagamenti, news e mappa provinciale.',
    },
    servers: [{ url: BASE_URL, description: process.env.NODE_ENV || 'development' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  // glob (usato da swagger-jsdoc) vuole forward slash: su Windows path.resolve
  // produce backslash e il match fallisce → 0 path caricati. Normalizziamo.
  apis: [path.resolve(__dirname, '../../docs/**/*.yaml').replace(/\\/g, '/')],
};

const swaggerSpec = swaggerJSDoc(options);

if (!swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
  console.warn('[swagger] Nessun path caricato: controllare i file YAML in ./docs');
}

module.exports = swaggerSpec;
