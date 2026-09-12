const express =
  require('express');

const cors =
  require('cors');

const helmet =
  require('helmet');

const morgan =
  require('morgan');

const cookieParser =
  require('cookie-parser');

const swaggerUi =
  require('swagger-ui-express');

const env =
  require('./config/env');

const logger =
  require('./config/logger');

const v1Routes =
  require('./routes/v1.routes');

const openapiSpec =
  require('./docs/openapi.json');

const {
  apiLimiter,
} =
  require('./middlewares/rateLimiter.middleware');

const {
  auditMiddleware,
} =
  require('./middlewares/audit.middleware');

const {
  notFoundHandler,
  errorHandler,
} =
  require('./middlewares/error.middleware');

const app =
  express();

app.use(
  helmet()
);

app.use(
  cors({
    origin:
      env.CLIENT_ORIGIN,

    credentials:
      true,
  })
);

app.use(
  express.json({
    limit:
      '10kb',
  })
);

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      '10kb',
  })
);

app.use(
  cookieParser()
);

app.use(
  morgan(
    env.NODE_ENV ===
      'development'
      ? 'dev'
      : 'combined',

    {
      stream: {
        write:
          (message) =>
            logger.info(
              message.trim()
            ),
      },
    }
  )
);

app.use(
  '/api',
  apiLimiter
);

app.get(
  '/health',
  (
    req,
    res
  ) => {
    res
      .status(200)
      .json({
        status:
          'ok',

        uptime:
          process.uptime(),

        timestamp:
          Date.now(),
      });
  }
);

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(
    openapiSpec
  )
);

app.get(
  '/api-docs.json',
  (
    req,
    res
  ) =>
    res.json(
      openapiSpec
    )
);


app.use(
  auditMiddleware
);

app.use(
  '/api/v1',
  v1Routes
);

app.use(
  notFoundHandler
);

app.use(
  errorHandler
);

module.exports =
  app;