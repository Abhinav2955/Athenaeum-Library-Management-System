const { Op } = require('sequelize');

const {
  BookCopy,
  BorrowRecord,
  Book,
  User,
  Reservation,
  sequelize,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');

const {
  parsePagination,
  buildPaginationMeta,
} = require('../../utils/pagination');

const reservationService =
  require('../reservations/reservation.service');

const fineService =
  require('../fines/fine.service');

const notificationService =
  require('../notifications/notification.service');

const {
  emitDataChanged,
} = require('../../sockets/io');

const LOAN_PERIOD_DAYS = 14;
const MAX_RENEWALS = 2;
const MAX_ACTIVE_LOANS_PER_USER = 5;

const emitMemberLoanChange = (
  userId,
  resources,
  transaction = null
) => {
  emitDataChanged(
    {
      resources,
      userId,
    },
    transaction
  );

  emitDataChanged(
    {
      resources: [
        ...resources,
        'reports',
      ],
      staff: true,
    },
    transaction
  );
};

const emitInventoryChange = (
  transaction = null
) => {
  emitDataChanged(
    {
      resources: [
        'books',
        'inventory',
      ],
      authenticated: true,
    },
    transaction
  );

  emitDataChanged(
    {
      resources: [
        'books',
        'inventory',
        'reports',
      ],
      staff: true,
    },
    transaction
  );
};

const addDays = (date, days) =>
  new Date(
    date.getTime() +
      days * 86400000
  );

const assertActiveMembership = (user) => {
  if (
    user.membershipStatus !==
    'active'
  ) {
    throw ApiError.forbidden(
      'Your library membership is not active'
    );
  }
};

const addCopies = async ({
  bookId,
  shelfLocation,
  quantity,
}) => {
  return sequelize.transaction(
    async (t) => {
      const book =
        await Book.findByPk(
          bookId,
          {
            transaction: t,
            lock: t.LOCK.UPDATE,
          }
        );

      if (!book) {
        throw ApiError.notFound(
          'Book not found'
        );
      }

      const copies = [];

      for (
        let i = 0;
        i < quantity;
        i += 1
      ) {
        const barcode =
          `${book.isbn}-${Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase()}`;

        const copy =
          await BookCopy.create(
            {
              bookId,
              barcode,
              shelfLocation,
            },
            {
              transaction: t,
            }
          );

        copies.push(copy);
      }

      book.totalCopies += quantity;
      book.availableCopies += quantity;

      await book.save({
        transaction: t,
      });

      emitInventoryChange(t);

      return copies;
    }
  );
};

const checkout = async (
  requestingUser,
  {
    bookId,
    userId,
  }
) => {
  const borrowerId =
    userId ||
    requestingUser.id;

  if (
    userId &&
    userId !== requestingUser.id &&
    ![
      'admin',
      'librarian',
    ].includes(
      requestingUser.role
    )
  ) {
    throw ApiError.forbidden(
      'Only staff can check out books on behalf of another member'
    );
  }

  return sequelize.transaction(
    async (t) => {
      const borrower =
        await User.findByPk(
          borrowerId,
          {
            transaction: t,
          }
        );

      if (!borrower) {
        throw ApiError.notFound(
          'Member not found'
        );
      }

      assertActiveMembership(
        borrower
      );

      const overdueLoan =
        await BorrowRecord.findOne({
          where: {
            userId: borrowerId,

            [Op.or]: [
              {
                status:
                  'overdue',
              },

              {
                status:
                  'active',

                dueAt: {
                  [Op.lt]:
                    new Date(),
                },
              },
            ],
          },

          transaction: t,
        });

      if (overdueLoan) {
        throw ApiError.badRequest(
          'Return overdue books before borrowing another book'
        );
      }

      const activeLoanCount =
        await BorrowRecord.count({
          where: {
            userId: borrowerId,

            status: {
              [Op.in]: [
                'active',
                'overdue',
              ],
            },
          },

          transaction: t,
        });

      if (
        activeLoanCount >=
        MAX_ACTIVE_LOANS_PER_USER
      ) {
        throw ApiError.badRequest(
          `Member has reached the ${MAX_ACTIVE_LOANS_PER_USER}-loan limit`
        );
      }

      await fineService
        .assertCheckoutNotBlocked(
          borrowerId
        );

      const alreadyHasThisBook =
        await BorrowRecord.findOne({
          where: {
            userId:
              borrowerId,

            status: {
              [Op.in]: [
                'active',
                'overdue',
              ],
            },
          },

          include: [
            {
              model:
                BookCopy,

              as: 'copy',

              where: {
                bookId,
              },

              required: true,
            },
          ],

          transaction: t,
        });

      if (
        alreadyHasThisBook
      ) {
        throw ApiError.conflict(
          'This member already has a copy of this book checked out'
        );
      }

      const readyReservation =
        await Reservation.findOne({
          where: {
            userId:
              borrowerId,

            bookId,

            status:
              'ready',
          },

          transaction: t,

          lock:
            t.LOCK.UPDATE,
        });

      let copy = null;

      let checkedOutFromReservation =
        false;

      if (
        readyReservation
      ) {
        copy =
          await BookCopy.findOne({
            where: {
              id:
                readyReservation.copyId,

              status:
                'reserved',

              reservedForUserId:
                borrowerId,
            },

            transaction: t,

            lock:
              t.LOCK.UPDATE,
          });

        if (copy) {
          checkedOutFromReservation =
            true;

          readyReservation.status =
            'fulfilled';

          await readyReservation.save({
            transaction: t,
          });

          copy.reservedForUserId =
            null;
        }
      }

      if (!copy) {
        copy =
          await BookCopy.findOne({
            where: {
              bookId,
              status:
                'available',
            },

            lock:
              t.LOCK.UPDATE,

            skipLocked:
              true,

            transaction: t,
          });
      }

      if (!copy) {
        throw ApiError.conflict(
          'No available copies of this book right now'
        );
      }

      copy.status =
        'borrowed';

      await copy.save({
        transaction: t,
      });

      const book =
        await Book.findByPk(
          bookId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      if (
        !checkedOutFromReservation
      ) {
        book.availableCopies =
          Math.max(
            0,
            book.availableCopies -
              1
          );

        await book.save({
          transaction: t,
        });
      }

      const now =
        new Date();

      const record =
        await BorrowRecord.create(
          {
            copyId:
              copy.id,

            userId:
              borrowerId,

            borrowedAt:
              now,

            dueAt:
              addDays(
                now,
                LOAN_PERIOD_DAYS
              ),

            status:
              'active',
          },

          {
            transaction: t,
          }
        );

      const resources = [
        'loans',
      ];

      if (
        checkedOutFromReservation
      ) {
        resources.push(
          'reservations'
        );
      }

      emitMemberLoanChange(
        borrowerId,
        resources,
        t
      );

      emitInventoryChange(t);

      return record;
    }
  );
};

const returnBook = async (
  recordId,
  {
    condition = 'good',
  } = {}
) => {
  return sequelize.transaction(
    async (t) => {
      const record =
        await BorrowRecord.findByPk(
          recordId,
          {
            include: [
              {
                model:
                  BookCopy,

                as: 'copy',
              },
            ],

            transaction: t,

            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!record) {
        throw ApiError.notFound(
          'Borrow record not found'
        );
      }

      if (
        ![
          'active',
          'overdue',
        ].includes(
          record.status
        )
      ) {
        throw ApiError.badRequest(
          'Only active or overdue loans can be returned'
        );
      }

      const now =
        new Date();

      const wasOverdue =
        now >
        record.dueAt;

      record.returnedAt =
        now;

      record.status =
        'returned';

      await record.save({
        transaction: t,
      });

      const book =
        await Book.findByPk(
          record.copy.bookId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      let fulfilled = false;

      if (
        condition ===
        'damaged'
      ) {
        record.copy.status =
          'damaged';

        record.copy.reservedForUserId =
          null;

        await record.copy.save({
          transaction: t,
        });
      } else {
        fulfilled =
          await reservationService
            .tryFulfillNextReservation(
              record.copy.bookId,
              record.copy,
              t
            );

        if (!fulfilled) {
          record.copy.status =
            'available';

          record.copy.reservedForUserId =
            null;

          await record.copy.save({
            transaction: t,
          });

          book.availableCopies =
            Math.min(
              book.totalCopies,
              book.availableCopies +
                1
            );

          await book.save({
            transaction: t,
          });
        }
      }

      let fine = null;

      if (wasOverdue) {
        fine =
          await fineService
            .createFineForOverdueReturn(
              record,
              t
            );

        await notificationService
          .createNotification(
            {
              userId:
                record.userId,

              type:
                'fine_issued',

              message:
                `A fine of ₹${fine.amount} was applied for returning a book late.`,

              borrowRecordId:
                record.id,
            },

            t
          );
      }

      const resources = [
        'loans',
      ];

      if (fine) {
        resources.push(
          'fines'
        );
      }

      emitMemberLoanChange(
        record.userId,
        resources,
        t
      );

      emitInventoryChange(t);

      return {
        record,
        wasOverdue,
        condition,
        fulfilled,
      };
    }
  );
};

const markLoanLost = async (
  recordId
) => {
  return sequelize.transaction(
    async (t) => {
      const record =
        await BorrowRecord.findByPk(
          recordId,
          {
            include: [
              {
                model:
                  BookCopy,

                as: 'copy',
              },
            ],

            transaction: t,

            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!record) {
        throw ApiError.notFound(
          'Borrow record not found'
        );
      }

      if (
        ![
          'active',
          'overdue',
        ].includes(
          record.status
        )
      ) {
        throw ApiError.badRequest(
          'Only an active or overdue loan can be marked lost'
        );
      }

      if (!record.copy) {
        throw ApiError.notFound(
          'Physical copy not found'
        );
      }

      record.status =
        'lost';

      await record.save({
        transaction: t,
      });

      record.copy.status =
        'lost';

      record.copy.reservedForUserId =
        null;

      await record.copy.save({
        transaction: t,
      });

      const book =
        await Book.findByPk(
          record.copy.bookId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      book.totalCopies =
        Math.max(
          book.availableCopies,
          book.totalCopies -
            1
        );

      await book.save({
        transaction: t,
      });

      emitMemberLoanChange(
        record.userId,
        [
          'loans',
        ],
        t
      );

      emitInventoryChange(t);

      return record;
    }
  );
};

const renew = async (
  recordId,
  requestingUser
) => {
  const record =
    await BorrowRecord.findByPk(
      recordId,
      {
        include: [
          {
            model:
              BookCopy,

            as: 'copy',
          },

          {
            model:
              User,

            as: 'borrower',

            attributes: [
              'id',
              'name',
              'email',
              'membershipStatus',
            ],
          },
        ],
      }
    );

  if (!record) {
    throw ApiError.notFound(
      'Borrow record not found'
    );
  }

  if (
    record.userId !==
      requestingUser.id &&
    ![
      'admin',
      'librarian',
    ].includes(
      requestingUser.role
    )
  ) {
    throw ApiError.forbidden(
      'You can only renew your own loans'
    );
  }

  if (
    record.borrower
  ) {
    assertActiveMembership(
      record.borrower
    );
  } else {
    const borrower =
      await User.findByPk(
        record.userId
      );

    if (!borrower) {
      throw ApiError.notFound(
        'Member not found'
      );
    }

    assertActiveMembership(
      borrower
    );
  }

  if (
    record.status ===
      'overdue' ||
    (
      record.status ===
        'active' &&
      new Date() >
        record.dueAt
    )
  ) {
    throw ApiError.badRequest(
      'Overdue loans cannot be renewed'
    );
  }

  if (
    record.status !==
    'active'
  ) {
    throw ApiError.badRequest(
      'Only active loans can be renewed'
    );
  }

  if (
    record.renewedCount >=
    MAX_RENEWALS
  ) {
    throw ApiError.badRequest(
      `This loan has already been renewed the maximum of ${MAX_RENEWALS} times`
    );
  }

  const bookId =
    record.copy.bookId;

  if (
    await reservationService
      .hasWaitingReservations(
        bookId
      )
  ) {
    throw ApiError.badRequest(
      'This book has a reservation queue and cannot be renewed'
    );
  }

  record.dueAt =
    addDays(
      record.dueAt,
      LOAN_PERIOD_DAYS
    );

  record.renewedCount += 1;

  await record.save();

  emitMemberLoanChange(
    record.userId,
    [
      'loans',
    ]
  );

  return record;
};

const listMyLoans = async (
  userId,
  query
) => {
  const {
    page,
    limit,
    offset,
  } =
    parsePagination(query);

  const where = {
    userId,
  };

  if (
    query.status
  ) {
    where.status =
      query.status;
  }

  const {
    rows,
    count,
  } =
    await BorrowRecord
      .findAndCountAll({
        where,

        include: [
          {
            model:
              BookCopy,

            as: 'copy',

            include: [
              {
                model:
                  Book,

                as: 'book',
              },
            ],
          },
        ],

        order: [
          [
            'borrowedAt',
            'DESC',
          ],
        ],

        limit,
        offset,
      });

  return {
    records: rows,

    meta:
      buildPaginationMeta({
        page,
        limit,
        total:
          count,
      }),
  };
};

const listAllRecords = async (
  query
) => {
  const {
    page,
    limit,
    offset,
  } =
    parsePagination(query);

  const where = {};

  if (
    query.status
  ) {
    where.status =
      query.status;
  }

  if (
    query.userId
  ) {
    where.userId =
      query.userId;
  }

  const {
    rows,
    count,
  } =
    await BorrowRecord
      .findAndCountAll({
        where,

        include: [
          {
            model:
              BookCopy,

            as: 'copy',

            include: [
              {
                model:
                  Book,

                as: 'book',
              },
            ],
          },

          {
            model:
              User,

            as: 'borrower',

            attributes: [
              'id',
              'name',
              'email',
            ],
          },
        ],

        order: [
          [
            'borrowedAt',
            'DESC',
          ],
        ],

        limit,
        offset,
      });

  return {
    records: rows,

    meta:
      buildPaginationMeta({
        page,
        limit,
        total:
          count,
      }),
  };
};

const listCopiesForBook =
  async (bookId) => {
    return BookCopy.findAll({
      where: {
        bookId,
      },

      order: [
        [
          'createdAt',
          'ASC',
        ],
      ],
    });
  };

const updateCopyStatus = async (
  copyId,
  nextStatus
) => {
  return sequelize.transaction(
    async (t) => {
      const copy =
        await BookCopy.findByPk(
          copyId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!copy) {
        throw ApiError.notFound(
          'Copy not found'
        );
      }

      if (
        [
          'borrowed',
          'reserved',
          'lost',
        ].includes(
          copy.status
        )
      ) {
        throw ApiError.badRequest(
          `A ${copy.status} copy cannot be moved through the repair workflow`
        );
      }

      const allowedTransitions = {
        available: [
          'damaged',
        ],

        damaged: [
          'under_repair',
          'available',
        ],

        under_repair: [
          'damaged',
          'available',
        ],
      };

      const allowed =
        allowedTransitions[
          copy.status
        ] || [];

      if (
        !allowed.includes(
          nextStatus
        )
      ) {
        throw ApiError.badRequest(
          `Cannot change copy status from ${copy.status} to ${nextStatus}`
        );
      }

      const oldStatus =
        copy.status;

      const book =
        await Book.findByPk(
          copy.bookId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      if (
        oldStatus ===
          'available' &&
        nextStatus ===
          'damaged'
      ) {
        copy.status =
          'damaged';

        await copy.save({
          transaction: t,
        });

        book.availableCopies =
          Math.max(
            0,
            book.availableCopies -
              1
          );

        await book.save({
          transaction: t,
        });

        emitInventoryChange(t);

        return copy;
      }

      if (
        nextStatus !==
        'available'
      ) {
        copy.status =
          nextStatus;

        await copy.save({
          transaction: t,
        });

        emitInventoryChange(t);

        return copy;
      }

      const fulfilled =
        await reservationService
          .tryFulfillNextReservation(
            copy.bookId,
            copy,
            t
          );

      if (fulfilled) {
        emitInventoryChange(t);

        return copy;
      }

      copy.status =
        'available';

      copy.reservedForUserId =
        null;

      await copy.save({
        transaction: t,
      });

      book.availableCopies =
        Math.min(
          book.totalCopies,
          book.availableCopies +
            1
        );

      await book.save({
        transaction: t,
      });

      emitInventoryChange(t);

      return copy;
    }
  );
};

const retireCopy = async (
  copyId
) => {
  return sequelize.transaction(
    async (t) => {
      const copy =
        await BookCopy.findByPk(
          copyId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!copy) {
        throw ApiError.notFound(
          'Copy not found'
        );
      }

      if (
        copy.status !==
        'available'
      ) {
        throw ApiError.badRequest(
          'Only an available copy can be retired — it must be returned first'
        );
      }

      copy.status =
        'lost';

      await copy.save({
        transaction: t,
      });

      const book =
        await Book.findByPk(
          copy.bookId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      book.totalCopies =
        Math.max(
          0,
          book.totalCopies -
            1
        );

      book.availableCopies =
        Math.max(
          0,
          book.availableCopies -
            1
        );

      await book.save({
        transaction: t,
      });

      emitInventoryChange(t);

      return copy;
    }
  );
};

module.exports = {
  addCopies,
  listCopiesForBook,
  updateCopyStatus,
  retireCopy,
  checkout,
  returnBook,
  markLoanLost,
  renew,
  listMyLoans,
  listAllRecords,
};