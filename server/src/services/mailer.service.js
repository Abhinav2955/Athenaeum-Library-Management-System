const nodemailer = require('nodemailer');

const env = require('../config/env');
const logger = require('../config/logger');

let transporterPromise = null;

const createDevelopmentTransporter =
  async () => {
    const testAccount =
      await nodemailer.createTestAccount();

    logger.info(
      'Development email mode: using Ethereal test inbox'
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

const getDevelopmentTransporter =
  async () => {
    if (transporterPromise) {
      return transporterPromise;
    }

    transporterPromise =
      createDevelopmentTransporter();

    transporterPromise.catch(
      () => {
        transporterPromise =
          null;
      }
    );

    return transporterPromise;
  };

const sendWithResend =
  async ({
    to,
    subject,
    html,
  }) => {
    if (!env.RESEND_API_KEY) {
      throw new Error(
        'RESEND_API_KEY is required in production'
      );
    }

    const response =
      await fetch(
        'https://api.resend.com/emails',
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${env.RESEND_API_KEY}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            from:
              env.RESEND_FROM,

            to: [to],

            subject,

            html,
          }),

          signal:
            AbortSignal.timeout(
              15000
            ),
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.message ||
        `Resend request failed with status ${response.status}`
      );
    }

    logger.info(
      `Email sent successfully to ${to}`
    );

    return result;
  };

const sendWithEthereal =
  async ({
    to,
    subject,
    html,
  }) => {
    const transporter =
      await getDevelopmentTransporter();

    const info =
      await transporter.sendMail({
        from:
          '"Athenaeum Library" <no-reply@athenaeum.local>',

        to,

        subject,

        html,
      });

    const previewUrl =
      nodemailer.getTestMessageUrl(
        info
      );

    if (previewUrl) {
      logger.info(
        `Email preview: ${previewUrl}`
      );
    }

    return info;
  };

const sendEmail =
  async ({
    to,
    subject,
    html,
  }) => {
    if (
      env.NODE_ENV ===
      'production'
    ) {
      return sendWithResend({
        to,
        subject,
        html,
      });
    }

    return sendWithEthereal({
      to,
      subject,
      html,
    });
  };

module.exports = {
  sendEmail,
};