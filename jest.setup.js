// jest.setup.js
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true';

require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

process.env.JWT_SECRET ??= 'test_secret';
process.env.JWT_REFRESH ??= 'test_refresh';
process.env.JWT_ISSUER ??= 'http://localhost:3000';
process.env.JWT_AUDIENCE ??= 'http://localhost:4200';
