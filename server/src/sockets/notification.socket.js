const {
  Server,
} = require('socket.io');

const env =
  require('../config/env');

const logger =
  require('../config/logger');

const {
  verifyAccessToken,
} = require('../utils/token');

const {
  User,
} = require('../database/models');

const {
  setIO,
} = require('./io');

const authenticateSocket =
  async (
    socket,
    next
  ) => {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error(
          'Authentication token missing'
        )
      );
    }

    let payload;

    try {
      payload =
        verifyAccessToken(
          token
        );
    } catch {
      return next(
        new Error(
          'Invalid or expired token'
        )
      );
    }

    let user;

    try {
      user =
        await User.findByPk(
          payload.sub
        );
    } catch (error) {
      logger.error(
        'Socket authentication failed',
        error
      );

      return next(
        new Error(
          'Authentication failed'
        )
      );
    }

    if (!user) {
      return next(
        new Error(
          'User no longer exists'
        )
      );
    }

    if (
      user.membershipStatus ===
      'suspended'
    ) {
      return next(
        new Error(
          'Account is suspended'
        )
      );
    }

    socket.userId =
      user.id;

    socket.userRole =
      user.role;

    return next();
  };

const initSocket = (
  httpServer
) => {
  const io =
    new Server(
      httpServer,
      {
        cors: {
          origin:
            env.CLIENT_ORIGIN,

          credentials:
            true,
        },
      }
    );

  io.use(
    authenticateSocket
  );

  io.on(
    'connection',
    (socket) => {
      socket.join(
        `user:${socket.userId}`
      );

      socket.join(
        'authenticated'
      );

      if (
        [
          'admin',
          'librarian',
        ].includes(
          socket.userRole
        )
      ) {
        socket.join(
          'staff'
        );
      }

      logger.debug(
        `Socket connected for user ${socket.userId}`
      );

      socket.on(
        'disconnect',
        () => {
          logger.debug(
            `Socket disconnected for user ${socket.userId}`
          );
        }
      );
    }
  );

  setIO(io);

  logger.info(
    '🔌 Socket.IO initialized'
  );

  return io;
};

module.exports = {
  initSocket,
};