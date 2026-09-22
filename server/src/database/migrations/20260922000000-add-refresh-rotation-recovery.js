'use strict';

module.exports = {
  up: async (
    queryInterface,
    Sequelize
  ) => {
    await queryInterface.addColumn(
      'refresh_tokens',
      'replacement_token_ciphertext',
      {
        type:
          Sequelize.TEXT,
        allowNull:
          true,
      }
    );

    await queryInterface.addColumn(
      'refresh_tokens',
      'replacement_token_expires_at',
      {
        type:
          Sequelize.DATE,
        allowNull:
          true,
      }
    );
  },

  down: async (
    queryInterface
  ) => {
    await queryInterface.removeColumn(
      'refresh_tokens',
      'replacement_token_expires_at'
    );

    await queryInterface.removeColumn(
      'refresh_tokens',
      'replacement_token_ciphertext'
    );
  },
};