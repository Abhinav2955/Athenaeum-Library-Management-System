const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
  User,
  Book,
  BookCopy,
  BorrowRecord,
} = require('../../src/database/models');

let adminToken;

let activeMemberToken;
let suspendedMemberToken;
let expiredMemberToken;

let activeMember;
let suspendedMember;
let expiredMember;

const stamp = Date.now();

const adminCredentials = {
  name: 'Borrow Rules Admin',
  email:
    `borrow.rules.admin.${stamp}@example.com`,
  password: 'StrongPass1',
};

const activeCredentials = {
  name: 'Active Borrow Member',
  email:
    `borrow.rules.active.${stamp}@example.com`,
  password: 'StrongPass1',
};

const suspendedCredentials = {
  name: 'Suspended Borrow Member',
  email:
    `borrow.rules.suspended.${stamp}@example.com`,
  password: 'StrongPass1',
};

const expiredCredentials = {
  name: 'Expired Borrow Member',
  email:
    `borrow.rules.expired.${stamp}@example.com`,
  password: 'StrongPass1',
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
      bookResponse.body
        .data.id;

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
   * ACTIVE MEMBER
   */
  activeMemberToken =
    await registerAndLogin(
      activeCredentials
    );

  activeMember =
    await User.findOne({
      where: {
        email:
          activeCredentials.email,
      },
    });

  /*
   * SUSPENDED MEMBER
   */
  suspendedMemberToken =
    await registerAndLogin(
      suspendedCredentials
    );

  suspendedMember =
    await User.findOne({
      where: {
        email:
          suspendedCredentials.email,
      },
    });

  await suspendedMember.update({
    membershipStatus:
      'suspended',
  });

  /*
   * EXPIRED MEMBER
   */
  expiredMemberToken =
    await registerAndLogin(
      expiredCredentials
    );

  expiredMember =
    await User.findOne({
      where: {
        email:
          expiredCredentials.email,
      },
    });

  await expiredMember.update({
    membershipStatus:
      'expired',
  });

  /*
   * ADMIN
   */
  await registerAndLogin(
    adminCredentials
  );

  await User.update(
    {
      role: 'admin',
    },
    {
      where: {
        email:
          adminCredentials.email,
      },
    }
  );

  adminToken =
    await registerAndLogin(
      adminCredentials
    );
});

