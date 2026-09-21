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

const changeUser = {
  name:
    'Password Change User',

  email:
    `password.change.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const resetUser = {
  name:
    'Password Reset User',

  email:
    `password.reset.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const getRefreshCookie =
  (response) => {
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

const registerAndLogin =
  async (credentials) => {
    const registerResponse =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          credentials
        );

    expect(
      registerResponse.statusCode
    ).toBe(201);

    const loginResponse =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(
          credentials
        );

    expect(
      loginResponse.statusCode
    ).toBe(200);

    return {
      accessToken:
        loginResponse.body
          .data.accessToken,

      refreshCookie:
        getRefreshCookie(
          loginResponse
        ),
    };
  };

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
    });
  }
);

describe(
  'Password security',
  () => {
    it(
      'changes the password and revokes every active refresh session atomically',
      async () => {
        const firstSession =
          await registerAndLogin(
            changeUser
          );

        const secondLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              changeUser
            );

        expect(
          secondLogin.statusCode
        ).toBe(200);

        const secondCookie =
          getRefreshCookie(
            secondLogin
          );

        const user =
          await User.findOne({
            where: {
              email:
                changeUser.email,
            },
          });

        expect(
          user
        ).not.toBeNull();

        const activeBefore =
          await RefreshToken.count({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeBefore
        ).toBeGreaterThanOrEqual(
          2
        );

        const changeResponse =
          await request(app)
            .post(
              '/api/v1/auth/change-password'
            )
            .set(
              'Authorization',
              `Bearer ${firstSession.accessToken}`
            )
            .send({
              currentPassword:
                changeUser.password,

              newPassword:
                'ChangedPass2',
            });

        expect(
          changeResponse.statusCode
        ).toBe(200);

        const activeAfter =
          await RefreshToken.count({
            where: {
              userId:
                user.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeAfter
        ).toBe(0);

        const oldRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              secondCookie
            );

        expect(
          oldRefresh.statusCode
        ).toBe(401);

        const oldPasswordLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              changeUser
            );

        expect(
          oldPasswordLogin.statusCode
        ).toBe(401);

        const newPasswordLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                changeUser.email,

              password:
                'ChangedPass2',
            });

        expect(
          newPasswordLogin.statusCode
        ).toBe(200);
      }
    );

    it(
      'allows only one concurrent password change using the same old password',
      async () => {
        const user = {
          name:
            'Concurrent Password User',

          email:
            `password.concurrent.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const session =
          await registerAndLogin(
            user
          );

        const [
          first,
          second,
        ] =
          await Promise.all([
            request(app)
              .post(
                '/api/v1/auth/change-password'
              )
              .set(
                'Authorization',
                `Bearer ${session.accessToken}`
              )
              .send({
                currentPassword:
                  user.password,

                newPassword:
                  'FirstPass2',
              }),

            request(app)
              .post(
                '/api/v1/auth/change-password'
              )
              .set(
                'Authorization',
                `Bearer ${session.accessToken}`
              )
              .send({
                currentPassword:
                  user.password,

                newPassword:
                  'SecondPass2',
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

        const firstLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                user.email,

              password:
                'FirstPass2',
            });

        const secondLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                user.email,

              password:
                'SecondPass2',
            });

        expect(
          [
            firstLogin.statusCode,
            secondLogin.statusCode,
          ].sort(
            (a, b) =>
              a - b
          )
        ).toEqual([
          200,
          401,
        ]);
      }
    );

    it(
      'consumes a reset token once and revokes active refresh sessions',
      async () => {
        const session =
          await registerAndLogin(
            resetUser
          );

        const user =
          await User.findOne({
            where: {
              email:
                resetUser.email,
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

        user.passwordResetTokenHash =
          hashToken(
            rawToken
          );

        user.passwordResetExpires =
          new Date(
            Date.now() +
              60 *
                60 *
                1000
          );

        await user.save();

        const resetResponse =
          await request(app)
            .post(
              '/api/v1/auth/reset-password'
            )
            .send({
              token:
                rawToken,

              password:
                'ResetPass2',
            });

        expect(
          resetResponse.statusCode
        ).toBe(200);

        const updated =
          await User.findByPk(
            user.id
          );

        expect(
          updated
            .passwordResetTokenHash
        ).toBeNull();

        expect(
          updated
            .passwordResetExpires
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
        ).toBe(0);

        const oldRefresh =
          await request(app)
            .post(
              '/api/v1/auth/refresh'
            )
            .set(
              'Cookie',
              session.refreshCookie
            );

        expect(
          oldRefresh.statusCode
        ).toBe(401);

        const reuseResponse =
          await request(app)
            .post(
              '/api/v1/auth/reset-password'
            )
            .send({
              token:
                rawToken,

              password:
                'AnotherPass3',
            });

        expect(
          reuseResponse.statusCode
        ).toBe(400);

        expect(
          reuseResponse.body
            .message
        ).toMatch(
          /invalid|expired/i
        );

        const newLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                resetUser.email,

              password:
                'ResetPass2',
            });

        expect(
          newLogin.statusCode
        ).toBe(200);
      }
    );

    it(
      'allows only one concurrent use of the same password reset token',
      async () => {
        const userData = {
          name:
            'Concurrent Reset User',

          email:
            `reset.concurrent.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        await registerAndLogin(
          userData
        );

        const user =
          await User.findOne({
            where: {
              email:
                userData.email,
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

        user.passwordResetTokenHash =
          hashToken(
            rawToken
          );

        user.passwordResetExpires =
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
                '/api/v1/auth/reset-password'
              )
              .send({
                token:
                  rawToken,

                password:
                  'ConcurrentPass2',
              }),

            request(app)
              .post(
                '/api/v1/auth/reset-password'
              )
              .send({
                token:
                  rawToken,

                password:
                  'ConcurrentPass3',
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

        const firstLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                userData.email,

              password:
                'ConcurrentPass2',
            });

        const secondLogin =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send({
              email:
                userData.email,

              password:
                'ConcurrentPass3',
            });

        expect(
          [
            firstLogin.statusCode,
            secondLogin.statusCode,
          ].sort(
            (a, b) =>
              a - b
          )
        ).toEqual([
          200,
          401,
        ]);
      }
    );
  }
);