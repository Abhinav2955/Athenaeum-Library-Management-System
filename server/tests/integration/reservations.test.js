const { Op } = require('sequelize');

const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
} = require('../../src/config/db');

const {
  User,
  Notification,
  Reservation,
  BorrowRecord,
} = require(
  '../../src/database/models'
);

let adminToken;

let m1Token;
let m2Token;
let m3Token;

let m2Id;

let bookId;

const stamp = Date.now();

const admin = {
  name: 'AdminR',
  email:
    `adminr.${stamp}@example.com`,
  password: 'StrongPass1',
};

const m1 = {
  name: 'R1',
  email:
    `r1.${stamp}@example.com`,
  password: 'StrongPass1',
};

const m2 = {
  name: 'R2',
  email:
    `r2.${stamp}@example.com`,
  password: 'StrongPass1',
};

const m3 = {
  name: 'R3',
  email:
    `r3.${stamp}@example.com`,
  password: 'StrongPass1',
};

const registerAndLogin =
  async (creds) => {
    await request(app)
      .post('/api/v1/auth/register')
      .send(creds);

    const res =
      await request(app)
        .post('/api/v1/auth/login')
        .send(creds);

    return res.body.data
      .accessToken;
  };

const createUnavailableBook =
  async (
    isbn,
    title,
    borrowerToken
  ) => {
    const bookRes =
      await request(app)
        .post('/api/v1/books')
        .set(
          'Authorization',
          `Bearer ${adminToken}`
        )
        .send({
          isbn,
          title,
          totalCopies: 0,
        });

    expect(
      bookRes.statusCode
    ).toBe(201);

    const id =
      bookRes.body.data.id;

    const copiesRes =
      await request(app)
        .post(
          '/api/v1/borrow/copies'
        )
        .set(
          'Authorization',
          `Bearer ${adminToken}`
        )
        .send({
          bookId: id,
          quantity: 1,
        });

    expect(
      copiesRes.statusCode
    ).toBe(201);

    const checkoutRes =
      await request(app)
        .post(
          '/api/v1/borrow/checkout'
        )
        .set(
          'Authorization',
          `Bearer ${borrowerToken}`
        )
        .send({
          bookId: id,
        });

    expect(
      checkoutRes.statusCode
    ).toBe(201);

    return id;
  };

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  m1Token =
    await registerAndLogin(
      m1
    );

  m2Token =
    await registerAndLogin(
      m2
    );

  m3Token =
    await registerAndLogin(
      m3
    );

  const m2User =
    await User.findOne({
      where: {
        email:
          m2.email,
      },
    });

  expect(
    m2User
  ).not.toBeNull();

  m2Id =
    m2User.id;

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

  const bookRes =
    await request(app)
      .post('/api/v1/books')
      .set(
        'Authorization',
        `Bearer ${adminToken}`
      )
      .send({
        isbn:
          '9782222222222',

        title:
          'The Pragmatic Programmer',

        totalCopies: 0,
      });

  expect(
    bookRes.statusCode
  ).toBe(201);

  bookId =
    bookRes.body.data.id;

  const copiesRes =
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

  expect(
    copiesRes.statusCode
  ).toBe(201);

  const checkoutRes =
    await request(app)
      .post(
        '/api/v1/borrow/checkout'
      )
      .set(
        'Authorization',
        `Bearer ${m1Token}`
      )
      .send({
        bookId,
      });

  expect(
    checkoutRes.statusCode
  ).toBe(201);
});

