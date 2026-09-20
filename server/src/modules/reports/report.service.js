const {
  Op,
  fn,
  col,
  literal,
} = require('sequelize');

const {
  Book,
  User,
  BookCopy,
  BorrowRecord,
  Reservation,
  Fine,
} = require('../../database/models');

const DAY_MS =
  24 * 60 * 60 * 1000;

const getInventoryHealth =
  async () => {
    const statuses = [
      'available',
      'borrowed',
      'reserved',
      'damaged',
      'under_repair',
      'lost',
    ];

    const rows =
      await Promise.all(
        statuses.map(
          async (status) => ({
            status,

            count:
              await BookCopy.count({
                where: {
                  status,
                },
              }),
          })
        )
      );

    const counts =
      Object.fromEntries(
        rows.map(
          (row) => [
            row.status,
            row.count,
          ]
        )
      );

    const activeInventory =
      counts.available +
      counts.borrowed +
      counts.reserved +
      counts.damaged +
      counts.under_repair;

    const unavailableForCirculation =
      counts.borrowed +
      counts.reserved +
      counts.damaged +
      counts.under_repair;

    const maintenanceCopies =
      counts.damaged +
      counts.under_repair;

    const availabilityRate =
      activeInventory > 0
        ? Number(
            (
              (
                counts.available /
                activeInventory
              ) * 100
            ).toFixed(2)
          )
        : 0;

    return {
      ...counts,

      activeInventory,

      unavailableForCirculation,

      maintenanceCopies,

      historicalLostCopies:
        counts.lost,

      availabilityRate,
    };
  };

const getDashboardSummary =
  async () => {
    const now =
      new Date();

    const [
      totalBooks,
      totalMembers,
      openLoans,
      overdueLoans,
      waitingReservations,
      readyReservations,
      pendingFinesTotal,
      collectedFinesTotal,
      waivedFinesTotal,
      inventory,
    ] =
      await Promise.all([
        Book.count(),

        User.count({
          where: {
            role:
              'member',
          },
        }),

        BorrowRecord.count({
          where: {
            status: {
              [Op.in]: [
                'active',
                'overdue',
              ],
            },
          },
        }),

        BorrowRecord.count({
          where: {
            status: {
              [Op.in]: [
                'active',
                'overdue',
              ],
            },

            dueAt: {
              [Op.lt]:
                now,
            },
          },
        }),

        Reservation.count({
          where: {
            status:
              'waiting',
          },
        }),

        Reservation.count({
          where: {
            status:
              'ready',
          },
        }),

        Fine.sum(
          'amount',
          {
            where: {
              status:
                'pending',
            },
          }
        ),

        Fine.sum(
          'amount',
          {
            where: {
              status:
                'paid',
            },
          }
        ),

        Fine.sum(
          'amount',
          {
            where: {
              status:
                'waived',
            },
          }
        ),

        getInventoryHealth(),
      ]);

    const overdueRate =
      openLoans > 0
        ? Number(
            (
              (
                overdueLoans /
                openLoans
              ) * 100
            ).toFixed(2)
          )
        : 0;

    return {
      totalBooks,
      totalMembers,

      activeLoans:
        openLoans,

      overdueLoans,

      overdueRate,

      waitingReservations,
      readyReservations,

      pendingFinesTotal:
        Number(
          pendingFinesTotal
        ) || 0,

      collectedFinesTotal:
        Number(
          collectedFinesTotal
        ) || 0,

      waivedFinesTotal:
        Number(
          waivedFinesTotal
        ) || 0,

      totalCopies:
        inventory.activeInventory,

      availableCopies:
        inventory.available,

      maintenanceCopies:
        inventory.maintenanceCopies,

      lostCopies:
        inventory.lost,

      inventory,
    };
  };

