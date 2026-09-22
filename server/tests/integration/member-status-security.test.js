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
} =
  require('../../src/database/models');

const stamp =
  Date.now();

const librarian = {
  name:
    'Member Status Librarian',

  email:
    `member.status.librarian.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const member = {
  name:
    'Member Status User',

  email:
    `member.status.user.${stamp}@example.com`,

  password:
    'StrongPass1',
};

let librarianToken;
let memberToken;
let librarianUser;
let memberUser;

const register =
  async (
    credentials
  ) => {
    const response =
      await request(app)
        .post(
          '/api/v1/auth/register'
        )
        .send(
          credentials
        );

    expect(
      response.statusCode
    ).toBe(201);
  };

const login =
  async (
    credentials
  ) => {
    const response =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(
          credentials
        );

    expect(
      response.statusCode
    ).toBe(200);

    return response.body
      .data.accessToken;
  };

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
    });

    await register(
      librarian
    );

    await register(
      member
    );

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

    await librarianUser.update({
      role:
        'librarian',
    });

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
  'Member status security',
  () => {
    it(
      'revokes active sessions when staff suspends a member through the members endpoint',
      async () => {
        const activeBefore =
          await RefreshToken.count({
            where: {
              userId:
                memberUser.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeBefore
        ).toBeGreaterThan(0);

        const response =
          await request(app)
            .patch(
              `/api/v1/members/${memberUser.id}/status`
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
          response.statusCode
        ).toBe(200);

        expect(
          response.body.data
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

        const activeAfter =
          await RefreshToken.count({
            where: {
              userId:
                memberUser.id,

              revokedAt:
                null,
            },
          });

        expect(
          activeAfter
        ).toBe(0);
      }
    );

    it(
      'rejects the suspended member existing access token',
      async () => {
        const response =
          await request(app)
            .get(
              '/api/v1/auth/me'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            );

        expect(
          response.statusCode
        ).toBe(403);
      }
    );

    it(
      'allows staff to reactivate the member through the members endpoint',
      async () => {
        const response =
          await request(app)
            .patch(
              `/api/v1/members/${memberUser.id}/status`
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
          response.statusCode
        ).toBe(200);

        const refreshed =
          await User.findByPk(
            memberUser.id
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
      'prevents staff from changing their own membership through the members endpoint',
      async () => {
        const response =
          await request(app)
            .patch(
              `/api/v1/members/${librarianUser.id}/status`
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
          response.statusCode
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
  }
);