const request =
  require('supertest');

const app =
  require('../../src/app');

const {
  sequelize,
} =
  require('../../src/config/db');

const {
  User,
  AuditLog,
} =
  require('../../src/database/models');

const {
  sanitizeValue,
} =
  require('../../src/modules/audit/audit.service');

const stamp =
  Date.now();

const admin = {
  name:
    'Audit Admin',

  email:
    `audit.admin.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const member = {
  name:
    'Audit Member',

  email:
    `audit.member.${stamp}@example.com`,

  password:
    'StrongPass1',
};

let adminToken;
let memberToken;
let memberUser;

let createdBookId;

const registerAndLogin =
  async (
    credentials
  ) => {
    const register =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          credentials
        );

    expect(
      register.statusCode
    ).toBe(201);

    const login =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(
          credentials
        );

    expect(
      login.statusCode
    ).toBe(200);

    return login.body
      .data.accessToken;
  };

const waitForAudit =
  async (
    where,
    timeoutMs = 1500
  ) => {
    const started =
      Date.now();

    while (
      Date.now() -
        started <
      timeoutMs
    ) {
      const log =
        await AuditLog.findOne({
          where,
        });

      if (log) {
        return log;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            25
          )
      );
    }

    return null;
  };

beforeAll(
  async () => {
    await sequelize.sync({
      force:
        true,
    });

    memberToken =
      await registerAndLogin(
        member
      );

    memberUser =
      await User.findOne({
        where: {
          email:
            member.email,
        },
      });

    await request(app)
      .post(
        '/api/v1/auth/register'
      )
      .send(
        admin
      );

    await User.update(
      {
        role:
          'admin',
      },

      {
        where: {
          email:
            admin.email,
        },
      }
    );

    const adminLogin =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(
          admin
        );

    expect(
      adminLogin.statusCode
    ).toBe(200);

    adminToken =
      adminLogin.body
        .data.accessToken;
  }
);

describe(
  'Part 11 - Audit trail',
  () => {
    it(
      'removes sensitive values from audit metadata recursively',
      () => {
        const sanitized =
          sanitizeValue({
            title:
              'Safe value',

            password:
              'Password123',

            accessToken:
              'access-secret',

            nested: {
              refreshToken:
                'refresh-secret',

              authorization:
                'Bearer secret',

              cookie:
                'session=secret',

              signature:
                'payment-signature',

              apiSecret:
                'api-secret',

              safe:
                'keep-me',
            },

            items: [
              {
                token:
                  'array-secret',

                value:
                  'visible',
              },
            ],
          });

        expect(
          sanitized
        ).toEqual({
          title:
            'Safe value',

          nested: {
            safe:
              'keep-me',
          },

          items: [
            {
              value:
                'visible',
            },
          ],
        });
      }
    );

    it(
      'does not allow a normal member to view audit logs',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/audit'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            );

        expect(
          res.statusCode
        ).toBe(403);
      }
    );

    it(
      'records a successful admin book creation',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/books'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              isbn:
                '9786000000001',

              title:
                'Audit Trail Test Book',
            });

        expect(
          res.statusCode
        ).toBe(201);

        createdBookId =
          res.body.data.id;

        expect(
          createdBookId
        ).toBeDefined();

        const log =
          await waitForAudit({
            action:
              'BOOK_CREATED',

            entityId:
              createdBookId,
          });

        expect(
          log
        ).not.toBeNull();

        expect(
          log.entity
        ).toBe(
          'book'
        );

        const actor =
          await User.findOne({
            where: {
              email:
                admin.email,
            },
          });

        expect(
          log.actorId
        ).toBe(
          actor.id
        );

        expect(
          log.metadataJson
            .statusCode
        ).toBe(201);
      }
    );

    it(
      'records a successful book update',
      async () => {
        const res =
          await request(app)
            .put(
              `/api/v1/books/${createdBookId}`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              title:
                'Audit Trail Test Book Revised',
            });

        expect(
          res.statusCode
        ).toBe(200);

        const log =
          await waitForAudit({
            action:
              'BOOK_UPDATED',

            entityId:
              createdBookId,
          });

        expect(
          log
        ).not.toBeNull();

        expect(
          log.metadataJson
            .request
            .body
            .title
        ).toBe(
          'Audit Trail Test Book Revised'
        );
      }
    );

    it(
      'does not record failed staff operations',
      async () => {
        const before =
          await AuditLog.count();

        const res =
          await request(app)
            .post(
              '/api/v1/books'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              isbn:
                '9786000000001',

              title:
                'Duplicate ISBN',
            });

        expect(
          res.statusCode
        ).toBe(409);

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              75
            )
        );

        const after =
          await AuditLog.count();

        expect(
          after
        ).toBe(
          before
        );
      }
    );

    it(
      'records adding physical copies',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/borrow/copies'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              bookId:
                createdBookId,

              quantity:
                2,

              shelfLocation:
                'AUDIT-A1',
            });

        expect(
          res.statusCode
        ).toBe(201);

        const log =
          await waitForAudit({
            action:
              'COPIES_ADDED',

            entityId:
              createdBookId,
          });

        expect(
          log
        ).not.toBeNull();

        expect(
          log.metadataJson
            .request
            .body
            .quantity
        ).toBe(2);
      }
    );

    it(
      'records member suspension through the members endpoint',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/members/${memberUser.id}/status`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              membershipStatus:
                'suspended',
            });

        expect(
          res.statusCode
        ).toBe(200);

        const log =
          await waitForAudit({
            action:
              'MEMBERSHIP_SUSPENDED',

            entityId:
              memberUser.id,
          });

        expect(
          log
        ).not.toBeNull();

        expect(
          log.entity
        ).toBe(
          'user'
        );

        expect(
          log.metadataJson
            .request
            .body
            .membershipStatus
        ).toBe(
          'suspended'
        );

        expect(
          log.metadataJson
            .path
        ).toBe(
          `/api/v1/members/${memberUser.id}/status`
        );
      }
    );

    it(
      'records member reactivation through the members endpoint',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/members/${memberUser.id}/status`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              membershipStatus:
                'active',
            });

        expect(
          res.statusCode
        ).toBe(200);

        const log =
          await waitForAudit({
            action:
              'MEMBERSHIP_ACTIVATED',

            entityId:
              memberUser.id,
          });

        expect(
          log
        ).not.toBeNull();

        expect(
          log.entity
        ).toBe(
          'user'
        );
      }
    );

    it(
      'lets admin list audit logs with pagination',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/audit?page=1&limit=10'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          Array.isArray(
            res.body.data
              .logs
          )
        ).toBe(true);

        expect(
          res.body.data
            .logs.length
        ).toBeGreaterThan(
          0
        );

        expect(
          res.body.data
            .meta.page
        ).toBe(1);

        expect(
          res.body.data
            .meta.limit
        ).toBe(10);

        expect(
          res.body.data
            .meta
        ).toHaveProperty(
          'total'
        );

        expect(
          res.body.data
            .meta
        ).toHaveProperty(
          'totalPages'
        );
      }
    );

    it(
      'filters audit logs by action',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/audit?action=BOOK_CREATED'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
            .logs.length
        ).toBeGreaterThan(
          0
        );

        expect(
          res.body.data
            .logs.every(
              (log) =>
                log.action ===
                'BOOK_CREATED'
            )
        ).toBe(true);
      }
    );

    it(
      'records successful soft deletion of a book',
      async () => {
        const res =
          await request(app)
            .delete(
              `/api/v1/books/${createdBookId}`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        const log =
          await waitForAudit({
            action:
              'BOOK_DELETED',

            entityId:
              createdBookId,
          });

        expect(
          log
        ).not.toBeNull();
      }
    );
  }
);