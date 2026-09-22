const request =
  require('supertest');

const crypto =
  require('crypto');

const app =
  require('../../src/app');

const {
  sequelize,
} = require('../../src/config/db');

const {
  User,
  RefreshToken,
} = require('../../src/database/models');

const {
  hashToken,
} = require('../../src/utils/token');

const {
  VERIFICATION_RESEND_COOLDOWN_MS,
} = require('../../src/modules/auth/auth.service');

const testUser = {
  name:
    'Test User',

  email:
    `test.${Date.now()}@example.com`,

  password:
    'StrongPass1',
};

let accessToken;

const getRefreshCookie =
  (
    response
  ) => {
    const cookies =
      response.headers[
        'set-cookie'
      ];

    expect(
      cookies
    ).toBeDefined();

    const refreshCookie =
      cookies.find(
        (cookie) =>
          cookie.startsWith(
            'lms_refresh_token='
          )
      );

    expect(
      refreshCookie
    ).toBeDefined();

    return refreshCookie
      .split(';')[0];
  };

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
    });
  }
);

describe(
  'Auth flow',
  () => {
    it(
      'registers a new unverified user without creating a session',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/auth/register'
            )
            .send(
              testUser
            );

        expect(
          res.statusCode
        ).toBe(201);

        expect(
          res.body.success
        ).toBe(true);

        expect(
          res.body.data
            .user.email
        ).toBe(
          testUser.email
        );

        expect(
          res.body.data
            .requiresVerification
        ).toBe(true);

        expect(
          res.body.data
            .accessToken
        ).toBeUndefined();

        expect(
          res.body.data
            .user.passwordHash
        ).toBeUndefined();

        const cookies =
          res.headers[
            'set-cookie'
          ];

        if (cookies) {
          expect(
            cookies.join(';')
          ).not.toMatch(
            /lms_refresh_token/
          );
        }

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

        expect(
          user.isEmailVerified
        ).toBe(false);

        expect(
          user.emailVerificationTokenHash
        ).toBeTruthy();

        expect(
          user.emailVerificationExpires
        ).not.toBeNull();
      }
    );

    it(
      'rejects duplicate registration',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/auth/register'
            )
            .send(
              testUser
            );

        expect(
          res.statusCode
        ).toBe(409);

        expect(
          res.body.message
        ).toMatch(
          /already exists/i
        );
      }
    );

    it(
      'rejects login with an incorrect password',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                testUser.email,

              password:
                'WrongPass1',
            });

        expect(
          res.statusCode
        ).toBe(401);

        expect(
          res.body.message
        ).toMatch(
          /invalid email or password/i
        );
      }
    );

    it(
      'allows test-environment login without changing the verification token',
      async () => {
        const before =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        const hashBefore =
          before
            .emailVerificationTokenHash;

        const expiryBefore =
          new Date(
            before
              .emailVerificationExpires
          ).getTime();

        const res =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              testUser
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
            .accessToken
        ).toBeDefined();

        expect(
          res.body.data
            .user.email
        ).toBe(
          testUser.email
        );

        getRefreshCookie(
          res
        );

        accessToken =
          res.body.data
            .accessToken;

        const after =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          after
            .emailVerificationTokenHash
        ).toBe(
          hashBefore
        );

        expect(
          new Date(
            after
              .emailVerificationExpires
          ).getTime()
        ).toBe(
          expiryBefore
        );
      }
    );

    it(
      'blocks an immediate verification-email resend',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/auth/resend-verification'
            )
            .send({
              email:
                testUser.email,
            });

        expect(
          res.statusCode
        ).toBe(429);

        expect(
          res.body.message
        ).toMatch(
          /wait/i
        );
      }
    );

    it(
      'allows another verification email after the cooldown',
      async () => {
        const user =
          await User.findOne({
            where: {
              email:
                testUser.email,
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

        const oldHash =
          user
            .emailVerificationTokenHash;

        const res =
          await request(app)
            .post(
              '/api/v1/auth/resend-verification'
            )
            .send({
              email:
                testUser.email,
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.message
        ).toMatch(
          /verification email/i
        );

        const updated =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          updated
            .emailVerificationTokenHash
        ).toBeTruthy();

        expect(
          updated
            .emailVerificationTokenHash
        ).not.toBe(
          oldHash
        );
      }
    );

    it(
      'blocks another resend immediately after a successful resend',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/auth/resend-verification'
            )
            .send({
              email:
                testUser.email,
            });

        expect(
          res.statusCode
        ).toBe(429);

        expect(
          res.body.message
        ).toMatch(
          /wait/i
        );
      }
    );

    it(
      'does not reveal whether an unknown resend email exists',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/auth/resend-verification'
            )
            .send({
              email:
                `unknown.${Date.now()}@example.com`,
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.message
        ).toMatch(
          /if an unverified account exists/i
        );
      }
    );

    it(
      'verifies the email and creates an authenticated session',
      async () => {
        const rawToken =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        const user =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

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

        const res =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                rawToken,
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
            .accessToken
        ).toBeDefined();

        expect(
          res.body.data
            .user.email
        ).toBe(
          testUser.email
        );

        expect(
          res.body.data
            .user.isEmailVerified
        ).toBe(true);

        getRefreshCookie(
          res
        );

        const updated =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

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

        accessToken =
          res.body.data
            .accessToken;
      }
    );

    it(
      'rejects reuse of the same verification link',
      async () => {
        const rawToken =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        const res =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                rawToken,
            });

        expect(
          res.statusCode
        ).toBe(400);

        expect(
          res.body.message
        ).toMatch(
          /invalid|expired/i
        );
      }
    );

    it(
      'does not send verification email again for an already verified account',
      async () => {
        const userBefore =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          userBefore
            .isEmailVerified
        ).toBe(true);

        expect(
          userBefore
            .emailVerificationTokenHash
        ).toBeNull();

        const res =
          await request(app)
            .post(
              '/api/v1/auth/resend-verification'
            )
            .send({
              email:
                testUser.email,
            });

        expect(
          res.statusCode
        ).toBe(200);

        const userAfter =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        expect(
          userAfter
            .emailVerificationTokenHash
        ).toBeNull();

        expect(
          userAfter
            .emailVerificationExpires
        ).toBeNull();
      }
    );

    it(
      'rotates the refresh token and revokes the previous token',
      async () => {
        const loginRes =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              testUser
            );

        expect(
          loginRes.statusCode
        ).toBe(200);

        const oldCookie =
          getRefreshCookie(
            loginRes
          );

        const oldToken =
          oldCookie
            .split('=')[1];

        const oldHash =
          hashToken(
            oldToken
          );

        const refreshRes =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              oldCookie
            );

        expect(
          refreshRes.statusCode
        ).toBe(200);

        expect(
          refreshRes.body.data
            .accessToken
        ).toBeDefined();

        const newCookie =
          getRefreshCookie(
            refreshRes
          );

        expect(
          newCookie
        ).not.toBe(
          oldCookie
        );

        const oldStored =
          await RefreshToken.findOne({
            where: {
              tokenHash:
                oldHash,
            },
          });

        expect(
          oldStored
        ).not.toBeNull();

        expect(
          oldStored.revokedAt
        ).not.toBeNull();

        expect(
          oldStored
            .replacedByTokenId
        ).not.toBeNull();

        expect(
          oldStored
            .replacementTokenCiphertext
        ).toBeTruthy();

        expect(
          oldStored
            .replacementTokenCiphertext
        ).not.toContain(
          newCookie
            .split('=')[1]
        );

        expect(
          oldStored
            .replacementTokenExpiresAt
        ).not.toBeNull();

        const newToken =
          newCookie
            .split('=')[1];

        const newStored =
          await RefreshToken.findOne({
            where: {
              tokenHash:
                hashToken(
                  newToken
                ),
            },
          });

        expect(
          newStored
        ).not.toBeNull();

        expect(
          newStored.revokedAt
        ).toBeNull();
      }
    );

    it(
      'recovers the rotated refresh token during the overlap window',
      async () => {
        const loginRes =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              testUser
            );

        expect(
          loginRes.statusCode
        ).toBe(200);

        const originalCookie =
          getRefreshCookie(
            loginRes
          );

        const firstRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              originalCookie
            );

        expect(
          firstRefresh.statusCode
        ).toBe(200);

        const rotatedCookie =
          getRefreshCookie(
            firstRefresh
          );

        const overlapRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              originalCookie
            );

        expect(
          overlapRefresh.statusCode
        ).toBe(200);

        expect(
          overlapRefresh.body.data
            .accessToken
        ).toBeDefined();

        const recoveredCookie =
          getRefreshCookie(
            overlapRefresh
          );

        expect(
          recoveredCookie
        ).toBe(
          rotatedCookie
        );

        const rotatedToken =
          rotatedCookie
            .split('=')[1];

        const rotatedStored =
          await RefreshToken.findOne({
            where: {
              tokenHash:
                hashToken(
                  rotatedToken
                ),
            },
          });

        expect(
          rotatedStored
        ).not.toBeNull();

        expect(
          rotatedStored.revokedAt
        ).toBeNull();
      }
    );

    it(
      'recovers the latest active refresh token through a rapid rotation chain',
      async () => {
        const loginRes =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              testUser
            );

        expect(
          loginRes.statusCode
        ).toBe(200);

        const originalCookie =
          getRefreshCookie(
            loginRes
          );

        const firstRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              originalCookie
            );

        expect(
          firstRefresh.statusCode
        ).toBe(200);

        const secondCookie =
          getRefreshCookie(
            firstRefresh
          );

        const secondRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              secondCookie
            );

        expect(
          secondRefresh.statusCode
        ).toBe(200);

        const thirdCookie =
          getRefreshCookie(
            secondRefresh
          );

        expect(
          thirdCookie
        ).not.toBe(
          secondCookie
        );

        const staleRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              originalCookie
            );

        expect(
          staleRefresh.statusCode
        ).toBe(200);

        expect(
          getRefreshCookie(
            staleRefresh
          )
        ).toBe(
          thirdCookie
        );
      }
    );

    it(
      'revokes all active sessions when a rotated refresh token is reused after the overlap window',
      async () => {
        const loginRes =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              testUser
            );

        expect(
          loginRes.statusCode
        ).toBe(200);

        const originalCookie =
          getRefreshCookie(
            loginRes
          );

        const originalToken =
          originalCookie
            .split('=')[1];

        const firstRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              originalCookie
            );

        expect(
          firstRefresh.statusCode
        ).toBe(200);

        const rotatedCookie =
          getRefreshCookie(
            firstRefresh
          );

        const originalStored =
          await RefreshToken.findOne({
            where: {
              tokenHash:
                hashToken(
                  originalToken
                ),
            },
          });

        expect(
          originalStored
        ).not.toBeNull();

        originalStored.replacementTokenExpiresAt =
          new Date(
            Date.now() -
              1000
          );

        await originalStored.save();

        const reuseRes =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              originalCookie
            );

        expect(
          reuseRes.statusCode
        ).toBe(401);

        expect(
          reuseRes.body.message
        ).toMatch(
          /reuse detected/i
        );

        const user =
          await User.findOne({
            where: {
              email:
                testUser.email,
            },
          });

        const activeTokens =
          await RefreshToken.count({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeTokens
        ).toBe(0);

        const rotatedRes =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              rotatedCookie
            );

        expect(
          rotatedRes.statusCode
        ).toBe(401);
      }
    );

    it(
      'rejects protected route without an access token',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/auth/me'
            );

        expect(
          res.statusCode
        ).toBe(401);
      }
    );

    it(
      'rejects a tampered access token',
      async () => {
        const parts =
          accessToken.split('.');

        expect(
          parts.length
        ).toBe(3);

        const tamperedToken =
          `${parts[0]}.${parts[1]}.${parts[2].slice(
            0,
            -1
          )}${
            parts[2].endsWith('a')
              ? 'b'
              : 'a'
          }`;

        const res =
          await request(app)
            .get(
              '/api/v1/auth/me'
            )
            .set(
              'Authorization',
              `Bearer ${tamperedToken}`
            );

        expect(
          res.statusCode
        ).toBe(401);

        expect(
          res.body.success
        ).toBe(false);
      }
    );

    it(
      'returns current verified user with a valid access token',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/auth/me'
            )
            .set(
              'Authorization',
              `Bearer ${accessToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.email
        ).toBe(
          testUser.email
        );

        expect(
          res.body.data
            .isEmailVerified
        ).toBe(true);

        expect(
          res.body.data
            .passwordHash
        ).toBeUndefined();
      }
    );
  }
);