describe(
  'Part 2 - Borrowing and renewal rules',
  () => {
    it(
      'allows an active member to borrow normally',
      async () => {
        const bookId =
          await createBookWithCopy(
            '9784000000001',
            'Active Member Borrow Test'
          );

        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${activeMemberToken}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(201);
      }
    );

    it(
      'blocks a suspended member from borrowing',
      async () => {
        const bookId =
          await createBookWithCopy(
            '9784000000002',
            'Suspended Borrow Test'
          );

        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${suspendedMemberToken}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(403);

        expect(
  response.body.message
).toMatch(
  /membership|suspended/i
);
      }
    );

    it(
      'blocks an expired member from borrowing',
      async () => {
        const bookId =
          await createBookWithCopy(
            '9784000000003',
            'Expired Borrow Test'
          );

        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${expiredMemberToken}`
            )
            .send({
              bookId,
            });

        expect(
          response.statusCode
        ).toBe(403);

        expect(
          response.body.message
        ).toMatch(
          /membership/i
        );
      }
    );

    it(
      'blocks new borrowing when an active-status loan is already past due',
      async () => {
        /*
         * Create separate member so previous test
         * loans do not interfere.
         */
        const credentials = {
          name:
            'Past Due Member',

          email:
            `borrow.rules.pastdue.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const member =
          await User.findOne({
            where: {
              email:
                credentials.email,
            },
          });

        const firstBookId =
          await createBookWithCopy(
            '9784000000004',
            'Existing Past Due Loan'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId:
                firstBookId,
            });

        expect(
          checkout.statusCode
        ).toBe(201);

        /*
         * Simulate the scheduler gap:
         *
         * status remains ACTIVE,
         * but dueAt is in the past.
         */
        await BorrowRecord.update(
          {
            status:
              'active',

            dueAt:
              new Date(
                Date.now() -
                  24 *
                    60 *
                    60 *
                    1000
              ),
          },
          {
            where: {
              id:
                checkout.body
                  .data.id,
            },
          }
        );

        const secondBookId =
          await createBookWithCopy(
            '9784000000005',
            'Second Borrow Attempt'
          );

        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId:
                secondBookId,
            });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /overdue/i
        );
      }
    );

    it(
      'blocks new borrowing when loan status is already overdue',
      async () => {
        const credentials = {
          name:
            'Overdue Status Member',

          email:
            `borrow.rules.overdue.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const firstBookId =
          await createBookWithCopy(
            '9784000000006',
            'Explicit Overdue Loan'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId:
                firstBookId,
            });

        await BorrowRecord.update(
          {
            status:
              'overdue',
          },
          {
            where: {
              id:
                checkout.body
                  .data.id,
            },
          }
        );

        const secondBookId =
          await createBookWithCopy(
            '9784000000007',
            'Blocked Second Book'
          );

        const response =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId:
                secondBookId,
            });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /overdue/i
        );
      }
    );

    it(
      'rejects renewal when dueAt has passed even though status is still active',
      async () => {
        const credentials = {
          name:
            'Renewal Past Due Member',

          email:
            `borrow.rules.renewpast.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const bookId =
          await createBookWithCopy(
            '9784000000008',
            'Past Due Renewal Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId,
            });

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
                  60 * 1000
              ),
          },
          {
            where: {
              id:
                recordId,
            },
          }
        );

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /overdue/i
        );
      }
    );

    it(
      'rejects renewal when loan status is overdue',
      async () => {
        const credentials = {
          name:
            'Overdue Renewal Member',

          email:
            `borrow.rules.renewoverdue.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const bookId =
          await createBookWithCopy(
            '9784000000009',
            'Overdue Renewal Status Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId,
            });

        const recordId =
          checkout.body
            .data.id;

        await BorrowRecord.update(
          {
            status:
              'overdue',
          },
          {
            where: {
              id:
                recordId,
            },
          }
        );

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /overdue/i
        );
      }
    );

    it(
      'allows normal renewal of an active non-overdue loan',
      async () => {
        const credentials = {
          name:
            'Normal Renewal Member',

          email:
            `borrow.rules.normalrenew.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const bookId =
          await createBookWithCopy(
            '9784000000010',
            'Normal Renewal Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId,
            });

        const recordId =
          checkout.body
            .data.id;

        const before =
          await BorrowRecord.findByPk(
            recordId
          );

        const oldDueAt =
          new Date(
            before.dueAt
          );

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          response.statusCode
        ).toBe(200);

        const after =
          await BorrowRecord.findByPk(
            recordId
          );

        expect(
          after.renewedCount
        ).toBe(1);

        expect(
          new Date(
            after.dueAt
          ).getTime()
        ).toBeGreaterThan(
          oldDueAt.getTime()
        );
      }
    );

    it(
      'blocks renewal after maximum renewal count is reached',
      async () => {
        const credentials = {
          name:
            'Max Renewal Member',

          email:
            `borrow.rules.maxrenew.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const bookId =
          await createBookWithCopy(
            '9784000000011',
            'Maximum Renewal Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId,
            });

        const recordId =
          checkout.body
            .data.id;

        await BorrowRecord.update(
          {
            renewedCount: 2,
          },
          {
            where: {
              id:
                recordId,
            },
          }
        );

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /maximum/i
        );
      }
    );

    it(
      'blocks renewal when another member is waiting in the reservation queue',
      async () => {
        const borrowerCredentials = {
          name:
            'Reservation Renewal Borrower',

          email:
            `borrow.rules.queue.borrower.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const waitingCredentials = {
          name:
            'Reservation Waiting Member',

          email:
            `borrow.rules.queue.waiter.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const borrowerToken =
          await registerAndLogin(
            borrowerCredentials
          );

        const waitingToken =
          await registerAndLogin(
            waitingCredentials
          );

        const bookId =
          await createBookWithCopy(
            '9784000000012',
            'Reservation Queue Renewal Test'
          );

        const checkout =
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

        const recordId =
          checkout.body
            .data.id;

        const reservation =
          await request(app)
            .post(
              '/api/v1/reservations'
            )
            .set(
              'Authorization',
              `Bearer ${waitingToken}`
            )
            .send({
              bookId,
            });

        expect(
          reservation.statusCode
        ).toBe(201);

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${borrowerToken}`
            );

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.body.message
        ).toMatch(
          /reservation/i
        );
      }
    );

    it(
      'blocks renewal when the borrower membership becomes suspended',
      async () => {
        const credentials = {
          name:
            'Suspended Renewal Member',

          email:
            `borrow.rules.suspendrenew.${stamp}@example.com`,

          password:
            'StrongPass1',
        };

        const token =
          await registerAndLogin(
            credentials
          );

        const member =
          await User.findOne({
            where: {
              email:
                credentials.email,
            },
          });

        const bookId =
          await createBookWithCopy(
            '9784000000013',
            'Suspended Renewal Test'
          );

        const checkout =
          await request(app)
            .post(
              '/api/v1/borrow/checkout'
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            )
            .send({
              bookId,
            });

        const recordId =
          checkout.body
            .data.id;

        await member.update({
          membershipStatus:
            'suspended',
        });

        const response =
          await request(app)
            .post(
              `/api/v1/borrow/${recordId}/renew`
            )
            .set(
              'Authorization',
              `Bearer ${token}`
            );

        expect(
          response.statusCode
        ).toBe(403);

        expect(
  response.body.message
).toMatch(
  /membership|suspended/i
);
      }
    );
  }
);