const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
  User,
  Book,
  BookCopy,
  Reservation,
} = require('../../src/database/models');

const reservationService = require(
  '../../src/modules/reservations/reservation.service'
);

let adminToken;
let member1Token;
let member2Token;
let member3Token;

const stamp = Date.now();

const admin = {
  name: 'Inventory Admin',
  email: `inventory.admin.${stamp}@example.com`,
  password: 'StrongPass1',
};

const member1 = {
  name: 'Inventory Member One',
  email: `inventory.member1.${stamp}@example.com`,
  password: 'StrongPass1',
};

const member2 = {
  name: 'Inventory Member Two',
  email: `inventory.member2.${stamp}@example.com`,
  password: 'StrongPass1',
};

const member3 = {
  name: 'Inventory Member Three',
  email: `inventory.member3.${stamp}@example.com`,
  password: 'StrongPass1',
};

const registerAndLogin = async (credentials) => {
  await request(app)
    .post('/api/v1/auth/register')
    .send(credentials);

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send(credentials);

  return response.body.data.accessToken;
};

const createBook = async ({
  isbn,
  title,
  copies = 1,
}) => {
  const bookResponse = await request(app)
    .post('/api/v1/books')
    .set(
      'Authorization',
      `Bearer ${adminToken}`
    )
    .send({
      isbn,
      title,
    });

  expect(bookResponse.statusCode).toBe(201);

  const bookId =
    bookResponse.body.data.id;

  if (copies > 0) {
    const copyResponse = await request(app)
      .post('/api/v1/borrow/copies')
      .set(
        'Authorization',
        `Bearer ${adminToken}`
      )
      .send({
        bookId,
        quantity: copies,
      });

    expect(copyResponse.statusCode).toBe(201);
  }

  return bookId;
};

beforeAll(async () => {
  
  await sequelize.sync({
    force: true,
  });

  
  member1Token =
    await registerAndLogin(member1);

  member2Token =
    await registerAndLogin(member2);

  member3Token =
    await registerAndLogin(member3);

  
  await registerAndLogin(admin);

  
  await User.update(
    {
      role: 'admin',
    },
    {
      where: {
        email: admin.email,
      },
    }
  );

  
  adminToken =
    await registerAndLogin(admin);
});



