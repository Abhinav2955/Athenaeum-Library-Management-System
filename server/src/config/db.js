const {
  Sequelize,
} = require('sequelize');

const env =
  require('./env');

const logger =
  require('./logger');

const isTest =
  env.NODE_ENV ===
  'test';

const dialectOptions = {};

if (
  env.DB_SSL ===
  'true'
) {
  dialectOptions.ssl = {
    rejectUnauthorized:
      true,

    ca:
      env.DB_CA_CERT.replace(
        /\\n/g,
        '\n'
      ),
  };
}

const sequelize =
  new Sequelize(
    env.DB_NAME,
    env.DB_USER,
    env.DB_PASSWORD,
    {
      host:
        env.DB_HOST,

      port:
        env.DB_PORT,

      dialect:
        'mysql',

      logging:
        env.NODE_ENV ===
        'development'
          ? (message) =>
              logger.debug(
                message
              )
          : false,

      pool:
        isTest
          ? {
              max: 5,
              min: 0,
              acquire:
                10000,
              idle:
                100,
              evict:
                100,
            }
          : {
              max: 5,
              min: 0,
              acquire:
                30000,
              idle:
                10000,
            },

      define: {
        underscored:
          true,

        timestamps:
          true,
      },

      dialectOptions,
    }
  );

const connectDB =
  async () => {
    const maxAttempts =
      env.NODE_ENV ===
      'production'
        ? 10
        : 1;

    for (
      let attempt = 1;
      attempt <=
      maxAttempts;
      attempt += 1
    ) {
      try {
        await sequelize.authenticate();

        logger.info(
          'MySQL connection established'
        );

        return;
      } catch (error) {
        if (
          attempt ===
          maxAttempts
        ) {
          logger.error(
            'Unable to connect to MySQL',
            {
              error:
                error.message,
            }
          );

          throw error;
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              3000
            )
        );
      }
    }
  };

module.exports = {
  sequelize,
  connectDB,
};