const getMostBorrowedBooks =
  async (
    limit = 10
  ) => {
    const rows =
      await BorrowRecord.findAll({
        attributes: [
          [
            col(
              'copy.book_id'
            ),
            'bookId',
          ],

          [
            fn(
              'COUNT',
              col(
                'BorrowRecord.id'
              )
            ),
            'timesBorrowed',
          ],
        ],

        include: [
          {
            model:
              BookCopy,

            as:
              'copy',

            attributes:
              [],
          },
        ],

        group: [
          'copy.book_id',
        ],

        order: [
          [
            literal(
              'timesBorrowed'
            ),
            'DESC',
          ],
        ],

        limit,

        raw: true,
      });

    const bookIds =
      rows
        .map(
          (row) =>
            row.bookId
        )
        .filter(Boolean);

    if (
      bookIds.length ===
      0
    ) {
      return [];
    }

    const books =
      await Book.findAll({
        where: {
          id: {
            [Op.in]:
              bookIds,
          },
        },

        attributes: [
          'id',
          'title',
          'isbn',
          'coverUrl',
        ],
      });

    const bookById =
      Object.fromEntries(
        books.map(
          (book) => [
            book.id,
            book,
          ]
        )
      );

    return rows
      .filter(
        (row) =>
          bookById[
            row.bookId
          ]
      )
      .map(
        (row) => ({
          book:
            bookById[
              row.bookId
            ],

          timesBorrowed:
            Number(
              row.timesBorrowed
            ),
        })
      );
  };

const getOverdueLoans =
  async () => {
    return BorrowRecord.findAll({
      where: {
        status: {
          [Op.in]: [
            'active',
            'overdue',
          ],
        },

        dueAt: {
          [Op.lt]:
            new Date(),
        },
      },

      include: [
        {
          model:
            User,

          as:
            'borrower',

          attributes: [
            'id',
            'name',
            'email',
            'phone',
            'membershipStatus',
          ],
        },

        {
          model:
            BookCopy,

          as:
            'copy',

          attributes: [
            'id',
            'barcode',
            'shelfLocation',
            'status',
          ],

          include: [
            {
              model:
                Book,

              as:
                'book',

              attributes: [
                'id',
                'title',
                'isbn',
              ],
            },
          ],
        },
      ],

      order: [
        [
          'dueAt',
          'ASC',
        ],
      ],
    });
  };

const getCirculationStats =
  async (
    days = 30
  ) => {
    const since =
      new Date(
        Date.now() -
          days * DAY_MS
      );

    const [
      checkoutsByDay,
      returnsByDay,
      checkoutTotal,
      returnTotal,
    ] =
      await Promise.all([
        BorrowRecord.findAll({
          attributes: [
            [
              fn(
                'DATE',
                col(
                  'borrowed_at'
                )
              ),
              'date',
            ],

            [
              fn(
                'COUNT',
                col('id')
              ),
              'count',
            ],
          ],

          where: {
            borrowedAt: {
              [Op.gte]:
                since,
            },
          },

          group: [
            fn(
              'DATE',
              col(
                'borrowed_at'
              )
            ),
          ],

          order: [
            [
              fn(
                'DATE',
                col(
                  'borrowed_at'
                )
              ),
              'ASC',
            ],
          ],

          raw: true,
        }),

        BorrowRecord.findAll({
          attributes: [
            [
              fn(
                'DATE',
                col(
                  'returned_at'
                )
              ),
              'date',
            ],

            [
              fn(
                'COUNT',
                col('id')
              ),
              'count',
            ],
          ],

          where: {
            returnedAt: {
              [Op.gte]:
                since,
            },
          },

          group: [
            fn(
              'DATE',
              col(
                'returned_at'
              )
            ),
          ],

          order: [
            [
              fn(
                'DATE',
                col(
                  'returned_at'
                )
              ),
              'ASC',
            ],
          ],

          raw: true,
        }),

        BorrowRecord.count({
          where: {
            borrowedAt: {
              [Op.gte]:
                since,
            },
          },
        }),

        BorrowRecord.count({
          where: {
            returnedAt: {
              [Op.gte]:
                since,
            },
          },
        }),
      ]);

    return {
      checkoutsByDay,
      returnsByDay,

      checkoutTotal,
      returnTotal,

      periodDays:
        days,
    };
  };

