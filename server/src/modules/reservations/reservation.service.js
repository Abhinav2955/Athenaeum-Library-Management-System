const { Op } = require('sequelize');

const {
  Reservation,
  Book,
  BookCopy,
  User,
  sequelize,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');

const {
  parsePagination,
  buildPaginationMeta,
} = require('../../utils/pagination');

const notificationService =
  require('../notifications/notification.service');

const {
  emitDataChanged,
} = require('../../sockets/io');

const HOLD_DURATION_HOURS = 48;

const addHours = (date, hours) =>
  new Date(
    date.getTime() +
      hours * 3600000
  );

const emitReservationChange = (
  userId,
  transaction = null
) => {
  emitDataChanged(
    {
      resources: [
        'reservations',
      ],
      userId,
    },
    transaction
  );

  emitDataChanged(
    {
      resources: [
        'reservations',
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

const createReservation = async (
  userId,
  bookId
) => {
  return sequelize.transaction(
    async (t) => {
      const member =
        await User.findByPk(
          userId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!member) {
        throw ApiError.notFound(
          'Member not found'
        );
      }

      const book =
        await Book.findByPk(
          bookId,
          {
            transaction: t,
            lock:
              t.LOCK.UPDATE,
          }
        );

      if (!book) {
        throw ApiError.notFound(
          'Book not found'
        );
      }

      if (
        book.availableCopies > 0
      ) {
        throw ApiError.badRequest(
          'This book is currently available and does not need a reservation'
        );
      }

      const existing =
        await Reservation.findOne({
          where: {
            userId,
            bookId,

            status: {
              [Op.in]: [
                'waiting',
                'ready',
              ],
            },
          },

          transaction: t,
        });

      if (existing) {
        throw ApiError.conflict(
          'You already have an active reservation for this book'
        );
      }

      const reservation =
        await Reservation.create(
          {
            userId,
            bookId,

            requestedAt:
              new Date(),

            status:
              'waiting',
          },
          {
            transaction: t,
          }
        );

      emitReservationChange(
        userId,
        t
      );

      return reservation;
    }
  );
};

const tryFulfillNextReservation =
  async (
    bookId,
    copy,
    transaction
  ) => {
    const next =
      await Reservation.findOne({
        where: {
          bookId,
          status:
            'waiting',
        },

        order: [
          [
            'requestedAt',
            'ASC',
          ],
        ],

        lock:
          transaction.LOCK.UPDATE,

        transaction,
      });

    if (!next) {
      return null;
    }

    const now =
      new Date();

    copy.status =
      'reserved';

    copy.reservedForUserId =
      next.userId;

    await copy.save({
      transaction,
    });

    next.copyId =
      copy.id;

    next.status =
      'ready';

    next.readyAt =
      now;

    next.expiresAt =
      addHours(
        now,
        HOLD_DURATION_HOURS
      );

    await next.save({
      transaction,
    });

    const book =
      await Book.findByPk(
        bookId,
        {
          attributes: [
            'title',
          ],

          transaction,
        }
      );

    await notificationService
      .createNotification(
        {
          userId:
            next.userId,

          type:
            'reservation_ready',

          message:
            `Your hold on "${book?.title || 'a book'}" is ready — pick it up within 48 hours.`,
        },

        transaction
      );

    emitReservationChange(
      next.userId,
      transaction
    );

    emitInventoryChange(
      transaction
    );

    return {
      reservationId:
        next.id,

      userId:
        next.userId,

      bookId:
        next.bookId,

      copyId:
        copy.id,
    };
  };

const hasWaitingReservations =
  async (
    bookId,
    transaction = null
  ) => {
    const count =
      await Reservation.count({
        where: {
          bookId,
          status:
            'waiting',
        },

        transaction,
      });

    return count > 0;
  };

const cancelReservation =
  async (
    id,
    requestingUser
  ) => {
    return sequelize.transaction(
      async (t) => {
        const reservation =
          await Reservation.findByPk(
            id,
            {
              transaction: t,

              lock:
                t.LOCK.UPDATE,
            }
          );

        if (!reservation) {
          throw ApiError.notFound(
            'Reservation not found'
          );
        }

        if (
          reservation.userId !==
            requestingUser.id &&
          ![
            'admin',
            'librarian',
          ].includes(
            requestingUser.role
          )
        ) {
          throw ApiError.forbidden(
            'You can only cancel your own reservation'
          );
        }

        if (
          ![
            'waiting',
            'ready',
          ].includes(
            reservation.status
          )
        ) {
          throw ApiError.badRequest(
            'Only waiting or ready reservations can be cancelled'
          );
        }

        const wasReady =
          reservation.status ===
          'ready';

        reservation.status =
          'cancelled';

        await reservation.save({
          transaction: t,
        });

        emitReservationChange(
          reservation.userId,
          t
        );

        if (
          wasReady &&
          reservation.copyId
        ) {
          const copy =
            await BookCopy.findByPk(
              reservation.copyId,
              {
                transaction:
                  t,

                lock:
                  t.LOCK.UPDATE,
              }
            );

          if (copy) {
            copy.reservedForUserId =
              null;

            const fulfilled =
              await tryFulfillNextReservation(
                reservation.bookId,
                copy,
                t
              );

            if (!fulfilled) {
              copy.status =
                'available';

              await copy.save({
                transaction: t,
              });

              const book =
                await Book.findByPk(
                  reservation.bookId,
                  {
                    transaction:
                      t,

                    lock:
                      t.LOCK.UPDATE,
                  }
                );

              if (book) {
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

              emitInventoryChange(
                t
              );
            }
          }
        }

        return reservation;
      }
    );
  };

const listMyReservations =
  async (
    userId,
    query
  ) => {
    const {
      page,
      limit,
      offset,
    } =
      parsePagination(query);

    const {
      rows,
      count,
    } =
      await Reservation
        .findAndCountAll({
          where: {
            userId,
          },

          include: [
            {
              model:
                Book,

              as: 'book',
            },

            {
              model:
                BookCopy,

              as: 'heldCopy',

              attributes: [
                'id',
                'barcode',
                'shelfLocation',
                'status',
              ],
            },
          ],

          order: [
            [
              'requestedAt',
              'DESC',
            ],
          ],

          limit,
          offset,
        });

    const withPosition =
      await Promise.all(
        rows.map(
          async (reservation) => {
            if (
              reservation.status !==
              'waiting'
            ) {
              return {
                ...reservation.toJSON(),

                queuePosition:
                  null,
              };
            }

            const ahead =
              await Reservation.count({
                where: {
                  bookId:
                    reservation.bookId,

                  status:
                    'waiting',

                  requestedAt: {
                    [Op.lt]:
                      reservation.requestedAt,
                  },
                },
              });

            return {
              ...reservation.toJSON(),

              queuePosition:
                ahead + 1,
            };
          }
        )
      );

    return {
      reservations:
        withPosition,

      meta:
        buildPaginationMeta({
          page,
          limit,
          total: count,
        }),
    };
  };

const listAllReservations =
  async (query) => {
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

    if (query.bookId) {
      where.bookId =
        query.bookId;
    }

    const {
      rows,
      count,
    } =
      await Reservation
        .findAndCountAll({
          where,

          include: [
            {
              model:
                Book,

              as: 'book',
            },

            {
              model:
                User,

              as: 'member',

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

              as: 'heldCopy',

              attributes: [
                'id',
                'barcode',
                'shelfLocation',
                'status',
              ],
            },
          ],

          order: [
            [
              'requestedAt',
              'ASC',
            ],
          ],

          limit,
          offset,

          distinct: true,
        });

    const withPosition =
      await Promise.all(
        rows.map(
          async (reservation) => {
            if (
              reservation.status !==
              'waiting'
            ) {
              return {
                ...reservation.toJSON(),

                queuePosition:
                  null,
              };
            }

            const ahead =
              await Reservation.count({
                where: {
                  bookId:
                    reservation.bookId,

                  status:
                    'waiting',

                  requestedAt: {
                    [Op.lt]:
                      reservation.requestedAt,
                  },
                },
              });

            return {
              ...reservation.toJSON(),

              queuePosition:
                ahead + 1,
            };
          }
        )
      );

    return {
      reservations:
        withPosition,

      meta:
        buildPaginationMeta({
          page,
          limit,
          total: count,
        }),
    };
  };

const expireStaleHolds =
  async () => {
    const candidates =
      await Reservation.findAll({
        where: {
          status:
            'ready',

          expiresAt: {
            [Op.lt]:
              new Date(),
          },
        },
      });

    let expiredCount = 0;

    for (
      const candidate of
      candidates
    ) {
      await sequelize.transaction(
        async (t) => {
          const reservation =
            await Reservation.findByPk(
              candidate.id,
              {
                transaction:
                  t,

                lock:
                  t.LOCK.UPDATE,
              }
            );

          if (!reservation) {
            return;
          }

          if (
            reservation.status !==
            'ready'
          ) {
            return;
          }

          if (
            !reservation.expiresAt ||
            reservation.expiresAt >=
              new Date()
          ) {
            return;
          }

          reservation.status =
            'expired';

          await reservation.save({
            transaction: t,
          });

          expiredCount += 1;

          emitReservationChange(
            reservation.userId,
            t
          );

          if (
            !reservation.copyId
          ) {
            return;
          }

          const copy =
            await BookCopy.findByPk(
              reservation.copyId,
              {
                transaction:
                  t,

                lock:
                  t.LOCK.UPDATE,
              }
            );

          if (!copy) {
            return;
          }

          copy.reservedForUserId =
            null;

          const fulfilled =
            await tryFulfillNextReservation(
              reservation.bookId,
              copy,
              t
            );

          if (!fulfilled) {
            copy.status =
              'available';

            await copy.save({
              transaction: t,
            });

            const book =
              await Book.findByPk(
                reservation.bookId,
                {
                  transaction:
                    t,

                  lock:
                    t.LOCK.UPDATE,
                }
              );

            if (book) {
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

            emitInventoryChange(
              t
            );
          }
        }
      );
    }

    return expiredCount;
  };

module.exports = {
  createReservation,
  tryFulfillNextReservation,
  hasWaitingReservations,
  cancelReservation,
  listMyReservations,
  listAllReservations,
  expireStaleHolds,
};