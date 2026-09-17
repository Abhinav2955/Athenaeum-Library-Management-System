const {
  Op,
} = require('sequelize');

const {
  User,
  RefreshToken,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');

const {
  emitDataChanged,
} = require('../../sockets/io');

const safeUser = (
  user
) => {
  if (!user) {
    return null;
  }

  return user.toSafeJSON();
};

const emitUserChange = (
  userId
) => {
  emitDataChanged(
    {
      resources: [
        'profile',
        'users',
      ],
      userId,
    }
  );

  emitDataChanged(
    {
      resources: [
        'users',
        'reports',
      ],
      staff: true,
    }
  );
};

const listUsers =
  async ({
    page = 1,
    limit = 20,
    search,
    role,
    membershipStatus,
  }) => {
    const where = {};

    if (search) {
      where[
        Op.or
      ] = [
        {
          name: {
            [Op.like]:
              `%${search}%`,
          },
        },
        {
          email: {
            [Op.like]:
              `%${search}%`,
          },
        },
      ];
    }

    if (role) {
      where.role =
        role;
    }

    if (
      membershipStatus
    ) {
      where.membershipStatus =
        membershipStatus;
    }

    const offset =
      (page - 1) *
      limit;

    const {
      rows,
      count,
    } =
      await User
        .findAndCountAll({
          where,

          attributes: [
            'id',
            'name',
            'email',
            'phone',
            'role',
            'membershipStatus',
            'isEmailVerified',
            'createdAt',
            'updatedAt',
          ],

          order: [
            [
              'createdAt',
              'DESC',
            ],
          ],

          limit,
          offset,
        });

    return {
      users:
        rows,

      meta: {
        page,
        limit,
        total:
          count,
        totalPages:
          Math.max(
            1,
            Math.ceil(
              count /
                limit
            )
          ),
      },
    };
  };

const getUserById =
  async (
    userId
  ) => {
    const user =
      await User.findByPk(
        userId
      );

    if (!user) {
      throw ApiError.notFound(
        'User not found'
      );
    }

    return safeUser(
      user
    );
  };

const updateMembershipStatus =
  async ({
    targetUserId,
    actorUserId,
    membershipStatus,
  }) => {
    if (
      targetUserId ===
      actorUserId
    ) {
      throw ApiError.badRequest(
        'You cannot change your own membership status'
      );
    }

    const user =
      await User.findByPk(
        targetUserId
      );

    if (!user) {
      throw ApiError.notFound(
        'User not found'
      );
    }

    if (
      user.membershipStatus ===
      membershipStatus
    ) {
      return safeUser(
        user
      );
    }

    user.membershipStatus =
      membershipStatus;

    await user.save();

    if (
      membershipStatus !==
      'active'
    ) {
      await RefreshToken.update(
        {
          revokedAt:
            new Date(),
        },
        {
          where: {
            userId:
              user.id,
            revokedAt: {
              [Op.is]:
                null,
            },
          },
        }
      );
    }

    emitUserChange(
      user.id
    );

    return safeUser(
      user
    );
  };

const updateRole =
  async ({
    targetUserId,
    actorUserId,
    role,
  }) => {
    if (
      targetUserId ===
      actorUserId
    ) {
      throw ApiError.badRequest(
        'You cannot change your own role'
      );
    }

    const user =
      await User.findByPk(
        targetUserId
      );

    if (!user) {
      throw ApiError.notFound(
        'User not found'
      );
    }

    if (
      user.role ===
      role
    ) {
      return safeUser(
        user
      );
    }

    if (
      user.role ===
        'admin' &&
      role !==
        'admin'
    ) {
      const adminCount =
        await User.count({
          where: {
            role:
              'admin',
          },
        });

      if (
        adminCount <= 1
      ) {
        throw ApiError.badRequest(
          'The final admin account cannot be demoted'
        );
      }
    }

    user.role =
      role;

    await user.save();

    await RefreshToken.update(
      {
        revokedAt:
          new Date(),
      },
      {
        where: {
          userId:
            user.id,
          revokedAt: {
            [Op.is]:
              null,
          },
        },
      }
    );

    emitUserChange(
      user.id
    );

    return safeUser(
      user
    );
  };

module.exports = {
  listUsers,
  getUserById,
  updateMembershipStatus,
  updateRole,
};