const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
  User,
  Reservation,
  BorrowRecord,
  BookCopy,
} = require('../../src/database/models');

const stamp = Date.now();

const registerAndLogin =
  async (credentials) => {
    await request(app)
      .post('/api/v1/auth/register')
      .send(credentials);

    const response =
      await request(app)
        .post('/api/v1/auth/login')
        .send(credentials);

    return response.body.data
      .accessToken;
  };

describe(
  'Expired reservation checkout',
  () => {
    let adminToken;
    let borrowerToken;
    let reserverToken;

    beforeAll(async () => {
      await sequelize.sync({
        force: true,
      });

      const admin = {
        name:
          'Expired Hold Admin',

        email:
          `expired.hold.admin.${stamp}@example.com`,

        password:
          'StrongPass1',
      };

      const borrower = {
        name:
          'Expired Hold Borrower',

        email:
          `expired.hold.borrower.${stamp}@example.com`,

        password:
          'StrongPass1',
      };

      const reserver = {
        name:
          'Expired Hold Reserver',

        email:
          `expired.hold.reserver.${stamp}@example.com`,

        password:
          'StrongPass1',
      };

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

      borrowerToken =
        await registerAndLogin(
          borrower
        );

      reserverToken =
        await registerAndLogin(
          reserver
        );
    });

    it(
      'does not allow checkout after a ready hold has expired',
      async () => {
        const bookResponse =
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
                '9785555555501',

              title:
                'Expired Hold Checkout Test',

              totalCopies: 0,
            });

        expect(
          bookResponse.statusCode
        ).toBe(201);

        const bookId =
          bookResponse.body
            .data.id;

        const copiesResponse =
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
          copiesResponse.statusCode
        ).toBe(201);

        const borrowerCheckout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${borrowerToken}`
            )
            .send({
              bookId,
            });

        expect(
          borrowerCheckout.statusCode
        ).toBe(201);

        const reservationResponse =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${reserverToken}`
            )
            .send({
              bookId,
            });

        expect(
          reservationResponse.statusCode
        ).toBe(201);

        const returnResponse =
          await request(app)
            .post(
              `/api/v1/borrow/${borrowerCheckout.body.data.id}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          returnResponse.statusCode
        ).toBe(200);

        const reservation =
          await Reservation.findOne({
            where: {
              bookId,
              status:
                'ready',
            },
          });

        expect(
          reservation
        ).not.toBeNull();

        expect(
          reservation.copyId
        ).not.toBeNull();

        await reservation.update({
          expiresAt:
            new Date(
              Date.now() -
                60 * 1000
            ),
        });

        const activeBefore =
          await BorrowRecord.count({
            where: {
              userId:
                reservation.userId,

              status:
                'active',
            },
          });

        expect(
          activeBefore
        ).toBe(0);

        const checkoutResponse =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${reserverToken}`
            )
            .send({
              bookId,
            });

        expect(
          checkoutResponse.statusCode
        ).toBe(409);

        expect(
          checkoutResponse.body.message
        ).toMatch(
          /no available copies/i
        );

        const refreshedReservation =
          await Reservation.findByPk(
            reservation.id
          );

        expect(
          refreshedReservation.status
        ).toBe(
          'ready'
        );

        const activeAfter =
          await BorrowRecord.count({
            where: {
              userId:
                reservation.userId,

              status:
                'active',
            },
          });

        expect(
          activeAfter
        ).toBe(0);

        const copy =
          await BookCopy.findByPk(
            reservation.copyId
          );

        expect(
          copy.status
        ).toBe(
          'reserved'
        );

        expect(
          copy.reservedForUserId
        ).toBe(
          reservation.userId
        );
      }
    );
  }
);