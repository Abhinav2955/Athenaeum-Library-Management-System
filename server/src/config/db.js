const {
  Sequelize,
} = require('sequelize');

const env =
  require('./env');

const logger =
  require('./logger');

const pool =
  env.NODE_ENV === 'test'
    ? {
        max: 5,
        min: 0,
        acquire: 10000,
        idle: 100,
        evict: 100,
      }
    : {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      };

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

      pool,

      define: {
        underscored:
          true,

        timestamps:
          true,
      },
    }
  );

const connectDB =
  async () => {
    try {
      await sequelize
        .authenticate();

      logger.info(
        'MySQL connection established'
      );
    } catch (error) {
      logger.error(
        'Unable to connect to MySQL',
        {
          error:
            error.message,
        }
      );

      process.exit(1);
    }
  };

module.exports = {
  sequelize,
  connectDB,
};