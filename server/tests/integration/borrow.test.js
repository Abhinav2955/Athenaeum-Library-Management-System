const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
} = require('../../src/config/db');

const {
  User,
  Notification,
} = require('../../src/database/models');

let adminToken;
let member1Token;
let member2Token;
let bookId;
let borrowRecordId;
let member1Id;

const stamp = Date.now();

const admin = {
  name: 'Admin2',
  email:
    `admin2.${stamp}@example.com`,
  password:
    'StrongPass1',
};

const member1 = {
  name: 'Member1',
  email:
    `m1.${stamp}@example.com`,
  password:
    'StrongPass1',
};

const member2 = {
  name: 'Member2',
  email:
    `m2.${stamp}@example.com`,
  password:
    'StrongPass1',
};

const registerAndLogin =
  async (credentials) => {
    await request(app)
      .post(
        '/api/v1/auth/register'
      )
      .send(credentials);

    const response =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(credentials);

    return response.body.data
      .accessToken;
  };

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  member1Token =
    await registerAndLogin(
      member1
    );

  member2Token =
    await registerAndLogin(
      member2
    );

  adminToken =
    await registerAndLogin(
      admin
    );

  await User.update(
    {
      role: 'admin',
    },
    {
      where: {
        email:
          admin.email,
      },
    }
  );

  adminToken =
    await registerAndLogin(
      admin
    );

  const member1User =
    await User.findOne({
      where: {
        email:
          member1.email,
      },
    });

  member1Id =
    member1User.id;

  const bookResponse =
    await request(app)
      .post('/api/v1/books')
      .set(
        'Authorization',
        `Bearer ${adminToken}`
      )
      .send({
        isbn:
          '9781111111111',

        title:
          'Designing Data-Intensive Applications',

        totalCopies: 0,
      });

  bookId =
    bookResponse.body.data.id;

  await request(app)
    .post(
      '/api/v1/borrow/copies'
    )
    .set(
      'Authorization',
      `Bearer ${adminToken}`
    )
    .send({
      bookId,
      quantity: 1,
    });
});

describe(
  'Borrow module',
  () => {
    it(
      'checks out the only available copy to member1',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${member1Token}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(201);

        expect(
          response.body.data.status
        ).toBe('active');

        borrowRecordId =
          response.body.data.id;

        const notification =
          await Notification.findOne({
            where: {
              userId:
                member1Id,

              type:
                'book_checked_out',

              borrowRecordId,
            },
          });

        expect(
          notification
        ).not.toBeNull();

        expect(
          notification.userId
        ).toBe(member1Id);

        expect(
          notification.type
        ).toBe(
          'book_checked_out'
        );

        expect(
          notification.borrowRecordId
        ).toBe(
          borrowRecordId
        );

        expect(
          notification.message
        ).toContain(
          'Designing Data-Intensive Applications'
        );
      }
    );

    it(
      'rejects a second concurrent checkout of the same unavailable book',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(409);

        expect(
          response.body.message
        ).toMatch(
          /no available copies/i
        );
      }
    );

    it(
      'prevents the same member from double-borrowing the same book',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${member1Token}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(409);
      }
    );

    it(
      'lets the member view their own loans',
      async () => {
        const response =
          await request(app)
            .get(
              '/api/v1/borrow/me'
            )
            .set(
              'Authorization',
              `Bearer ${member1Token}`
            );

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.body.data
            .records.length
        ).toBe(1);
      }
    );

    it(
      'allows the member to renew their loan',
      async () => {
        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${borrowRecordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${member1Token}`
            );

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.body.data
            .renewedCount
        ).toBe(1);
      }
    );

    it(
      'prevents a different member from renewing someone else\'s loan',
      async () => {
        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${borrowRecordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            );

        expect(
          response.statusCode
        ).toBe(403);
      }
    );

    it(
      'lets staff mark the book returned, freeing the copy',
      async () => {
        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${borrowRecordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.body.data.status
        ).toBe('returned');
      }
    );

    it(
      'lets member2 check out the now-available copy',
      async () => {
        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(201);
      }
    );
  }
);