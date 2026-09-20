const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
} = require('../../src/config/db');

const {
  User,
  BorrowRecord,
  Notification,
  Fine,
} = require(
  '../../src/database/models'
);

let adminToken;
let memberToken;
let memberId;

let bookId;
let recordId;

const admin = {
  name: 'AdminF',
  email:
    `adminf.${Date.now()}@example.com`,
  password: 'StrongPass1',
};

const member = {
  name: 'MemberF',
  email:
    `memf.${Date.now()}@example.com`,
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

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  memberToken =
    await registerAndLogin(
      member
    );

  const memberUser =
    await User.findOne({
      where: {
        email:
          member.email,
      },
    });

  expect(
    memberUser
  ).not.toBeNull();

  memberId =
    memberUser.id;

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
          '9783333333333',

        title:
          'Refactoring',
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

        const notification =
          await Notification.findOne({
            where: {
              userId:
                memberId,

              type:
                'fine_issued',

              borrowRecordId:
                recordId,
            },
          });

        expect(
          notification
        ).not.toBeNull();

        expect(
          notification.userId
        ).toBe(
          memberId
        );

        expect(
          notification.type
        ).toBe(
          'fine_issued'
        );

        expect(
          notification.borrowRecordId
        ).toBe(
          recordId
        );

        expect(
          notification.message
        ).toMatch(
          /fine/i
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

    it(
      "rejects starting an online payment when Razorpay isn't configured",
      async () => {
        if (
          process.env
            .RAZORPAY_KEY_ID &&
          process.env
            .RAZORPAY_KEY_SECRET
        ) {
          return;
        }

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