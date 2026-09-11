const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
  User,
  BorrowRecord,
  Notification,
} = require('../../src/database/models');

const {
  flagOverdueLoans,
  notifyDueSoon,
} = require('../../src/jobs/scheduler');

let adminToken;
let memberToken;
let memberUser;

const stamp = Date.now();

const admin = {
  name: 'Scheduler Admin',
  email: `scheduler.admin.${stamp}@example.com`,
  password: 'StrongPass1',
};

const member = {
  name: 'Scheduler Member',
  email: `scheduler.member.${stamp}@example.com`,
  password: 'StrongPass1',
};

const registerAndLogin = async (credentials) => {
  await request(app)
    .post('/api/v1/auth/register')
    .send(credentials);

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send(credentials);

  expect(response.statusCode).toBe(200);

  return response.body.data.accessToken;
};

const createBookWithCopy = async (
  isbn,
  title
) => {
  /*
   * Part 1 architecture:
   *
   * POST /books creates only the catalog record.
   *
   * Physical copies are created separately through
   * /borrow/copies.
   */
  const bookResponse =
    await request(app)
      .post('/api/v1/books')
      .set(
        'Authorization',
        `Bearer ${adminToken}`
      )
      .send({
        isbn,
        title,
      });

  expect(
    bookResponse.statusCode
  ).toBe(201);

  const bookId =
    bookResponse.body.data.id;

  expect(
    bookId
  ).toBeDefined();

  const copyResponse =
    await request(app)
      .post('/api/v1/borrow/copies')
      .set(
        'Authorization',
        `Bearer ${adminToken}`
      )
      .send({
        bookId,
        quantity: 1,
        shelfLocation: 'TEST-SHELF',
      });

  expect(
    copyResponse.statusCode
  ).toBe(201);

  return bookId;
};

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  /*
   * Main member used for the due-soon and overdue
   * scheduler tests.
   */
  memberToken =
    await registerAndLogin(
      member
    );

  memberUser =
    await User.findOne({
      where: {
        email: member.email,
      },
    });

  expect(
    memberUser
  ).not.toBeNull();

  /*
   * Register admin.
   */
  await registerAndLogin(
    admin
  );

  /*
   * Promote account directly in the test database.
   */
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

  /*
   * Login again so JWT contains the admin role.
   */
  adminToken =
    await registerAndLogin(
      admin
    );
});

/*
 * No afterAll sequelize/redis close.
 *
 * The integration suite shares these resources while
 * running under --runInBand and the test command uses
 * --forceExit.
 */

