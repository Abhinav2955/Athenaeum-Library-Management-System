const {
  Queue,
} = require('bullmq');

const connection =
  require('../../config/redis');

const env =
  require('../../config/env');

const emailQueue =
  new Queue(
    'email',
    {
      connection,
    }
  );

/*
 * Production email delivery can retry temporary
 * SMTP/network failures.
 *
 * Development should fail quickly instead of
 * repeatedly retrying local/test email jobs.
 */
const getJobOptions = () => {
  if (
    env.NODE_ENV ===
    'production'
  ) {
    return {
      attempts: 3,

      backoff: {
        type:
          'exponential',

        delay:
          15000,
      },

      removeOnComplete:
        100,

      removeOnFail:
        500,
    };
  }

  return {
    attempts: 1,

    removeOnComplete:
      100,

    removeOnFail:
      100,
  };
};

const queueEmail =
  async (payload) => {
    return emailQueue.add(
      'send-email',

      payload,

      getJobOptions()
    );
  };

module.exports = {
  emailQueue,
  queueEmail,
};