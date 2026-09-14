const IORedis =
  require('ioredis');

const env =
  require('./env');

const logger =
  require('./logger');

const connectionOptions = {
  host:
    env.REDIS_HOST,

  port:
    env.REDIS_PORT,

  maxRetriesPerRequest:
    null,

  connectTimeout:
    10000,

  enableReadyCheck:
    true,
};

if (
  env.REDIS_USERNAME
) {
  connectionOptions.username =
    env.REDIS_USERNAME;
}

if (
  env.REDIS_PASSWORD
) {
  connectionOptions.password =
    env.REDIS_PASSWORD;
}

if (
  env.REDIS_TLS ===
  'true'
) {
  connectionOptions.tls = {};
}

const connection =
  new IORedis(
    connectionOptions
  );

connection.on(
  'connect',
  () => {
    logger.info(
      'Redis connection established'
    );
  }
);

connection.on(
  'error',
  (error) => {
    logger.error(
      'Redis connection error',
      {
        error:
          error.message,
      }
    );
  }
);

module.exports =
  connection;