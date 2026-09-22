const request =
  require('supertest');

const crypto =
  require('crypto');

const app =
  require('../../src/app');

const {
  sequelize,
} = require('../../src/database/models');

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
    });
  }
);

describe(
  'Auth token validation',
  () => {
    it(
      'rejects a verification token shorter than 64 hexadecimal characters',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                'a'.repeat(63),
            });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );

    it(
      'rejects a verification token longer than 64 hexadecimal characters',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                'a'.repeat(65),
            });

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    it(
      'rejects a verification token containing non-hexadecimal characters',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token:
                'z'.repeat(64),
            });

        expect(
          response.statusCode
        ).toBe(400);
      }
    );

    it(
      'allows a correctly formatted verification token to reach token lookup',
      async () => {
        const token =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        const response =
          await request(app)
            .post(
              '/api/v1/auth/verify-email'
            )
            .send({
              token,
            });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /invalid|expired/i
        );
      }
    );

    it(
      'rejects a malformed password-reset token',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/auth/reset-password'
            )
            .send({
              token:
                'not-a-valid-reset-token',

              password:
                'NewStrongPass1',
            });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.success
        ).toBe(false);
      }
    );

    it(
      'allows a correctly formatted reset token to reach token lookup',
      async () => {
        const token =
          crypto
            .randomBytes(32)
            .toString(
              'hex'
            );

        const response =
          await request(app)
            .post(
              '/api/v1/auth/reset-password'
            )
            .send({
              token,

              password:
                'NewStrongPass1',
            });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /invalid|expired/i
        );
      }
    );
  }
);