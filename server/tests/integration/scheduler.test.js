const request =
  require('supertest');

const app =
  require('../../src/app');

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

const stamp =
  Date.now();

const admin = {
  name:
    'Scheduler Admin',

  email:
    `scheduler.admin.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const member = {
  name:
    'Scheduler Member',

  email:
    `scheduler.member.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const registerAndLogin =
  async (credentials) => {
    await request(app)
      .post(
        '/api/v1/auth/register'
      )
      .send(
        credentials
      );

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

const createBookWithCopy =
  async (
    isbn,
    title
  ) => {
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
          isbn,
          title,
        });

    expect(
      bookResponse.statusCode
    ).toBe(201);

    const bookId =
      bookResponse.body
        .data.id;

    expect(
      bookId
    ).toBeDefined();

    const copyResponse =
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
          shelfLocation:
            'TEST-SHELF',
        });

    expect(
      copyResponse.statusCode
    ).toBe(201);

    return bookId;
  };

beforeAll(
  async () => {
    await sequelize.sync({
      force: true,
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

    expect(
      memberUser
    ).not.toBeNull();

    await registerAndLogin(
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

    adminToken =
      await registerAndLogin(
        admin
      );
  }
);

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
          checkout.body
            .data.id;

        expect(
          dueSoonRecordId
        ).toBeDefined();

        await BorrowRecord.update(
          {
            status:
              'active',

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

        expect(
          after
        ).toBe(
          before
        );
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
          checkout.body
            .data.id;

        expect(
          overdueRecordId
        ).toBeDefined();

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

        const transitioned =
          await flagOverdueLoans();

        expect(
          transitioned
        ).toBeGreaterThanOrEqual(
          1
        );

        const record =
          await BorrowRecord.findByPk(
            overdueRecordId
          );

        expect(
          record
        ).not.toBeNull();

        expect(
          record.status
        ).toBe(
          'overdue'
        );

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
        ).toBe(
          before
        );
      }
    );

    it(
      'never changes a returned past-due loan back to overdue',
      async () => {
        const returnedMember = {
          name:
            'Returned Scheduler Member',

          email:
            `scheduler.returned.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const returnedToken =
          await registerAndLogin(
            returnedMember
          );

        const returnedUser =
          await User.findOne({
            where: {
              email:
                returnedMember.email,
            },
          });

        expect(
          returnedUser
        ).not.toBeNull();

        const bookId =
          await createBookWithCopy(
            '9785000000004',
            'Returned Overdue Scheduler Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${returnedToken}`
            )
            .send({
              bookId,
            });

        expect(
          checkout.statusCode
        ).toBe(201);

        const recordId =
          checkout.body
            .data.id;

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
                recordId,
            },
          }
        );

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

        const beforeSweep =
          await BorrowRecord.findByPk(
            recordId
          );

        expect(
          beforeSweep.status
        ).toBe(
          'returned'
        );

        await flagOverdueLoans();

        const afterSweep =
          await BorrowRecord.findByPk(
            recordId
          );

        expect(
          afterSweep.status
        ).toBe(
          'returned'
        );

        const overdueNotification =
          await Notification.findOne({
            where: {
              userId:
                returnedUser.id,

              borrowRecordId:
                recordId,

              type:
                'overdue',
            },
          });

        expect(
          overdueNotification
        ).toBeNull();
      }
    );

    it(
      'does not send a due-soon notification for a loan more than 48 hours away',
      async () => {
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
          checkout.body
            .data.id;

        expect(
          recordId
        ).toBeDefined();

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