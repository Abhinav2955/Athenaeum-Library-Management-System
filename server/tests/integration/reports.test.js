const request =
  require('supertest');

const app =
  require('../../src/app');

const {
  sequelize,
} = require(
  '../../src/config/db'
);

const {
  User,
  BookCopy,
  BorrowRecord,
  Fine,
} = require(
  '../../src/database/models'
);

let adminToken;
let memberToken;

let bookId;
let recordId;

const stamp =
  Date.now();

const admin = {
  name:
    'AdminRep',

  email:
    `adminrep.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const member = {
  name:
    'MemberRep',

  email:
    `memrep.${stamp}@example.com`,

  password:
    'StrongPass1',
};

const registerAndLogin =
  async (
    credentials
  ) => {
    await request(app)
      .post(
        '/api/v1/auth/register'
      )
      .send(
        credentials
      );

    const res =
      await request(app)
        .post(
          '/api/v1/auth/login'
        )
        .send(
          credentials
        );

    expect(
      res.statusCode
    ).toBe(200);

    return res.body
      .data.accessToken;
  };

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  memberToken =
    await registerAndLogin(
      member
    );

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

  /*
   * Part 1:
   * create catalog record only.
   */
  const bookRes =
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
          '9784444444444',

        title:
          'Domain-Driven Design',
      });

  expect(
    bookRes.statusCode
  ).toBe(201);

  bookId =
    bookRes.body.data.id;

  /*
   * Add physical copy separately.
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
        quantity: 2,
        shelfLocation:
          'REPORT-A1',
      });

  expect(
    copiesRes.statusCode
  ).toBe(201);

  /*
   * Borrow one copy.
   */
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

  recordId =
    checkout.body.data.id;

  /*
   * Make it overdue while keeping stored status
   * active, proving the report obeys Part 2's
   * authoritative dueAt rule.
   */
  await BorrowRecord.update(
    {
      status:
        'active',

      dueAt:
        new Date(
          Date.now() -
            2 *
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

  /*
   * Give the dashboard some fine data.
   */
  const targetUser =
    await User.findOne({
      where: {
        email:
          member.email,
      },
    });

  await Fine.create({
    userId:
      targetUser.id,

    amount:
      8.5,

    reason:
      'Report pending fine',

    status:
      'pending',
  });
});

describe(
  'Part 10 - Reports module',
  () => {
    it(
      'rejects report access for a normal member',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/dashboard'
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
      'returns complete dashboard KPIs for staff',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/dashboard'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        const data =
          res.body.data;

        expect(
          data.totalBooks
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          data.totalMembers
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          data.activeLoans
        ).toBeGreaterThanOrEqual(
          1
        );

        /*
         * Stored status is still active, but dueAt
         * is in the past.
         */
        expect(
          data.overdueLoans
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          data.overdueRate
        ).toBeGreaterThan(
          0
        );

        expect(
          data.pendingFinesTotal
        ).toBeGreaterThanOrEqual(
          8.5
        );

        expect(
          data
        ).toHaveProperty(
          'inventory'
        );
      }
    );

    it(
      'returns inventory health by physical copy status',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/inventory-health'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        const inventory =
          res.body.data;

        expect(
          inventory
        ).toHaveProperty(
          'available'
        );

        expect(
          inventory
        ).toHaveProperty(
          'borrowed'
        );

        expect(
          inventory
        ).toHaveProperty(
          'reserved'
        );

        expect(
          inventory
        ).toHaveProperty(
          'damaged'
        );

        expect(
          inventory
        ).toHaveProperty(
          'under_repair'
        );

        expect(
          inventory
        ).toHaveProperty(
          'lost'
        );

        expect(
          inventory.activeInventory
        ).toBeGreaterThanOrEqual(
          2
        );
      }
    );

    it(
      'does not count lost physical copies as active inventory',
      async () => {
        /*
         * The unborrowed second copy can be marked
         * damaged and then remains active inventory.
         *
         * Create a historical lost row directly here
         * to verify reporting semantics without
         * interfering with the overdue loan.
         */
        const existing =
          await BookCopy.findOne({
            where: {
              bookId,
              status:
                'available',
            },
          });

        expect(
          existing
        ).not.toBeNull();

        /*
         * Capture current health first.
         */
        const before =
          await request(app)
            .get(
              '/api/v1/reports/inventory-health'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        const beforeActive =
          before.body.data
            .activeInventory;

        await existing.update({
          status:
            'lost',
        });

        const after =
          await request(app)
            .get(
              '/api/v1/reports/inventory-health'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          after.body.data
            .lost
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          after.body.data
            .activeInventory
        ).toBe(
          beforeActive - 1
        );
      }
    );

    it(
      'returns most-borrowed books including the checked-out title',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/top-books'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.some(
            (entry) =>
              entry.book.id ===
              bookId
          )
        ).toBe(true);
      }
    );

    it(
      'returns circulation totals and daily data',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/circulation?days=30'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
            .checkoutTotal
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          Array.isArray(
            res.body.data
              .checkoutsByDay
          )
        ).toBe(true);

        expect(
          res.body.data
            .periodDays
        ).toBe(30);
      }
    );

    it(
      'returns fine revenue totals and counts',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/fines-revenue'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data
        ).toHaveProperty(
          'pending'
        );

        expect(
          res.body.data
        ).toHaveProperty(
          'collected'
        );

        expect(
          res.body.data
        ).toHaveProperty(
          'waived'
        );

        expect(
          res.body.data
        ).toHaveProperty(
          'pendingCount'
        );

        expect(
          res.body.data
            .pending
        ).toBeGreaterThanOrEqual(
          8.5
        );
      }
    );

    it(
      'exports overdue loans as CSV',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/overdue/export'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.headers[
            'content-type'
          ]
        ).toMatch(
          /text\/csv/
        );

        expect(
          res.text
        ).toMatch(
          /"Member Name","Member Email","Book Title","ISBN","Barcode","Due Date","Days Overdue"/
        );

        expect(
          res.text
        ).toMatch(
          /Domain-Driven Design/
        );
      }
    );

    it(
      'exports physical inventory as CSV',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/reports/inventory/export'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.headers[
            'content-type'
          ]
        ).toMatch(
          /text\/csv/
        );

        expect(
          res.text
        ).toMatch(
          /"Book Title","ISBN","Barcode","Shelf Location","Status","Active Inventory"/
        );

        expect(
          res.text
        ).toMatch(
          /Domain-Driven Design/
        );
      }
    );
  }
);