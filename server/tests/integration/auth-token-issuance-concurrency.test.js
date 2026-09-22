const request =
  require('supertest');

const app =
  require('../../src/app');

const {
  sequelize,
  User,
} = require('../../src/database/models');

const {
  VERIFICATION_RESEND_COOLDOWN_MS,
} = require('../../src/modules/auth/auth.service');

const stamp =
  Date.now();

const verificationUser = {
  name:
    'Verification Issuance User',

  email:
    `verification.issuance.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const resetUser = {
  name:
    'Reset Issuance User',

  email:
    `reset.issuance.${stamp}@example.com`,

  password:
    'StrongPass1',
};

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
    });

    const verificationRegistration =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          verificationUser
        );

    expect(
      verificationRegistration.statusCode
    ).toBe(201);

    const resetRegistration =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          resetUser
        );

    expect(
      resetRegistration.statusCode
    ).toBe(201);
  }
);

describe(
  'Auth token issuance concurrency',
  () => {
    it(
      'allows only one concurrent verification resend after cooldown',
      async () => {
        const user =
          await User.findOne({
            where: {
              email:
                verificationUser.email,
            },
          });

        user.emailVerificationExpires =
          new Date(
            Date.now() -
              VERIFICATION_RESEND_COOLDOWN_MS -
              1000 +
              24 *
                60 *
                60 *
                1000
          );

        await user.save();

        const [
          first,
          second,
        ] =
          await Promise.all([
            request(app)
              .post(
                '/api/v1/auth/resend-verification'
              )
              .send({
                email:
                  verificationUser.email,
              }),

            request(app)
              .post(
                '/api/v1/auth/resend-verification'
              )
              .send({
                email:
                  verificationUser.email,
              }),
          ]);

        const statuses = [
          first.statusCode,
          second.statusCode,
        ].sort(
          (a, b) =>
            a - b
        );

        expect(
          statuses
        ).toEqual([
          200,
          429,
        ]);

        const updated =
          await User.findOne({
            where: {
              email:
                verificationUser.email,
            },
          });

        expect(
          updated
            .emailVerificationTokenHash
        ).toBeTruthy();

        expect(
          updated
            .emailVerificationExpires
        ).not.toBeNull();
      }
    );

    it(
      'keeps the first password-reset token valid during an immediate repeated request',
      async () => {
        const first =
          await request(app)
            .post(
              '/api/v1/auth/forgot-password'
            )
            .send({
              email:
                resetUser.email,
            });

        expect(
          first.statusCode
        ).toBe(200);

        const afterFirst =
          await User.findOne({
            where: {
              email:
                resetUser.email,
            },
          });

        expect(
          afterFirst
            .passwordResetTokenHash
        ).toBeTruthy();

        expect(
          afterFirst
            .passwordResetExpires
        ).not.toBeNull();

        const firstHash =
          afterFirst
            .passwordResetTokenHash;

        const firstExpiry =
          new Date(
            afterFirst
              .passwordResetExpires
          ).getTime();

        const second =
          await request(app)
            .post(
              '/api/v1/auth/forgot-password'
            )
            .send({
              email:
                resetUser.email,
            });

        expect(
          second.statusCode
        ).toBe(200);

        const afterSecond =
          await User.findOne({
            where: {
              email:
                resetUser.email,
            },
          });

        expect(
          afterSecond
            .passwordResetTokenHash
        ).toBe(
          firstHash
        );

        expect(
          new Date(
            afterSecond
              .passwordResetExpires
          ).getTime()
        ).toBe(
          firstExpiry
        );
      }
    );

    it(
      'preserves one password-reset token under concurrent requests',
      async () => {
        const user =
          await User.findOne({
            where: {
              email:
                resetUser.email,
            },
          });

        user.passwordResetTokenHash =
          null;

        user.passwordResetExpires =
          null;

        await user.save();

        const [
          first,
          second,
        ] =
          await Promise.all([
            request(app)
              .post(
                '/api/v1/auth/forgot-password'
              )
              .send({
                email:
                  resetUser.email,
              }),

            request(app)
              .post(
                '/api/v1/auth/forgot-password'
              )
              .send({
                email:
                  resetUser.email,
              }),
          ]);

        expect(
          first.statusCode
        ).toBe(200);

        expect(
          second.statusCode
        ).toBe(200);

        const updated =
          await User.findOne({
            where: {
              email:
                resetUser.email,
            },
          });

        expect(
          updated
            .passwordResetTokenHash
        ).toBeTruthy();

        expect(
          updated
            .passwordResetExpires
        ).not.toBeNull();

        const hashAfterConcurrency =
          updated
            .passwordResetTokenHash;

        const immediateThird =
          await request(app)
            .post(
              '/api/v1/auth/forgot-password'
            )
            .send({
              email:
                resetUser.email,
            });

        expect(
          immediateThird.statusCode
        ).toBe(200);

        const afterThird =
          await User.findOne({
            where: {
              email:
                resetUser.email,
            },
          });

        expect(
          afterThird
            .passwordResetTokenHash
        ).toBe(
          hashAfterConcurrency
        );
      }
    );

    it(
      'keeps forgot-password non-enumerating for an unknown email',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/auth/forgot-password'
            )
            .send({
              email:
                `unknown.${Date.now()}@example.com`,
            });

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.body.message
        ).toMatch(
          /if an account exists/i
        );
      }
    );
  }
);