describe(
  'Reservation queue',
  () => {
    it(
      'lets m2 reserve the unavailable book, at position 1',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${m2Token}`
            )
            .send({
              bookId,
            });

        expect(
          res.statusCode
        ).toBe(201);

        expect(
          res.body.data.status
        ).toBe(
          'waiting'
        );
      }
    );

    it(
      'lets m3 reserve behind m2, at position 2',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${m3Token}`
            )
            .send({
              bookId,
            });

        expect(
          res.statusCode
        ).toBe(201);

        const listRes =
          await request(app)
            .get(
              '/api/v1/reservations/me'
            )
            .set(
              'Authorization',
              `Bearer ${m3Token}`
            );

        expect(
          listRes.statusCode
        ).toBe(200);

        expect(
          listRes.body.data
            .reservations[0]
            .queuePosition
        ).toBe(2);
      }
    );

    it(
      'rejects a duplicate reservation from the same member',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${m2Token}`
            )
            .send({
              bookId,
            });

        expect(
          res.statusCode
        ).toBe(409);
      }
    );

    it(
      'prevents simultaneous duplicate reservations from the same member',
      async () => {
        const borrowerCredentials = {
          name:
            'Reservation Lock Borrower',

          email:
            `reservation.lock.borrower.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const reserverCredentials = {
          name:
            'Reservation Lock Member',

          email:
            `reservation.lock.member.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const borrowerToken =
          await registerAndLogin(
            borrowerCredentials
          );

        const reserverToken =
          await registerAndLogin(
            reserverCredentials
          );

        const reserver =
          await User.findOne({
            where: {
              email:
                reserverCredentials.email,
            },
          });

        expect(
          reserver
        ).not.toBeNull();

        const concurrentBookId =
          await createUnavailableBook(
            '9782222222239',
            'Concurrent Reservation Test',
            borrowerToken
          );

        const responses =
          await Promise.all([
            request(app)
              .post(
                '/api/v1/reservations'
              )
              .set(
                'Authorization',
                `Bearer ${reserverToken}`
              )
              .send({
                bookId:
                  concurrentBookId,
              }),

            request(app)
              .post(
                '/api/v1/reservations'
              )
              .set(
                'Authorization',
                `Bearer ${reserverToken}`
              )
              .send({
                bookId:
                  concurrentBookId,
              }),
          ]);

        const statusCodes =
          responses
            .map(
              (response) =>
                response.statusCode
            )
            .sort();

        expect(
          statusCodes
        ).toEqual([
          201,
          409,
        ]);

        const rejected =
          responses.find(
            (response) =>
              response.statusCode ===
              409
          );

        expect(
          rejected.body.message
        ).toMatch(
          /already.*active reservation/i
        );

        const activeReservations =
          await Reservation.count({
            where: {
              userId:
                reserver.id,

              bookId:
                concurrentBookId,

              status: {
                [Op.in]: [
                  'waiting',
                  'ready',
                ],
              },
            },
          });

        expect(
          activeReservations
        ).toBe(1);
      }
    );

    it(
      'serializes reservation creation against renewal for the same book',
      async () => {
        const borrowerCredentials = {
          name:
            'Reservation Renewal Race Borrower',

          email:
            `reservation.renew.race.borrower.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const reserverCredentials = {
          name:
            'Reservation Renewal Race Member',

          email:
            `reservation.renew.race.member.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const borrowerToken =
          await registerAndLogin(
            borrowerCredentials
          );

        const reserverToken =
          await registerAndLogin(
            reserverCredentials
          );

        const raceBookId =
          await createUnavailableBook(
            '9782222222246',
            'Reservation Renewal Race Test',
            borrowerToken
          );

        const loans =
          await request(app)
            .get(
              '/api/v1/borrow/me'
            )
            .set(
              'Authorization',
              `Bearer ${borrowerToken}`
            );

        expect(
          loans.statusCode
        ).toBe(200);

        const record =
          loans.body.data
            .records.find(
              (loan) =>
                loan.copy.bookId ===
                raceBookId
            );

        expect(
          record
        ).toBeDefined();

        const reservationPromise =
          request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${reserverToken}`
            )
            .send({
              bookId:
                raceBookId,
            });

        const renewalPromise =
          request(app)
            .post(
              `/api/v1/borrow/${record.id}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${borrowerToken}`
            );

        const [
          reservationResponse,
          renewalResponse,
        ] =
          await Promise.all([
            reservationPromise,
            renewalPromise,
          ]);

        expect(
          reservationResponse
            .statusCode
        ).toBe(201);

        expect(
          [
            200,
            400,
          ]
        ).toContain(
          renewalResponse.statusCode
        );

        if (
          renewalResponse.statusCode ===
          400
        ) {
          expect(
            renewalResponse.body
              .message
          ).toMatch(
            /reservation/i
          );
        }

        const reservations =
          await Reservation.count({
            where: {
              bookId:
                raceBookId,

              status: {
                [Op.in]: [
                  'waiting',
                  'ready',
                ],
              },
            },
          });

        expect(
          reservations
        ).toBe(1);

        const finalRecord =
          await BorrowRecord.findByPk(
            record.id
          );

        expect(
          finalRecord
        ).not.toBeNull();

        if (
          renewalResponse.statusCode ===
          400
        ) {
          expect(
            finalRecord.renewedCount
          ).toBe(0);
        }

        if (
          renewalResponse.statusCode ===
          200
        ) {
          expect(
            finalRecord.renewedCount
          ).toBe(1);
        }
      }
    );

    it(
      'blocks m1 from renewing while a queue exists',
      async () => {
        const loans =
          await request(app)
            .get(
              '/api/v1/borrow/me'
            )
            .set(
              'Authorization',
              `Bearer ${m1Token}`
            );

        expect(
          loans.statusCode
        ).toBe(200);

        const recordId =
          loans.body.data
            .records[0].id;

        const res =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${m1Token}`
            );

        expect(
          res.statusCode
        ).toBe(400);
      }
    );

    it(
      'cascades the returned copy to m2 and persists a reservation-ready notification',
      async () => {
        const loans =
          await request(app)
            .get(
              '/api/v1/borrow/me'
            )
            .set(
              'Authorization',
              `Bearer ${m1Token}`
            );

        expect(
          loans.statusCode
        ).toBe(200);

        const recordId =
          loans.body.data
            .records[0].id;

        const returnRes =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          returnRes.statusCode
        ).toBe(200);

        const m3Attempt =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${m3Token}`
            )
            .send({
              bookId,
            });

        expect(
          m3Attempt.statusCode
        ).toBe(409);

        const m2List =
          await request(app)
            .get(
              '/api/v1/reservations/me'
            )
            .set(
              'Authorization',
              `Bearer ${m2Token}`
            );

        expect(
          m2List.statusCode
        ).toBe(200);

        expect(
          m2List.body.data
            .reservations[0]
            .status
        ).toBe(
          'ready'
        );

        const notification =
          await Notification.findOne({
            where: {
              userId:
                m2Id,

              type:
                'reservation_ready',
            },

            order: [
              [
                'createdAt',
                'DESC',
              ],
            ],
          });

        expect(
          notification
        ).not.toBeNull();

        expect(
          notification.userId
        ).toBe(
          m2Id
        );

        expect(
          notification.type
        ).toBe(
          'reservation_ready'
        );

        expect(
          notification.message
        ).toMatch(
          /ready|pickup|collect/i
        );
      }
    );

    it(
      'lets m2 check out their held copy directly',
      async () => {
        const res =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${m2Token}`
            )
            .send({
              bookId,
            });

        expect(
          res.statusCode
        ).toBe(201);
      }
    );

    it(
      'lets m3 cancel their reservation',
      async () => {
        const list =
          await request(app)
            .get(
              '/api/v1/reservations/me'
            )
            .set(
              'Authorization',
              `Bearer ${m3Token}`
            );

        expect(
          list.statusCode
        ).toBe(200);

        const reservationId =
          list.body.data
            .reservations[0].id;

        const res =
          await request(app)
            .post(
              `/api/v1/reservations/${reservationId}/cancel`
            )
            .set(
              'Authorization',
              `Bearer ${m3Token}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.status
        ).toBe(
          'cancelled'
        );
      }
    );
  }
);