const request =
  require('supertest');

const app =
  require('../../src/app');

const {
  sequelize,
  User,
} = require('../../src/database/models');

const stamp =
  Date.now();

const testUser = {
  name:
    'Concurrent Login User',

  email:
    `auth.concurrent.${stamp}@example.com`,

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
  'Concurrent login failure tracking',
  () => {
    it(
      'does not lose simultaneous failed login attempts',
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

        user.failedLoginAttempts =
          3;

        user.lockedUntil =
          null;

        await user.save();

        const [
          first,
          second,
        ] =
          await Promise.all([
            request(app)
              .post(
                '/api/v1/auth/login'
              )
              .send({
                email:
                  testUser.email,

                password:
                  'WrongPass1',
              }),

            request(app)
              .post(
                '/api/v1/auth/login'
              )
              .send({
                email:
                  testUser.email,

                password:
                  'WrongPass1',
              }),
          ]);

        expect(
          [
            401,
            403,
          ]
        ).toContain(
          first.statusCode
        );

        expect(
          [
            401,
            403,
          ]
        ).toContain(
          second.statusCode
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
        ).not.toBeNull();

        expect(
          updated.lockedUntil
        ).not.toBeNull();

        expect(
          new Date(
            updated.lockedUntil
          ).getTime()
        ).toBeGreaterThan(
          Date.now()
        );

        expect(
          updated.failedLoginAttempts
        ).toBe(0);

        const blocked =
          await request(app)
            .post(
              '/api/v1/auth/login'
            )
            .send(
              testUser
            );

        expect(
          blocked.statusCode
        ).toBe(403);

        expect(
          blocked.body.message
        ).toMatch(
          /temporarily locked/i
        );
      }
    );
  }
);