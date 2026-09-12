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

        expect(
          res.headers[
            'set-cookie'
          ]
        ).toBeDefined();

        expect(
          res.headers[
            'set-cookie'
          ][0]
        ).toMatch(
          /lms_refresh_token/
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

        expect(
          res.headers[
            'set-cookie'
          ]
        ).toBeDefined();

        expect(
          res.headers[
            'set-cookie'
          ][0]
        ).toMatch(
          /lms_refresh_token/
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