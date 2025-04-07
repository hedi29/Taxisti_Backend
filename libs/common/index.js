// libs/common/index.js
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const winston = require('winston');

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'yourride-api' },
  transports: [
    new winston.transports.Console()
  ]
});

// Error handling
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  uuidv4,
  logger,
  AppError,
  Joi
};