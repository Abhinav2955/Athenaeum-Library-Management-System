const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
} = require('../../src/config/db');

let adminToken;
let memberToken;

let bookId;
let recordId;

const admin = {
  name: 'AdminF',
  email: `adminf.${Date.now()}@example.com`,
  password: 'StrongPass1',
};

const member = {
  name: 'MemberF',
  email: `memf.${Date.now()}@example.com`,
  password: 'StrongPass1',
};

const registerAndLogin = async (creds) => {
  await request(app)
    .post('/api/v1/auth/register')
    .send(creds);

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send(creds);

  return res.body.data.accessToken;
};

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  /*
   * Create normal member.
   */
  memberToken =
    await registerAndLogin(
      member
    );

  /*
   * Create admin account first.
   */
  await registerAndLogin(
    admin
  );

  const {
    User,
    BorrowRecord,
  } = require(
    '../../src/database/models'
  );

  /*
   * Promote account to admin.
   */
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

  /*
   * Log in again so JWT contains admin role.
   */
  adminToken =
    await registerAndLogin(
      admin
    );

  /*
   * Create catalog record.
   *
   * Part 1 architecture:
   * book creation itself creates zero physical copies.
   */
  const bookRes =
    await request(app)
      .post('/api/v1/books')
      .set(
        'Authorization',
        `Bearer ${adminToken}`
      )
      .send({
        isbn:
          '9783333333333',

        title:
          'Refactoring',
      });

  expect(
    bookRes.statusCode
  ).toBe(201);

  bookId =
    bookRes.body.data.id;

  /*
   * Create one actual physical copy.
   */
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

  /*
   * Member checks out the book.
   */
  const checkoutRes =
    await request(app)
      .post(
        '/api/v1/borrow/checkout'
      )
      .set(
        'Authorization',
        `Bearer ${memberToken}`
      )
      .send({
        bookId,
      });

  expect(
    checkoutRes.statusCode
  ).toBe(201);

  recordId =
    checkoutRes.body.data.id;

  /*
   * Force loan into overdue territory without
   * waiting for the scheduler.
   */
  const record =
    await BorrowRecord.findByPk(
      recordId
    );

  record.dueAt =
    new Date(
      Date.now() -
        10 * 86400000
    );

  await record.save();
});

/*
 * Deliberately no afterAll sequelize/redis close.
 *
 * The complete integration suite shares these
 * resources while running under --runInBand.
 *
 * package.json already uses --forceExit.
 */

