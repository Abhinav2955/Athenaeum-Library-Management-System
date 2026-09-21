const {
  UniqueConstraintError,
  ValidationError,
  ForeignKeyConstraintError,
} = require('sequelize');

const env =
  require('../config/env');

const logger =
  require('../config/logger');

const ApiError =
  require('../utils/ApiError');

const notFoundHandler =
  (req, res, next) => {
    next(
      ApiError.notFound(
        `Route not found: ${req.method} ${req.originalUrl}`
      )
    );
  };

const errorHandler =
  (err, req, res, next) => {
    let {
      statusCode,
      message,
      details,
    } = err;

    if (
      err instanceof
      UniqueConstraintError
    ) {
      statusCode = 409;

      message =
        'A record with the same unique value already exists';

      details =
        err.errors?.map(
          (error) => ({
            field:
              error.path,

            message:
              error.message,
          })
        ) || null;

      logger.warn(
        message,
        {
          path:
            req.originalUrl,

          statusCode,
        }
      );
    } else if (
      err instanceof
      ForeignKeyConstraintError
    ) {
      statusCode = 409;

      message =
        'This operation conflicts with related data';

      details = null;

      logger.warn(
        message,
        {
          path:
            req.originalUrl,

          statusCode,
        }
      );
    } else if (
      err instanceof
        ValidationError &&
      !(
        err instanceof
        UniqueConstraintError
      )
    ) {
      statusCode = 400;

      message =
        'Database validation failed';

      details =
        err.errors?.map(
          (error) => ({
            field:
              error.path,

            message:
              error.message,
          })
        ) || null;

      logger.warn(
        message,
        {
          path:
            req.originalUrl,

          statusCode,
        }
      );
    } else if (
      !(
        err instanceof
        ApiError
      )
    ) {
      statusCode = 500;

      message =
        env.NODE_ENV ===
        'production'
          ? 'Internal server error'
          : err.message;

      details = null;

      logger.error(
        'Unhandled error',
        {
          error:
            err.message,

          stack:
            err.stack,
        }
      );
    } else if (
      statusCode >= 500
    ) {
      logger.error(
        err.message,
        {
          stack:
            err.stack,
        }
      );
    } else {
      logger.warn(
        err.message,
        {
          path:
            req.originalUrl,

          statusCode,
        }
      );
    }

    res
      .status(
        statusCode || 500
      )
      .json({
        success: false,

        message:
          message ||
          'Something went wrong',

        ...(details
          ? {
              details,
            }
          : {}),

        ...(env.NODE_ENV ===
        'development'
          ? {
              stack:
                err.stack,
            }
          : {}),
      });
  };

module.exports = {
  notFoundHandler,
  errorHandler,
};