describe(
  'Part 1 - Inventory consistency',
  () => {
    it(
      'creates a catalog book with zero physical inventory',
      async () => {
        const response =
          await request(app)
            .post('/api/v1/books')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              isbn:
                '9783000000001',

              title:
                'Zero Inventory Book',
            });

        expect(
          response.statusCode
        ).toBe(201);

        const book =
          response.body.data;

        expect(
          book.totalCopies
        ).toBe(0);

        expect(
          book.availableCopies
        ).toBe(0);

        const physicalCopies =
          await BookCopy.count({
            where: {
              bookId:
                book.id,
            },
          });

        expect(
          physicalCopies
        ).toBe(0);
      }
    );

    it(
      'creates physical copies and keeps aggregate counts synchronized',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000002',

            title:
              'Physical Copy Test',

            copies: 3,
          });

        const book =
          await Book.findByPk(
            bookId
          );

        const copies =
          await BookCopy.findAll({
            where: {
              bookId,
            },
          });

        expect(
          copies.length
        ).toBe(3);

        expect(
          book.totalCopies
        ).toBe(3);

        expect(
          book.availableCopies
        ).toBe(3);

        expect(
          copies.every(
            (copy) =>
              copy.status ===
              'available'
          )
        ).toBe(true);
      }
    );

    it(
      'decreases availableCopies during normal checkout',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000003',

            title:
              'Normal Checkout Test',

            copies: 2,
          });

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

        const book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.totalCopies
        ).toBe(2);

        expect(
          book.availableCopies
        ).toBe(1);

        const borrowedCopies =
          await BookCopy.count({
            where: {
              bookId,
              status:
                'borrowed',
            },
          });

        const availableCopies =
          await BookCopy.count({
            where: {
              bookId,
              status:
                'available',
            },
          });

        expect(
          borrowedCopies
        ).toBe(1);

        expect(
          availableCopies
        ).toBe(1);
      }
    );

    it(
      'return without reservation increases availability',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000004',

            title:
              'Simple Return Test',

            copies: 1,
          });

        const checkoutResponse =
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
          checkoutResponse.statusCode
        ).toBe(201);

        const recordId =
          checkoutResponse.body
            .data.id;

        let book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.availableCopies
        ).toBe(0);

        const returnResponse =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          returnResponse.statusCode
        ).toBe(200);

        book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.totalCopies
        ).toBe(1);

        expect(
          book.availableCopies
        ).toBe(1);

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
            },
          });

        expect(
          copy.status
        ).toBe('available');
      }
    );

    it(
      'return with reservation keeps the copy outside general availability',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000005',

            title:
              'Reserved Return Test',

            copies: 1,
          });

        
        const checkoutResponse =
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
          checkoutResponse.statusCode
        ).toBe(201);

        const recordId =
          checkoutResponse.body
            .data.id;

        
        const reservationResponse =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
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
              `/api/v1/borrow/${recordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          returnResponse.statusCode
        ).toBe(200);

        const book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.totalCopies
        ).toBe(1);

        expect(
          book.availableCopies
        ).toBe(0);

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
            },
          });

        expect(
          copy.status
        ).toBe('reserved');

        expect(
          copy.reservedForUserId
        ).not.toBeNull();

        const reservation =
          await Reservation.findOne({
            where: {
              bookId,
              userId:
                copy.reservedForUserId,
            },
          });

        expect(
          reservation.status
        ).toBe('ready');
      }
    );

    it(
      'reserved pickup does not decrease availableCopies a second time',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000006',

            title:
              'Reservation Pickup Test',

            copies: 1,
          });

        
        const checkoutResponse =
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

        const recordId =
          checkoutResponse.body
            .data.id;

       
        await request(app)
          .post(
            '/api/v1/reservations'
          )
          .set(
            'Authorization',
            `Bearer ${member2Token}`
          )
          .send({
            bookId,
          });

        await request(app)
          .post(
            `/api/v1/borrow/${recordId}/return`
          )
          .set(
            'Authorization',
            `Bearer ${adminToken}`
          );

        let book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.availableCopies
        ).toBe(0);

        
        const pickupResponse =
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
          pickupResponse.statusCode
        ).toBe(201);

        book =
          await Book.findByPk(
            bookId
          );

        
        expect(
          book.availableCopies
        ).toBe(0);

        expect(
          book.totalCopies
        ).toBe(1);

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
            },
          });

        expect(
          copy.status
        ).toBe('borrowed');

        expect(
          copy.reservedForUserId
        ).toBeNull();
      }
    );

    it(
      'cancelling a ready reservation restores availability when nobody else is waiting',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000007',

            title:
              'Ready Cancellation Test',

            copies: 1,
          });

        const checkoutResponse =
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

        const recordId =
          checkoutResponse.body
            .data.id;

        
        const reservationResponse =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            )
            .send({
              bookId,
            });

        const reservationId =
          reservationResponse.body
            .data.id;

        
        await request(app)
          .post(
            `/api/v1/borrow/${recordId}/return`
          )
          .set(
            'Authorization',
            `Bearer ${adminToken}`
          );

        let reservation =
          await Reservation.findByPk(
            reservationId
          );

        expect(
          reservation.status
        ).toBe('ready');

        let book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.availableCopies
        ).toBe(0);

       
        const cancelResponse =
          await request(app)
            .post(
              `/api/v1/reservations/${reservationId}/cancel`
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            );

        expect(
          cancelResponse.statusCode
        ).toBe(200);

        book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.availableCopies
        ).toBe(1);

        expect(
          book.totalCopies
        ).toBe(1);

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
            },
          });

        expect(
          copy.status
        ).toBe('available');

        expect(
          copy.reservedForUserId
        ).toBeNull();
      }
    );

    it(
      'cancelling the first ready reservation transfers the copy to the next waiting member',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000008',

            title:
              'Reservation Transfer Test',

            copies: 1,
          });

        
        const checkoutResponse =
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

        const recordId =
          checkoutResponse.body
            .data.id;

        
        const member2Reservation =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            )
            .send({
              bookId,
            });

        
        await request(app)
          .post(
            '/api/v1/reservations'
          )
          .set(
            'Authorization',
            `Bearer ${member3Token}`
          )
          .send({
            bookId,
          });

        await request(app)
          .post(
            `/api/v1/borrow/${recordId}/return`
          )
          .set(
            'Authorization',
            `Bearer ${adminToken}`
          );

        const member2ReservationId =
          member2Reservation.body
            .data.id;

        
        const cancelResponse =
          await request(app)
            .post(
              `/api/v1/reservations/${member2ReservationId}/cancel`
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            );

        expect(
          cancelResponse.statusCode
        ).toBe(200);

        
        const book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.availableCopies
        ).toBe(0);

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
            },
          });

        expect(
          copy.status
        ).toBe('reserved');

        const member3User =
          await User.findOne({
            where: {
              email:
                member3.email,
            },
          });

        expect(
          copy.reservedForUserId
        ).toBe(
          member3User.id
        );

        const member3Reservation =
          await Reservation.findOne({
            where: {
              bookId,
              userId:
                member3User.id,
            },
          });

        expect(
          member3Reservation.status
        ).toBe('ready');
      }
    );

    it(
      'expired ready reservation restores availability when nobody else is waiting',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000009',

            title:
              'Reservation Expiry Test',

            copies: 1,
          });

        
        const checkoutResponse =
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

        const recordId =
          checkoutResponse.body
            .data.id;

       
        const reservationResponse =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${member2Token}`
            )
            .send({
              bookId,
            });

        const reservationId =
          reservationResponse.body
            .data.id;

        await request(app)
          .post(
            `/api/v1/borrow/${recordId}/return`
          )
          .set(
            'Authorization',
            `Bearer ${adminToken}`
          );

        
        await Reservation.update(
          {
            expiresAt:
              new Date(
                Date.now() -
                  60 * 60 * 1000
              ),
          },
          {
            where: {
              id:
                reservationId,
            },
          }
        );

        const expiredCount =
          await reservationService
            .expireStaleHolds();

        expect(
          expiredCount
        ).toBeGreaterThanOrEqual(
          1
        );

        const reservation =
          await Reservation.findByPk(
            reservationId
          );

        expect(
          reservation.status
        ).toBe('expired');

        const book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.availableCopies
        ).toBe(1);

        expect(
          book.totalCopies
        ).toBe(1);

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
            },
          });

        expect(
          copy.status
        ).toBe('available');

        expect(
          copy.reservedForUserId
        ).toBeNull();
      }
    );

    it(
      'retiring an available copy decreases total and available inventory together',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000010',

            title:
              'Retire Copy Test',

            copies: 2,
          });

        const copy =
          await BookCopy.findOne({
            where: {
              bookId,
              status:
                'available',
            },
          });

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/copies/${copy.id}/retire`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          response.statusCode
        ).toBe(200);

        const book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.totalCopies
        ).toBe(1);

        expect(
          book.availableCopies
        ).toBe(1);

        const retiredCopy =
          await BookCopy.findByPk(
            copy.id
          );

        expect(
          retiredCopy.status
        ).toBe('lost');
      }
    );

    it(
      'book metadata update cannot manually change inventory counters',
      async () => {
        const bookId =
          await createBook({
            isbn:
              '9783000000011',

            title:
              'Inventory Protection Test',

            copies: 2,
          });

        
        const response =
          await request(app)
            .put(
              `/api/v1/books/${bookId}`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              title:
                'Inventory Protection Updated',

              totalCopies:
                999,
            });

        expect(
          response.statusCode
        ).toBe(200);

        const book =
          await Book.findByPk(
            bookId
          );

        expect(
          book.title
        ).toBe(
          'Inventory Protection Updated'
        );

        
        expect(
          book.totalCopies
        ).toBe(2);

        expect(
          book.availableCopies
        ).toBe(2);

        const copies =
          await BookCopy.count({
            where: {
              bookId,
            },
          });

        expect(
          copies
        ).toBe(2);
      }
    );
  }
);