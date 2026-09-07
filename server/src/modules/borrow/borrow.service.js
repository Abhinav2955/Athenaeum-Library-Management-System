const { Op } = require('sequelize');

const {
  BookCopy,
  BorrowRecord,
  Book,
  User,
  Reservation,
  sequelize,
} = require('../../database/models');

const ApiError = require('../../utils/ApiError');

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

const LOAN_PERIOD_DAYS = 14;
const MAX_RENEWALS = 2;
const MAX_ACTIVE_LOANS_PER_USER = 5;

const addDays = (date, days) =>
  new Date(
    date.getTime() +
      days * 86400000
  );

/*
 * Transaction-level membership check.
 *
 * Members whose membership is suspended or expired
 * may still be allowed to log in depending on the
 * authentication policy, but they cannot borrow or
 * renew books.
 */
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

      book.totalCopies +=
        quantity;

      book.availableCopies +=
        quantity;

      await book.save({
        transaction: t,
      });

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

  /*
   * Members can borrow only for themselves.
   *
   * Staff can perform checkout for another member.
   */
  if (
    userId &&
    userId !==
      requestingUser.id &&
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

      /*
       * Part 2:
       *
       * Suspended / expired / otherwise inactive
       * membership cannot perform circulation.
       */
      assertActiveMembership(
        borrower
      );

      /*
       * Part 2:
       *
       * Do NOT rely only on the hourly overdue job.
       *
       * A loan is overdue if:
       *
       * status === overdue
       *
       * OR
       *
       * status is still active but dueAt has already
       * passed.
       */
      const overdueLoan =
        await BorrowRecord.findOne({
          where: {
            userId:
              borrowerId,

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
            userId:
              borrowerId,

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

      /*
       * Existing fine restriction remains active.
       */
      await fineService
        .assertCheckoutNotBlocked(
          borrowerId
        );

      /*
       * Prevent borrowing another physical copy
       * of the same title while one is already
       * checked out.
       */
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

      /*
       * Prefer an already-reserved physical copy
       * for this member.
       */
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

          await readyReservation.save(
            {
              transaction:
                t,
            }
          );

          copy.reservedForUserId =
            null;
        }
      }

      /*
       * If no reservation copy exists, obtain a
       * normally available physical copy.
       */
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

      /*
       * Part 1 inventory rule:
       *
       * reserved -> borrowed
       *
       * does not decrease availability again.
       */
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

      return record;
    }
  );
};

const returnBook = async (
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
        record.status ===
        'returned'
      ) {
        throw ApiError.badRequest(
          'This item was already returned'
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

      const fulfilled =
        await reservationService
          .tryFulfillNextReservation(
            record.copy.bookId,
            record.copy,
            t
          );

      if (!fulfilled) {
        record.copy.status =
          'available';

        await record.copy.save(
          {
            transaction: t,
          }
        );
      }

      const book =
        await Book.findByPk(
          record.copy.bookId,
          {
            transaction: t,

            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!fulfilled) {
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

      if (wasOverdue) {
        const fine =
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

      return {
        record,
        wasOverdue,
      };
    }
  );
};

const renew = async (
  recordId,
  requestingUser
) => {
  /*
   * Load borrower as well as physical copy because
   * renewal must validate the MEMBER whose loan
   * is being renewed.
   */
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

  /*
   * Part 2:
   *
   * Renewal belongs to the borrower.
   *
   * Even if an administrator performs the action,
   * a suspended or expired member should not receive
   * an extension.
   */
  if (record.borrower) {
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

  /*
   * Part 2 critical fix:
   *
   * The scheduler may not yet have changed
   *
   * active -> overdue.
   *
   * dueAt itself is the authoritative deadline.
   */
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

  /*
   * Existing rule:
   *
   * If somebody else is waiting for this title,
   * the current borrower cannot extend the loan.
   */
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

  if (query.status) {
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
        total: count,
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

  if (query.status) {
    where.status =
      query.status;
  }

  if (query.userId) {
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
        total: count,
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

      return copy;
    }
  );
};

module.exports = {
  addCopies,
  listCopiesForBook,
  retireCopy,
  checkout,
  returnBook,
  renew,
  listMyLoans,
  listAllRecords,
};