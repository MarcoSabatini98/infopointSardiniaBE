// src/validators/auth.validator.js

const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).required(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().min(1).required(),
  new_password: Joi.string()
    .min(10)
    .pattern(/[A-Z]/, 'maiuscola')
    .pattern(/[a-z]/, 'minuscola')
    .pattern(/[0-9]/, 'cifra')
    .required()
    .messages({
      'string.min': 'La nuova password deve avere almeno 10 caratteri',
      'string.pattern.name': 'La nuova password deve contenere almeno una {#name}',
    }),
});

module.exports = { loginSchema, changePasswordSchema };
