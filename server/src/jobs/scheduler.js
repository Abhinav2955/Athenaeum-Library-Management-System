const cron =
  require('node-cron');

const {
  Op,
} = require('sequelize');

const logger =
  require('../config/logger');

const {
  BorrowRecord,
  BookCopy,
  Book,
  User,
} = require('../database/models');

const reservationService =
  require(
    '../modules/reservations/reservation.service'
  );

const notificationService =
  require(
    '../modules/notifications/notification.service'
  );

const {
  queueEmail,
} = require(
  './queues/email.queue'
);

const {
  emitDataChanged,
} = require('../sockets/io');

const DUE_SOON_WINDOW_HOURS =
  48;

const safelyQueueEmail =
  async (payload) => {
    try {
      await queueEmail(
        payload
      );

      return true;
    } catch (error) {
      logger.warn(
        'Could not queue notification email',
        {
          to:
            payload.to,

          subject:
            payload.subject,

          error:
            error.message,
        }
      );

      return false;
    }
  };

const buildReminderEmail =
  ({
    memberName,
    heading,
    message,
  }) => {
    const safeName =
      memberName ||
      'Library Member';

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>${heading}</h2>

        <p>Hello ${safeName},</p>

        <p>${message}</p>

        <p>
          Please sign in to Athenaeum Library to review your current loans.
        </p>

        <p style="margin-top: 24px;">
          Athenaeum Library
        </p>
      </div>
    `;
  };

const flagOverdueLoans =
  async () => {
    const now =
      new Date();

    const newlyOverdue =
      await BorrowRecord.findAll({
        where: {
          status:
            'active',

          dueAt: {
            [Op.lt]:
              now,
          },
        },

        include: [
          {
            model:
              BookCopy,

            as:
              'copy',

            include: [
              {
                model:
                  Book,

                as:
                  'book',

                attributes: [
                  'title',
                ],
              },
            ],
          },

          {
            model:
              User,

            as:
              'borrower',

            attributes: [
              'id',
              'name',
              'email',
            ],
          },
        ],
      });

    if (
      newlyOverdue.length ===
      0
    ) {
      return 0;
    }

    await BorrowRecord.update(
      {
        status:
          'overdue',
      },

      {
        where: {
          id:
            newlyOverdue.map(
              (record) =>
                record.id
            ),
        },
      }
    );

    const affectedUserIds =
      [
        ...new Set(
          newlyOverdue.map(
            (record) =>
              record.userId
          )
        ),
      ];

    for (
      const userId of
      affectedUserIds
    ) {
      emitDataChanged({
        resources: [
          'loans',
        ],
        userId,
      });
    }

    emitDataChanged({
      resources: [
        'loans',
        'reports',
      ],
      staff: true,
    });

    let notificationCount =
      0;

    for (
      const record of
      newlyOverdue
    ) {
      const alreadyNotified =
        await notificationService
          .hasExistingNotification(
            {
              userId:
                record.userId,

              type:
                'overdue',

              borrowRecordId:
                record.id,
            }
          );

      if (alreadyNotified) {
        continue;
      }

      const title =
        record.copy
          ?.book
          ?.title ||
        'A library book';

      const message =
        `"${title}" is overdue. Please return it as soon as possible.`;

      await notificationService
        .createNotification({
          userId:
            record.userId,

          type:
            'overdue',

          message,

          borrowRecordId:
            record.id,
        });

      notificationCount += 1;

      if (
        record.borrower
          ?.email
      ) {
        await safelyQueueEmail({
          to:
            record.borrower
              .email,

          subject:
            `Overdue book: ${title}`,

          html:
            buildReminderEmail(
              {
                memberName:
                  record
                    .borrower
                    .name,

                heading:
                  'Book overdue',

                message:
                  `"${title}" is now overdue. Please return it to the library as soon as possible.`,
              }
            ),
        });
      }
    }

    logger.info(
      `⏰ Flagged ${newlyOverdue.length} loan(s) as overdue; created ${notificationCount} overdue reminder(s)`
    );

    return newlyOverdue.length;
  };

const notifyDueSoon =
  async () => {
    const now =
      new Date();

    const reminderWindowEnd =
      new Date(
        now.getTime() +
          DUE_SOON_WINDOW_HOURS *
            60 *
            60 *
            1000
      );

    const dueSoonLoans =
      await BorrowRecord.findAll({
        where: {
          status:
            'active',

          dueAt: {
            [Op.between]: [
              now,
              reminderWindowEnd,
            ],
          },
        },

        include: [
          {
            model:
              BookCopy,

            as:
              'copy',

            include: [
              {
                model:
                  Book,

                as:
                  'book',

                attributes: [
                  'title',
                ],
              },
            ],
          },

          {
            model:
              User,

            as:
              'borrower',

            attributes: [
              'id',
              'name',
              'email',
            ],
          },
        ],
      });

    let notifiedCount =
      0;

    for (
      const record of
      dueSoonLoans
    ) {
      const currentWindowStart =
        new Date(
          new Date(
            record.dueAt
          ).getTime() -
            DUE_SOON_WINDOW_HOURS *
              60 *
              60 *
              1000
        );

      const alreadyNotified =
        await notificationService
          .hasExistingNotification(
            {
              userId:
                record.userId,

              type:
                'due_soon',

              borrowRecordId:
                record.id,

              createdAfter:
                currentWindowStart,
            }
          );

      if (alreadyNotified) {
        continue;
      }

      const title =
        record.copy
          ?.book
          ?.title ||
        'A library book';

      const dueAt =
        new Date(
          record.dueAt
        );

      const message =
        `"${title}" is due on ${dueAt.toLocaleDateString()}. Renew it early if you need more time.`;

      await notificationService
        .createNotification({
          userId:
            record.userId,

          type:
            'due_soon',

          message,

          borrowRecordId:
            record.id,
        });

      notifiedCount += 1;

      if (
        record.borrower
          ?.email
      ) {
        await safelyQueueEmail({
          to:
            record.borrower
              .email,

          subject:
            `Book due soon: ${title}`,

          html:
            buildReminderEmail(
              {
                memberName:
                  record
                    .borrower
                    .name,

                heading:
                  'Book due soon',

                message:
                  `"${title}" is due on ${dueAt.toLocaleDateString()}. Please return or renew it before the due date.`,
              }
            ),
        });
      }
    }

    if (
      notifiedCount > 0
    ) {
      logger.info(
        `⏰ Sent ${notifiedCount} due-soon reminder(s)`
      );
    }

    return notifiedCount;
  };

const expireReservationHolds =
  async () => {
    const count =
      await reservationService
        .expireStaleHolds();

    if (count > 0) {
      logger.info(
        `⏰ Expired ${count} stale reservation hold(s)`
      );
    }

    return count;
  };

const runMaintenanceSweep =
  async () => {
    const overdueCount =
      await flagOverdueLoans();

    const [
      expiredCount,
      dueSoonCount,
    ] =
      await Promise.all([
        expireReservationHolds(),
        notifyDueSoon(),
      ]);

    return {
      overdueCount,
      expiredCount,
      dueSoonCount,
    };
  };

const startScheduledJobs =
  () => {
    cron.schedule(
      '0 * * * *',

      async () => {
        try {
          await runMaintenanceSweep();
        } catch (error) {
          logger.error(
            'Scheduled maintenance sweep failed',
            {
              error:
                error.message,
            }
          );
        }
      }
    );

    logger.info(
      `⏰ Scheduled jobs registered (hourly: overdue detection, reservation expiry, ${DUE_SOON_WINDOW_HOURS}h due reminders)`
    );
  };

module.exports = {
  DUE_SOON_WINDOW_HOURS,
  startScheduledJobs,
  runMaintenanceSweep,
  flagOverdueLoans,
  expireReservationHolds,
  notifyDueSoon,
};