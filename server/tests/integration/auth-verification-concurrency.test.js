const request =
  require('supertest');

const crypto =
  require('crypto');

const app =
  require('../../src/app');

const {
  sequelize,
  User,
  RefreshToken,
} = require('../../src/database/models');

const {
  hashToken,
} = require('../../src/utils/token');

const stamp =
  Date.now();

const testUser = {
  name:
    'Verification Concurrency User',

  email:
    `verification.concurrent.${stamp}@example.com`,

  password:
    'StrongPass1',
};

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
    });

    const registerResponse =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          testUser
        );

    expect(
      registerResponse.statusCode
    ).toBe(201);
  }
);

describe(
  'Email verification concurrency',
  () => {
    it(
      'allows the same verification token to succeed only once',
      async () => {
        const user =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          user
        ).not.toBeNull();

        const rawToken =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        user.isEmailVerified =
          false;

        user.emailVerificationTokenHash =
          hashToken(
            rawToken
          );

        user.emailVerificationExpires =
          new Date(
            Date.now() +
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
                '/api/v1/auth/verify-email'
              )
              .send({
                token:
                  rawToken,
              }),

            request(app)
              .post(
                '/api/v1/auth/verify-email'
              )
              .send({
                token:
                  rawToken,
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
          400,
        ]);

        const successful =
          first.statusCode ===
          200
            ? first
            : second;

        const rejected =
          first.statusCode ===
          400
            ? first
            : second;

        expect(
          successful.body.data
            .accessToken
        ).toBeDefined();

        expect(
          successful.body.data
            .user.isEmailVerified
        ).toBe(true);

        expect(
          rejected.body.message
        ).toMatch(
          /invalid|expired/i
        );

        const updated =
          await User.findByPk(
            user.id
          );

        expect(
          updated.isEmailVerified
        ).toBe(true);

        expect(
          updated
            .emailVerificationTokenHash
        ).toBeNull();

        expect(
          updated
            .emailVerificationExpires
        ).toBeNull();

        const activeSessions =
          await RefreshToken.count({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeSessions
        ).toBe(1);
      }
    );

    it(
      'rejects reuse of the consumed verification token',
      async () => {
        const user =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          user
        ).not.toBeNull();

        const rawToken =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        user.isEmailVerified =
          false;

        user.emailVerificationTokenHash =
          hashToken(
            rawToken
          );

        user.emailVerificationExpires =
          new Date(
            Date.now() +
              60 *
                60 *
                1000
          );

        await user.save();

        const first =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                rawToken,
            });

        expect(
          first.statusCode
        ).toBe(200);

        const second =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                rawToken,
            });

        expect(
          second.statusCode
        ).toBe(400);

        expect(
          second.body.message
        ).toMatch(
          /invalid|expired/i
        );
      }
    );

    it(
      'does not create a session for an expired verification token',
      async () => {
        const user =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          user
        ).not.toBeNull();

        const rawToken =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        user.isEmailVerified =
          false;

        user.emailVerificationTokenHash =
          hashToken(
            rawToken
          );

        user.emailVerificationExpires =
          new Date(
            Date.now() -
              60 *
                1000
          );

        await user.save();

        const sessionsBefore =
          await RefreshToken.count({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },
          });

        const response =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                rawToken,
            });

        expect(
          response.statusCode
        ).toBe(400);

        const sessionsAfter =
          await RefreshToken.count({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },
          });

        expect(
          sessionsAfter
        ).toBe(
          sessionsBefore
        );
      }
    );
  }
);