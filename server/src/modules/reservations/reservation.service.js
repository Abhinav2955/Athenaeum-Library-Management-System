const { Op } = require('sequelize');

const {
  Reservation,
  Book,
  BookCopy,
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

const HOLD_DURATION_HOURS = 48;

const addHours = (
  date,
  hours
) =>
  new Date(
    date.getTime() +
      hours * 3600000
  );

const createReservation = async (
  userId,
  bookId
) => {
  const book =
    await Book.findByPk(
      bookId
    );

  if (!book) {
    throw ApiError.notFound(
      'Book not found'
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
    });

  if (existing) {
    throw ApiError.conflict(
      'You already have an active reservation for this book'
    );
  }

  return Reservation.create({
    userId,
    bookId,
    requestedAt:
      new Date(),
    status:
      'waiting',
  });
};

/*
 * Called whenever a physical copy becomes free.
 *
 * If somebody is waiting:
 *
 * borrowed/reserved -> reserved
 *
 * The copy remains outside general availability.
 */
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
      return false;
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

    return true;
  };

const hasWaitingReservations =
  async (bookId) => {
    const count =
      await Reservation.count({
        where: {
          bookId,
          status:
            'waiting',
        },
      });

    return count > 0;
  };

/*
 * Cancel reservation.
 *
 * Important cases:
 *
 * WAITING:
 * no physical copy is attached.
 *
 * READY:
 * a physical copy is reserved.
 *
 * If another member is waiting, transfer the same
 * copy directly to that member.
 *
 * Otherwise:
 *
 * reserved -> available
 *
 * and availableCopies increases.
 */
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

        /*
         * Waiting reservations don't own a copy,
         * so there is nothing else to release.
         */
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

            /*
             * Try transferring this physical copy
             * directly to the next person.
             */
            const fulfilled =
              await tryFulfillNextReservation(
                reservation.bookId,
                copy,
                t
              );

            /*
             * Nobody else is waiting.
             *
             * reserved -> available
             */
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
          ],

          order: [
            [
              'requestedAt',
              'ASC',
            ],
          ],

          limit,
          offset,
        });

    return {
      reservations: rows,

      meta:
        buildPaginationMeta({
          page,
          limit,
          total: count,
        }),
    };
  };

/*
 * Expire ready reservations whose pickup window
 * has passed.
 *
 * Important inventory behavior:
 *
 * If another member is waiting:
 *
 * reserved -> reserved
 *
 * availableCopies unchanged.
 *
 *
 * If nobody is waiting:
 *
 * reserved -> available
 *
 * availableCopies + 1.
 */
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
          /*
           * Reload + lock inside the transaction.
           *
           * This protects against another request
           * fulfilling/cancelling the reservation
           * between the first query and now.
           */
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

          /*
           * Give it directly to the next waiting
           * member if one exists.
           */
          const fulfilled =
            await tryFulfillNextReservation(
              reservation.bookId,
              copy,
              t
            );

          /*
           * Nobody waiting.
           *
           * reserved -> available
           */
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