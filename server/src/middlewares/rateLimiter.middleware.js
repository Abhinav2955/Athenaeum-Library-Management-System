const rateLimit =
  require('express-rate-limit');

const env =
  require('../config/env');

const apiLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max: 300,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      success:
        false,

      message:
        'Too many requests, please try again later',
    },
  });

const authLimiter =
  rateLimit({
    windowMs:
      env.AUTH_RATE_LIMIT_WINDOW_MS,

    max:
      env.AUTH_RATE_LIMIT_MAX,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      true,

    message: {
      success:
        false,

      message:
        'Too many attempts, please try again later',
    },
  });

const refreshLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    max: 60,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      false,

    message: {
      success:
        false,

      message:
        'Too many refresh requests, please try again later',
    },
  });

const verificationResendLimiter =
  rateLimit({
    windowMs:
      10 * 60 * 1000,

    max: 5,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      false,

    message: {
      success:
        false,

      message:
        'Too many verification email requests. Please try again later.',
    },
  });

module.exports = {
  apiLimiter,
  authLimiter,
  refreshLimiter,
  verificationResendLimiter,
};