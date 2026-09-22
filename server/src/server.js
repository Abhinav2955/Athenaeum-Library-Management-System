const http =
  require('http');

const app =
  require('./app');

const env =
  require('./config/env');

const logger =
  require('./config/logger');

const {
  connectDB,
  sequelize,
} =
  require('./config/db');

require('./database/models');

const {
  startScheduledJobs,
  runMaintenanceSweep,
} =
  require('./jobs/scheduler');

const {
  initSocket,
} =
  require('./sockets/notification.socket');

const {
  startEmailWorker,
} =
  require('./jobs/workers/email.worker');

const {
  emailQueue,
} =
  require('./jobs/queues/email.queue');

const redis =
  require('./config/redis');

let server;
let io;
let emailWorker;
let maintenanceTask;
let shuttingDown =
  false;

const start =
  async () => {
    await connectDB();

    if (
      env.NODE_ENV ===
      'development'
    ) {
      await sequelize.sync({
        alter:
          true,
      });

      logger.info(
        'Models synced (development mode)'
      );
    }

    const httpServer =
      http.createServer(
        app
      );

    io =
      initSocket(
        httpServer
      );

    server =
      httpServer.listen(
        env.PORT,
        () => {
          logger.info(
            `Server listening on port ${env.PORT} [${env.NODE_ENV}]`
          );
        }
      );

    maintenanceTask =
      startScheduledJobs();

    emailWorker =
      startEmailWorker();

    runMaintenanceSweep()
      .catch(
        (error) => {
          logger.error(
            'Initial maintenance sweep failed',
            {
              error:
                error.message,
            }
          );
        }
      );
  };

const closeHttpServer =
  () =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        if (!server) {
          resolve();
          return;
        }

        server.close(
          (error) => {
            if (error) {
              reject(
                error
              );
              return;
            }

            resolve();
          }
        );
      }
    );

const shutdown =
  async (
    signal
  ) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown =
      true;

    logger.info(
      `${signal} received, shutting down gracefully`
    );

    const forceExit =
      setTimeout(
        () => {
          logger.error(
            'Graceful shutdown timed out'
          );

          process.exit(1);
        },
        10000
      );

    forceExit.unref();

    try {
      if (maintenanceTask) {
        maintenanceTask.stop();
        maintenanceTask =
          null;
      }

      await closeHttpServer();

      if (io) {
        await new Promise(
          (resolve) => {
            io.close(
              resolve
            );
          }
        );
      }

      if (emailWorker) {
        await emailWorker.close();
      }

      if (emailQueue) {
        await emailQueue.close();
      }

      if (
        redis.status !==
        'end'
      ) {
        await redis.quit();
      }

      await sequelize.close();

      clearTimeout(
        forceExit
      );

      logger.info(
        'All connections closed'
      );

      process.exit(0);
    } catch (error) {
      clearTimeout(
        forceExit
      );

      logger.error(
        'Graceful shutdown failed',
        {
          error:
            error.message,
        }
      );

      process.exit(1);
    }
  };

process.on(
  'SIGTERM',
  () =>
    shutdown(
      'SIGTERM'
    )
);

process.on(
  'SIGINT',
  () =>
    shutdown(
      'SIGINT'
    )
);

process.on(
  'unhandledRejection',
  (reason) => {
    logger.error(
      'Unhandled promise rejection',
      {
        reason,
      }
    );
  }
);

start()
  .catch(
    (error) => {
      logger.error(
        'Failed to start server',
        {
          error:
            error.message,
        }
      );

      process.exit(1);
    }
  );