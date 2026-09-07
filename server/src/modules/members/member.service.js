const { Op } = require('sequelize');

const {
  User,
} = require('../../database/models');

const searchMembers = async ({
  search,
  limit = 10,
}) => {
  const where = {
    role: 'member',
  };

  if (search) {
    where[Op.or] = [
      {
        name: {
          [Op.like]: `%${search}%`,
        },
      },

      {
        email: {
          [Op.like]: `%${search}%`,
        },
      },

      {
        phone: {
          [Op.like]: `%${search}%`,
        },
      },
    ];
  }

  const users =
    await User.findAll({
      where,

      attributes: [
        'id',
        'name',
        'email',
        'phone',
        'membershipStatus',
        'isEmailVerified',
        'createdAt',
      ],

      order: [
        ['name', 'ASC'],
      ],

      limit,
    });

  return users.map(
    (user) =>
      user.toSafeJSON()
  );
};

module.exports = {
  searchMembers,
};