describe(
  'Fines module',
  () => {
    let fineId;

    it(
      'auto-generates a fine on overdue return',
      async () => {
        const res =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.message
        ).toMatch(
          /fine was applied/i
        );

        const myFines =
          await request(app)
            .get(
              '/api/v1/fines/me'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            );

        expect(
          myFines.statusCode
        ).toBe(200);

        expect(
          myFines.body.data
            .fines.length
        ).toBe(1);

        fineId =
          myFines.body.data
            .fines[0].id;

        const amount =
          Number(
            myFines.body.data
              .fines[0].amount
          );

        expect(
          amount
        ).toBeGreaterThanOrEqual(
          5.0
        );

        expect(
          amount
        ).toBeLessThanOrEqual(
          6.0
        );
      }
    );

    it(
      'rejects a member trying to record a manual payment (staff-only)',
      async () => {
        const res =
          await request(app)
            .post(
              `/api/v1/fines/${fineId}/pay`
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
      'lets staff record a manual payment',
      async () => {
        const res =
          await request(app)
            .post(
              `/api/v1/fines/${fineId}/pay`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.status
        ).toBe('paid');
      }
    );

    it(
      'rejects recording payment on an already-paid fine',
      async () => {
        const res =
          await request(app)
            .post(
              `/api/v1/fines/${fineId}/pay`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(400);
      }
    );

    /*
     * IMPORTANT:
     *
     * This test must NOT call the real Razorpay API
     * when credentials exist.
     *
     * External payment providers make integration
     * tests slow and nondeterministic.
     *
     * Therefore:
     *
     * - if Razorpay credentials exist, skip the
     *   "not configured" assertion
     *
     * - if credentials are missing, verify that the
     *   server rejects order creation cleanly
     */
    it(
      "rejects starting an online payment when Razorpay isn't configured",
      async () => {
        /*
         * This particular test is only relevant when
         * Razorpay is actually unconfigured.
         */
        if (
          process.env
            .RAZORPAY_KEY_ID &&
          process.env
            .RAZORPAY_KEY_SECRET
        ) {
          return;
        }

        const {
          BorrowRecord,
        } = require(
          '../../src/database/models'
        );

        /*
         * Create another overdue-return fine.
         */
        const checkoutRes =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            )
            .send({
              bookId,
            });

        expect(
          checkoutRes.statusCode
        ).toBe(201);

        const newRecordId =
          checkoutRes.body.data.id;

        const record =
          await BorrowRecord.findByPk(
            newRecordId
          );

        record.dueAt =
          new Date(
            Date.now() -
              2 *
                86400000
          );

        await record.save();

        const returnRes =
          await request(app)
            .post(
              `/api/v1/borrow/${newRecordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          returnRes.statusCode
        ).toBe(200);

        const myFines =
          await request(app)
            .get(
              '/api/v1/fines/me?status=pending'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            );

        expect(
          myFines.statusCode
        ).toBe(200);

        const pendingFines =
          myFines.body.data
            .fines;

        expect(
          pendingFines.length
        ).toBeGreaterThan(0);

        const newFineId =
          pendingFines[0].id;

        const res =
          await request(app)
            .post(
              `/api/v1/fines/${newFineId}/create-order`
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            );

        expect(
          res.statusCode
        ).toBe(500);

        expect(
          res.body.message
        ).toMatch(
          /payment|configured|razorpay/i
        );
      }
    );

    it(
      'lets staff waive a pending fine',
      async () => {
        const {
          BorrowRecord,
        } = require(
          '../../src/database/models'
        );

        const checkoutRes =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            )
            .send({
              bookId,
            });

        expect(
          checkoutRes.statusCode
        ).toBe(201);

        const secondRecordId =
          checkoutRes.body.data.id;

        const record =
          await BorrowRecord.findByPk(
            secondRecordId
          );

        record.dueAt =
          new Date(
            Date.now() -
              4 *
                86400000
          );

        await record.save();

        const returnRes =
          await request(app)
            .post(
              `/api/v1/borrow/${secondRecordId}/return`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          returnRes.statusCode
        ).toBe(200);

        const myFines =
          await request(app)
            .get(
              '/api/v1/fines/me?status=pending'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            );

        expect(
          myFines.statusCode
        ).toBe(200);

        expect(
          myFines.body.data
            .fines.length
        ).toBeGreaterThan(0);

        const secondFineId =
          myFines.body.data
            .fines[0].id;

        const res =
          await request(app)
            .post(
              `/api/v1/fines/${secondFineId}/waive`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              reason:
                'First-time courtesy waiver',
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.status
        ).toBe('waived');

        expect(
          res.body.data
            .waivedReason
        ).toBe(
          'First-time courtesy waiver'
        );
      }
    );

    it(
      'blocks new checkouts once pending balance exceeds the limit',
      async () => {
        const {
          Fine,
          User,
        } = require(
          '../../src/database/models'
        );

        const targetUser =
          await User.findOne({
            where: {
              email:
                member.email,
            },
          });

        expect(
          targetUser
        ).not.toBeNull();

        await Fine.create({
          userId:
            targetUser.id,

          amount:
            15.0,

          reason:
            'Test large pending fine',

          status:
            'pending',
        });

        const res =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            )
            .send({
              bookId,
            });

        expect(
          res.statusCode
        ).toBe(403);

        expect(
          res.body.message
        ).toMatch(
          /outstanding fines/i
        );
      }
    );
  }
);