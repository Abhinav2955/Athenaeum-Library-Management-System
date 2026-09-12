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
  RefreshToken,
  AuditLog,
} =
  require('../../src/database/models');

const stamp =
  Date.now();

const admin = {
  name:
    'Users Admin',

  email:
    `users.admin.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const librarian = {
  name:
    'Users Librarian',

  email:
    `users.librarian.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const member = {
  name:
    'Users Member',

  email:
    `users.member.${stamp}@example.com`,

  password:
    'StrongPass1',
};

let adminToken;
let librarianToken;
let memberToken;

let adminUser;
let librarianUser;
let memberUser;

const register =
  async (
    credentials
  ) => {
    const res =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          credentials
        );

    expect(
      res.statusCode
    ).toBe(201);
  };

const login =
  async (
    credentials
  ) => {
    const res =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(
          credentials
        );

    expect(
      res.statusCode
    ).toBe(200);

    return res.body
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

    await register(
      admin
    );

    await register(
      librarian
    );

    await register(
      member
    );

    adminUser =
      await User.findOne({
        where: {
          email:
            admin.email,
        },
      });

    librarianUser =
      await User.findOne({
        where: {
          email:
            librarian.email,
        },
      });

    memberUser =
      await User.findOne({
        where: {
          email:
            member.email,
        },
      });

    await adminUser.update({
      role:
        'admin',
    });

    await librarianUser.update({
      role:
        'librarian',
    });

    adminToken =
      await login(
        admin
      );

    librarianToken =
      await login(
        librarian
      );

    memberToken =
      await login(
        member
      );
  }
);

describe(
  'Part 12 - User management',
  () => {
    it(
      'blocks normal members from listing users',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/users'
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
      'lets staff list users',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/users'
            )
            .set(
              'Authorization',
              `Bearer ${librarianToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          Array.isArray(
            res.body.data
              .users
          )
        ).toBe(true);

        expect(
          res.body.data
            .users.length
        ).toBeGreaterThanOrEqual(
          3
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
      'searches users by email',
      async () => {
        const res =
          await request(app)
            .get(
              `/api/v1/users?search=${encodeURIComponent(
                member.email
              )}`
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
            .users.some(
              (user) =>
                user.email ===
                member.email
            )
        ).toBe(true);
      }
    );

    it(
      'lets a librarian suspend a member',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/users/${memberUser.id}/membership`
            )
            .set(
              'Authorization',
              `Bearer ${librarianToken}`
            )
            .send({
              membershipStatus:
                'suspended',
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
            .membershipStatus
        ).toBe(
          'suspended'
        );

        const refreshed =
          await User.findByPk(
            memberUser.id
          );

        expect(
          refreshed
            .membershipStatus
        ).toBe(
          'suspended'
        );

        const activeRefreshTokens =
          await RefreshToken.count({
            where: {
              userId:
                memberUser.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeRefreshTokens
        ).toBe(0);

        const audit =
          await waitForAudit({
            action:
              'MEMBERSHIP_SUSPENDED',

            entityId:
              memberUser.id,
          });

        expect(
          audit
        ).not.toBeNull();
      }
    );

    it(
      'blocks a suspended member from protected routes',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/auth/me'
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
      'lets staff reactivate the member',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/users/${memberUser.id}/membership`
            )
            .set(
              'Authorization',
              `Bearer ${librarianToken}`
            )
            .send({
              membershipStatus:
                'active',
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
            .membershipStatus
        ).toBe(
          'active'
        );

        const audit =
          await waitForAudit({
            action:
              'MEMBERSHIP_ACTIVATED',

            entityId:
              memberUser.id,
          });

        expect(
          audit
        ).not.toBeNull();
      }
    );

    it(
      'does not let a librarian change roles',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/users/${memberUser.id}/role`
            )
            .set(
              'Authorization',
              `Bearer ${librarianToken}`
            )
            .send({
              role:
                'librarian',
            });

        expect(
          res.statusCode
        ).toBe(403);
      }
    );

    it(
      'lets an admin promote a member to librarian',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/users/${memberUser.id}/role`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              role:
                'librarian',
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.role
        ).toBe(
          'librarian'
        );

        const audit =
          await waitForAudit({
            action:
              'USER_ROLE_CHANGED',

            entityId:
              memberUser.id,
          });

        expect(
          audit
        ).not.toBeNull();

        expect(
          audit.metadataJson
            .request
            .body
            .role
        ).toBe(
          'librarian'
        );
      }
    );

    it(
      'prevents an admin from changing their own role',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/users/${adminUser.id}/role`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              role:
                'member',
            });

        expect(
          res.statusCode
        ).toBe(400);

        const refreshed =
          await User.findByPk(
            adminUser.id
          );

        expect(
          refreshed.role
        ).toBe(
          'admin'
        );
      }
    );

    it(
      'prevents staff from changing their own membership status',
      async () => {
        const res =
          await request(app)
            .patch(
              `/api/v1/users/${librarianUser.id}/membership`
            )
            .set(
              'Authorization',
              `Bearer ${librarianToken}`
            )
            .send({
              membershipStatus:
                'suspended',
            });

        expect(
          res.statusCode
        ).toBe(400);

        const refreshed =
          await User.findByPk(
            librarianUser.id
          );

        expect(
          refreshed
            .membershipStatus
        ).toBe(
          'active'
        );
      }
    );

    it(
      'filters users by role and membership status',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/users?role=librarian&membershipStatus=active'
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
            .users.every(
              (user) =>
                user.role ===
                  'librarian' &&
                user.membershipStatus ===
                  'active'
            )
        ).toBe(true);
      }
    );
  }
);