const getFineRevenueReport =
  async () => {
    const [
      pending,
      paid,
      waived,
      pendingCount,
      paidCount,
      waivedCount,
    ] =
      await Promise.all([
        Fine.sum(
          'amount',
          {
            where: {
              status:
                'pending',
            },
          }
        ),

        Fine.sum(
          'amount',
          {
            where: {
              status:
                'paid',
            },
          }
        ),

        Fine.sum(
          'amount',
          {
            where: {
              status:
                'waived',
            },
          }
        ),

        Fine.count({
          where: {
            status:
              'pending',
          },
        }),

        Fine.count({
          where: {
            status:
              'paid',
          },
        }),

        Fine.count({
          where: {
            status:
              'waived',
          },
        }),
      ]);

    return {
      pending:
        Number(
          pending
        ) || 0,

      collected:
        Number(
          paid
        ) || 0,

      waived:
        Number(
          waived
        ) || 0,

      pendingCount,
      paidCount,
      waivedCount,
    };
  };

const sanitizeCsvValue =
  (value) => {
    const stringValue =
      String(
        value ?? ''
      );

    if (
      /^[=+\-@\t\r\n]/.test(
        stringValue
      )
    ) {
      return `'${stringValue}`;
    }

    return stringValue;
  };

const toCsv = (
  rows,
  columns
) => {
  const escape =
    (value) =>
      `"${sanitizeCsvValue(
        value
      ).replace(
        /"/g,
        '""'
      )}"`;

  const header =
    columns
      .map(
        (column) =>
          escape(
            column.label
          )
      )
      .join(',');

  const lines =
    rows.map(
      (row) =>
        columns
          .map(
            (column) =>
              escape(
                column.value(
                  row
                )
              )
          )
          .join(',')
    );

  return [
    header,
    ...lines,
  ].join('\n');
};

const exportOverdueCsv =
  async () => {
    const overdue =
      await getOverdueLoans();

    return toCsv(
      overdue,
      [
        {
          label:
            'Member Name',

          value:
            (record) =>
              record.borrower
                ?.name,
        },

        {
          label:
            'Member Email',

          value:
            (record) =>
              record.borrower
                ?.email,
        },

        {
          label:
            'Book Title',

          value:
            (record) =>
              record.copy
                ?.book
                ?.title,
        },

        {
          label:
            'ISBN',

          value:
            (record) =>
              record.copy
                ?.book
                ?.isbn,
        },

        {
          label:
            'Barcode',

          value:
            (record) =>
              record.copy
                ?.barcode,
        },

        {
          label:
            'Due Date',

          value:
            (record) =>
              new Date(
                record.dueAt
              )
                .toISOString()
                .slice(
                  0,
                  10
                ),
        },

        {
          label:
            'Days Overdue',

          value:
            (record) =>
              Math.max(
                1,
                Math.ceil(
                  (
                    Date.now() -
                    new Date(
                      record.dueAt
                    ).getTime()
                  ) /
                    DAY_MS
                )
              ),
        },
      ]
    );
  };

const exportInventoryCsv =
  async () => {
    const copies =
      await BookCopy.findAll({
        include: [
          {
            model:
              Book,

            as:
              'book',

            attributes: [
              'title',
              'isbn',
            ],
          },
        ],

        order: [
          [
            'createdAt',
            'ASC',
          ],
        ],
      });

    return toCsv(
      copies,
      [
        {
          label:
            'Book Title',

          value:
            (copy) =>
              copy.book
                ?.title,
        },

        {
          label:
            'ISBN',

          value:
            (copy) =>
              copy.book
                ?.isbn,
        },

        {
          label:
            'Barcode',

          value:
            (copy) =>
              copy.barcode,
        },

        {
          label:
            'Shelf Location',

          value:
            (copy) =>
              copy.shelfLocation,
        },

        {
          label:
            'Status',

          value:
            (copy) =>
              copy.status,
        },

        {
          label:
            'Active Inventory',

          value:
            (copy) =>
              copy.status ===
              'lost'
                ? 'No'
                : 'Yes',
        },
      ]
    );
  };

module.exports = {
  getDashboardSummary,
  getInventoryHealth,
  getMostBorrowedBooks,
  getOverdueLoans,
  getCirculationStats,
  getFineRevenueReport,
  exportOverdueCsv,
  exportInventoryCsv,
};