describe(
  'Part 9 - scheduled circulation maintenance',
  () => {
    let dueSoonRecordId;
    let overdueRecordId;

    it(
      'creates one due-soon notification for a loan due within 48 hours',
      async () => {
        const bookId =
          await createBookWithCopy(
            '9785000000001',
            'Due Soon Scheduler Test'
          );

        const checkout =
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
          checkout.statusCode
        ).toBe(201);

        dueSoonRecordId =
          checkout.body.data.id;

        expect(
          dueSoonRecordId
        ).toBeDefined();

        /*
         * Force this loan to become due 24 hours
         * from now.
         *
         * That falls inside Part 9's 48-hour
         * reminder window.
         */
        await BorrowRecord.update(
          {
            status: 'active',

            dueAt:
              new Date(
                Date.now() +
                  24 *
                    60 *
                    60 *
                    1000
              ),
          },
          {
            where: {
              id:
                dueSoonRecordId,
            },
          }
        );

        await notifyDueSoon();

        const notification =
          await Notification.findOne({
            where: {
              userId:
                memberUser.id,

              borrowRecordId:
                dueSoonRecordId,

              type:
                'due_soon',
            },
          });

        expect(
          notification
        ).not.toBeNull();

        expect(
          notification.message
        ).toMatch(
          /due/i
        );
      }
    );

    it(
      'does not create duplicate due-soon notifications during the same due window',
      async () => {
        /*
         * Count only notifications for the specific
         * loan created in the previous test.
         */
        const before =
          await Notification.count({
            where: {
              userId:
                memberUser.id,

              borrowRecordId:
                dueSoonRecordId,

              type:
                'due_soon',
            },
          });

        expect(
          before
        ).toBe(1);

        /*
         * Run the scheduler repeatedly.
         */
        await notifyDueSoon();

        await notifyDueSoon();

        const after =
          await Notification.count({
            where: {
              userId:
                memberUser.id,

              borrowRecordId:
                dueSoonRecordId,

              type:
                'due_soon',
            },
          });

        /*
         * Still exactly one notification for this
         * current due-date reminder window.
         */
        expect(
          after
        ).toBe(before);
      }
    );

    it(
      'marks a past-due active loan overdue and creates an overdue notification',
      async () => {
        const bookId =
          await createBookWithCopy(
            '9785000000002',
            'Overdue Scheduler Test'
          );

        const checkout =
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
          checkout.statusCode
        ).toBe(201);

        overdueRecordId =
          checkout.body.data.id;

        expect(
          overdueRecordId
        ).toBeDefined();

        /*
         * Simulate the cron/scheduler gap:
         *
         * DB still says active, but dueAt has already
         * passed.
         */
        await BorrowRecord.update(
          {
            status:
              'active',

            dueAt:
              new Date(
                Date.now() -
                  60 *
                    60 *
                    1000
              ),
          },
          {
            where: {
              id:
                overdueRecordId,
            },
          }
        );

        await flagOverdueLoans();

        const record =
          await BorrowRecord.findByPk(
            overdueRecordId
          );

        expect(
          record
        ).not.toBeNull();

        expect(
          record.status
        ).toBe('overdue');

        const notification =
          await Notification.findOne({
            where: {
              userId:
                memberUser.id,

              borrowRecordId:
                overdueRecordId,

              type:
                'overdue',
            },
          });

        expect(
          notification
        ).not.toBeNull();

        expect(
          notification.message
        ).toMatch(
          /overdue/i
        );
      }
    );

    it(
      'does not create a second overdue notification for the same loan',
      async () => {
        const before =
          await Notification.count({
            where: {
              userId:
                memberUser.id,

              borrowRecordId:
                overdueRecordId,

              type:
                'overdue',
            },
          });

        expect(
          before
        ).toBe(1);

        /*
         * The record is already overdue, therefore
         * another scheduler run should not create
         * another notification.
         */
        await flagOverdueLoans();

        await flagOverdueLoans();

        const after =
          await Notification.count({
            where: {
              userId:
                memberUser.id,

              borrowRecordId:
                overdueRecordId,

              type:
                'overdue',
            },
          });

        expect(
          after
        ).toBe(before);
      }
    );

    it(
      'does not send a due-soon notification for a loan more than 48 hours away',
      async () => {
        /*
         * IMPORTANT:
         *
         * Do not reuse memberToken here.
         *
         * The previous test deliberately gave the
         * main member an overdue loan.
         *
         * Part 2 correctly blocks users who have
         * overdue loans from checking out another
         * book.
         *
         * Therefore this scheduler scenario gets its
         * own isolated member.
         */
        const futureMember = {
          name:
            'Future Scheduler Member',

          email:
            `scheduler.future.${Date.now()}@example.com`,

          password:
            'StrongPass1',
        };

        const futureMemberToken =
          await registerAndLogin(
            futureMember
          );

        const futureUser =
          await User.findOne({
            where: {
              email:
                futureMember.email,
            },
          });

        expect(
          futureUser
        ).not.toBeNull();

        const bookId =
          await createBookWithCopy(
            '9785000000003',
            'Future Due Scheduler Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${futureMemberToken}`
            )
            .send({
              bookId,
            });

        expect(
          checkout.statusCode
        ).toBe(201);

        const recordId =
          checkout.body.data.id;

        expect(
          recordId
        ).toBeDefined();

        /*
         * Seven days away is well outside the
         * 48-hour notification window.
         */
        await BorrowRecord.update(
          {
            status:
              'active',

            dueAt:
              new Date(
                Date.now() +
                  7 *
                    24 *
                    60 *
                    60 *
                    1000
              ),
          },
          {
            where: {
              id:
                recordId,
            },
          }
        );

        await notifyDueSoon();

        const notification =
          await Notification.findOne({
            where: {
              userId:
                futureUser.id,

              borrowRecordId:
                recordId,

              type:
                'due_soon',
            },
          });

        expect(
          notification
        ).toBeNull();
      }
    );
  }
);