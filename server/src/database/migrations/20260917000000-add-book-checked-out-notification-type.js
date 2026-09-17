'use strict';

module.exports = {
  up: async (
    queryInterface,
    Sequelize
  ) => {
    await queryInterface.changeColumn(
      'notifications',
      'type',
      {
        type: Sequelize.ENUM(
          'due_soon',
          'overdue',
          'reservation_ready',
          'fine_issued',
          'book_checked_out'
        ),
        allowNull: false,
      }
    );
  },

  down: async (
    queryInterface,
    Sequelize
  ) => {
    await queryInterface.changeColumn(
      'notifications',
      'type',
      {
        type: Sequelize.ENUM(
          'due_soon',
          'overdue',
          'reservation_ready',
          'fine_issued'
        ),
        allowNull: false,
      }
    );
  },
};