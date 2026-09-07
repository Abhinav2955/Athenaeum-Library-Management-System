const nodemailer = require('nodemailer');

const env = require('../config/env');

const logger = require('../config/logger');

let transporterPromise = null;

/*
 * Local development should NOT repeatedly connect
 * to a real Gmail account.
 *
 * Development / test:
 *   Ethereal test SMTP
 *
 * Production:
 *   configured SMTP credentials
 */
const shouldUseRealSmtp = () =>
  env.NODE_ENV === 'production' &&
  env.SMTP_HOST &&
  env.SMTP_USER &&
  env.SMTP_PASS;

const createConfiguredTransporter = () => {
  logger.info(
    `📧 Using production SMTP host: ${env.SMTP_HOST}`
  );

  return nodemailer.createTransport({
    host: env.SMTP_HOST,

    port:
      env.SMTP_PORT || 587,

    secure:
      Number(env.SMTP_PORT) === 465,

    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },

    /*
     * Prevent long hanging SMTP connections.
     */
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,

    /*
     * Reuse SMTP connection where possible.
     */
    pool: true,

    maxConnections: 2,
    maxMessages: 50,
  });
};

const createDevelopmentTransporter =
  async () => {
    const testAccount =
      await nodemailer.createTestAccount();

    logger.info(
      '📧 Development email mode: using Ethereal test inbox'
    );

    logger.info(
      '📧 Real SMTP credentials are ignored outside production'
    );

    return nodemailer.createTransport({
      host:
        'smtp.ethereal.email',

      port: 587,

      secure: false,

      auth: {
        user:
          testAccount.user,

        pass:
          testAccount.pass,
      },

      connectionTimeout:
        10000,

      greetingTimeout:
        10000,

      socketTimeout:
        15000,
    });
  };

const getTransporter =
  async () => {
    if (transporterPromise) {
      return transporterPromise;
    }

    transporterPromise =
      shouldUseRealSmtp()
        ? Promise.resolve(
            createConfiguredTransporter()
          )
        : createDevelopmentTransporter();

    /*
     * Important:
     *
     * If transporter creation itself fails, clear
     * the cached promise so a later request can
     * create a fresh transporter instead of keeping
     * a permanently rejected Promise.
     */
    transporterPromise.catch(
      () => {
        transporterPromise =
          null;
      }
    );

    return transporterPromise;
  };

const sendEmail = async ({
  to,
  subject,
  html,
}) => {
  const transporter =
    await getTransporter();

  const info =
    await transporter.sendMail({
      from:
        env.SMTP_FROM ||
        '"Athenaeum Library" <no-reply@athenaeum.local>',

      to,

      subject,

      html,
    });

  /*
   * Ethereal returns a browser preview URL.
   *
   * No message is actually delivered to the
   * recipient's real inbox.
   */
  const previewUrl =
    nodemailer.getTestMessageUrl(
      info
    );

  if (previewUrl) {
    logger.info(
      `📧 Email preview: ${previewUrl}`
    );
  } else {
    logger.info(
      `📧 Email sent successfully to ${to}`
    );
  }

  return info;
};

module.exports = {
  sendEmail,
};