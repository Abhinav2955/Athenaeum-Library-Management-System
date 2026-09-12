const {
  Queue,
} = require('bullmq');

const connection =
  require('../../config/redis');

const env =
  require('../../config/env');

const logger =
  require('../../config/logger');

const emailQueue =
  new Queue(
    'email',
    {
      connection,
    }
  );


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
  
    if (
      env.NODE_ENV ===
      'test'
    ) {
      logger.debug(
        `📧 Test email skipped: ${payload.subject || 'No subject'} → ${payload.to || 'No recipient'}`
      );

      return {
        id:
          'test-email-skipped',

        skipped:
          true,

        data:
          payload,
      };
    }

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