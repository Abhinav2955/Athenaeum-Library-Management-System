const winston =
  require('winston');

const env =
  require('./env');

const production =
  env.NODE_ENV ===
  'production';

const transports = [
  new winston.transports.Console(),
];

if (!production) {
  transports.push(
    new winston.transports.File({
      filename:
        'logs/error.log',
      level:
        'error',
    }),
    new winston.transports.File({
      filename:
        'logs/combined.log',
    })
  );
}

const logger =
  winston.createLogger({
    level:
      production
        ? 'info'
        : 'debug',

    format:
      winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({
          stack:
            true,
        }),
        production
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                ({
                  timestamp,
                  level,
                  message,
                  stack,
                  ...meta
                }) => {
                  const metaStr =
                    Object.keys(meta).length
                      ? ` ${JSON.stringify(meta)}`
                      : '';

                  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
                }
              )
            )
      ),

    transports,

    exitOnError:
      false,
  });

module.exports =
  logger;