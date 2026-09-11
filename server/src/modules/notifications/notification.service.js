const { Op } = require('sequelize');

const {
  Notification,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');

const {
  parsePagination,
  buildPaginationMeta,
} = require('../../utils/pagination');

const {
  getIO,
} = require('../../sockets/io');

const createNotification =
  async (
    {
      userId,
      type,
      message,
      borrowRecordId = null,
    },
    transaction
  ) => {
    const notification =
      await Notification.create(
        {
          userId,
          type,
          message,
          borrowRecordId,
        },
        {
          transaction,
        }
      );

   
    const io = getIO();

    if (io) {
      io.to(
        `user:${userId}`
      ).emit(
        'notification',
        {
          id:
            notification.id,

          type:
            notification.type,

          message:
            notification.message,

          createdAt:
            notification.createdAt,
        }
      );
    }

    return notification;
  };


const hasExistingNotification =
  async ({
    userId,
    type,
    borrowRecordId,
    createdAfter,
  }) => {
    const where = {
      userId,
      type,
      borrowRecordId,
    };

    if (createdAfter) {
      where.createdAt = {
        [Op.gte]:
          createdAfter,
      };
    }

    const count =
      await Notification.count({
        where,
      });

    return count > 0;
  };

const listMyNotifications =
  async (
    userId,
    query
  ) => {
    const {
      page,
      limit,
      offset,
    } =
      parsePagination(
        query,
        {
          defaultLimit: 20,
        }
      );

    const {
      rows,
      count,
    } =
      await Notification
        .findAndCountAll({
          where: {
            userId,
          },

          order: [
            [
              'createdAt',
              'DESC',
            ],
          ],

          limit,
          offset,
        });

    const unreadCount =
      await Notification.count({
        where: {
          userId,

          readAt: {
            [Op.is]:
              null,
          },
        },
      });

    return {
      notifications:
        rows,

      unreadCount,

      meta:
        buildPaginationMeta({
          page,
          limit,
          total:
            count,
        }),
    };
  };

const markAsRead =
  async (
    notificationId,
    userId
  ) => {
    const notification =
      await Notification.findByPk(
        notificationId
      );

    if (!notification) {
      throw ApiError.notFound(
        'Notification not found'
      );
    }

    if (
      notification.userId !==
      userId
    ) {
      throw ApiError.forbidden(
        'You can only mark your own notifications as read'
      );
    }

    if (
      !notification.readAt
    ) {
      notification.readAt =
        new Date();

      await notification.save();
    }

    return notification;
  };

const markAllAsRead =
  async (userId) => {
    const [count] =
      await Notification.update(
        {
          readAt:
            new Date(),
        },

        {
          where: {
            userId,

            readAt: {
              [Op.is]:
                null,
            },
          },
        }
      );

    return count;
  };

module.exports = {
  createNotification,
  hasExistingNotification,
  listMyNotifications,
  markAsRead,
  markAllAsRead,
};