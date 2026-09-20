const { Op } = require('sequelize');

const {
  User,
  BorrowRecord,
  BookCopy,
  Book,
  Reservation,
  Fine,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');


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
        'role',
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


const getMemberById = async (
  memberId
) => {
  const member =
    await User.findOne({
      where: {
        id: memberId,
        role: 'member',
      },

      attributes: [
        'id',
        'name',
        'email',
        'phone',
        'role',
        'membershipStatus',
        'isEmailVerified',
        'createdAt',
      ],
    });

  if (!member) {
    throw ApiError.notFound(
      'Member not found'
    );
  }

  const now =
    new Date();

  
  const activeLoans =
    await BorrowRecord.count({
      where: {
        userId:
          memberId,

        status:
          'active',

        dueAt: {
          [Op.gte]:
            now,
        },
      },
    });

  
  const overdueLoans =
    await BorrowRecord.count({
      where: {
        userId:
          memberId,

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
                now,
            },
          },
        ],
      },
    });

  const totalLoans =
    await BorrowRecord.count({
      where: {
        userId:
          memberId,
      },
    });

  const activeReservations =
    await Reservation.count({
      where: {
        userId:
          memberId,

        status: {
          [Op.in]: [
            'waiting',
            'ready',
          ],
        },
      },
    });

  const pendingFineRows =
    await Fine.findAll({
      where: {
        userId:
          memberId,

        status:
          'pending',
      },

      attributes: [
        'amount',
      ],
    });

  const pendingFineBalance =
    pendingFineRows.reduce(
      (total, fine) =>
        total +
        Number(
          fine.amount || 0
        ),
      0
    );

  
  const recentLoans =
    await BorrowRecord.findAll({
      where: {
        userId:
          memberId,
      },

      include: [
        {
          model:
            BookCopy,

          as: 'copy',

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

              as: 'book',

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
          'borrowedAt',
          'DESC',
        ],
      ],

      limit: 10,
    });

  
  const reservations =
    await Reservation.findAll({
      where: {
        userId:
          memberId,

        status: {
          [Op.in]: [
            'waiting',
            'ready',
          ],
        },
      },

      include: [
        {
          model:
            Book,

          as: 'book',

          attributes: [
            'id',
            'title',
            'isbn',
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
          ],
        },
      ],

      order: [
        [
          'requestedAt',
          'ASC',
        ],
      ],
    });

  return {
    member:
      member.toSafeJSON(),

    summary: {
      activeLoans,
      overdueLoans,
      totalLoans,
      activeReservations,
      pendingFineBalance,
    },

    recentLoans,
    reservations,
  };
};


const updateMembershipStatus =
  async (
    memberId,
    membershipStatus
  ) => {
    const member =
      await User.findOne({
        where: {
          id: memberId,
          role: 'member',
        },
      });

    if (!member) {
      throw ApiError.notFound(
        'Member not found'
      );
    }

    if (
      member.membershipStatus ===
      membershipStatus
    ) {
      return member.toSafeJSON();
    }

    member.membershipStatus =
      membershipStatus;

    await member.save();

    return member.toSafeJSON();
  };

module.exports = {
  searchMembers,
  getMemberById,
  updateMembershipStatus,
};