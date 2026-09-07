const {
  Worker,
} = require('bullmq');

const connection =
  require('../../config/redis');

const logger =
  require('../../config/logger');

const env =
  require('../../config/env');

const {
  sendEmail,
} = require('../../services/mailer.service');

const startEmailWorker =
  () => {
    /*
     * Lower concurrency in development.
     *
     * Production can process several email jobs
     * simultaneously.
     */
    const concurrency =
      env.NODE_ENV ===
      'production'
        ? 5
        : 1;

    const worker =
      new Worker(
        'email',

        async (job) => {
          await sendEmail(
            job.data
          );
        },

        {
          connection,
          concurrency,
        }
      );

    worker.on(
      'completed',
      (job) => {
        logger.debug(
          `Email job ${job.id} completed`
        );
      }
    );

    worker.on(
      'failed',
      (job, err) => {
        if (!job) {
          logger.error(
            'Email worker job failed',
            {
              error:
                err.message,
            }
          );

          return;
        }

        const maxAttempts =
          job.opts
            ?.attempts || 1;

        const currentAttempt =
          job.attemptsMade;

        /*
         * Only call it a final failure when the
         * configured retry limit has actually been
         * reached.
         */
        if (
          currentAttempt >=
          maxAttempts
        ) {
          logger.error(
            `Email job ${job.id} failed permanently`,
            {
              attempts:
                currentAttempt,

              error:
                err.message,
            }
          );
        } else {
          logger.warn(
            `Email job ${job.id} failed; retry scheduled`,
            {
              attempt:
                currentAttempt,

              maxAttempts,

              error:
                err.message,
            }
          );
        }
      }
    );

    worker.on(
      'error',
      (err) => {
        logger.error(
          'Email worker error',
          {
            error:
              err.message,
          }
        );
      }
    );

    logger.info(
      `📬 Email worker started with concurrency ${concurrency}`
    );

    return worker;
  };

module.exports = {
  startEmailWorker,
};