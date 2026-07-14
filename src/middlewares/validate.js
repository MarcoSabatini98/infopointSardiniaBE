const logger = require('../utils/logger');

const VALID_TARGETS = ['body', 'query', 'params', 'headers'];

function validate(schema, target = 'body') {
  if (!VALID_TARGETS.includes(target)) {
    throw new Error(`validate(): target non valido "${target}"`);
  }
  if (!schema || typeof schema.validate !== 'function') {
    throw new Error('validate(): schema Joi non valido');
  }

  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.debug(`Validation fail on ${target} ${req.method} ${req.path}: ${error.message}`);
      return res.status(400).json({
        status: 'fail',
        success: false,
        message: 'Dati non validi',
        data: {
          message: 'Dati non validi',
          errors: error.details.map((e) => e.message),
          errorDetails: error.details.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
            rule: e.type,
          })),
        },
      });
    }

    // Express 5: req.query è getter → non riassegnabile direttamente.
    if (target === 'query') {
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    } else if (target !== 'headers') {
      req[target] = value;
    }
    return next();
  };
}

module.exports = validate;
