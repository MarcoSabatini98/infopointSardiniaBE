const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/', 'coverage/', 'logs/', '**/*.log', 'src/data/*.geojson'],
  },

  // Regole generali (backend Node.js)
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      'no-unreachable': 'error',
      'no-async-promise-executor': 'error',
      'require-await': 'error',
      eqeqeq: ['error', 'smart'],
      curly: 'error',
      'no-eval': 'error',
      'no-shadow': 'warn',
      'no-use-before-define': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
    },
  },

  // Override per i file di test Jest
  {
    files: ['src/tests/**/*.js', 'jest.setup.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },

  // Prettier compat — DEVE essere l'ultimo blocco.
  prettierConfig,
];
