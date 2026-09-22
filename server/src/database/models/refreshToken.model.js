const {
  DataTypes,
  Model,
} = require('sequelize');

const {
  sequelize,
} = require('../../config/db');

const User =
  require('./user.model');

class RefreshToken extends Model {}

RefreshToken.init(
  {
    id: {
      type:
        DataTypes.UUID,

      defaultValue:
        DataTypes.UUIDV4,

      primaryKey:
        true,
    },

    userId: {
      type:
        DataTypes.UUID,

      allowNull:
        false,

      field:
        'user_id',
    },

    tokenHash: {
      type:
        DataTypes.STRING(
          255
        ),

      allowNull:
        false,

      field:
        'token_hash',
    },

    expiresAt: {
      type:
        DataTypes.DATE,

      allowNull:
        false,

      field:
        'expires_at',
    },

    revokedAt: {
      type:
        DataTypes.DATE,

      allowNull:
        true,

      field:
        'revoked_at',
    },

    replacedByTokenId: {
      type:
        DataTypes.UUID,

      allowNull:
        true,

      field:
        'replaced_by_token_id',
    },

    replacementTokenCiphertext: {
      type:
        DataTypes.TEXT,

      allowNull:
        true,

      field:
        'replacement_token_ciphertext',
    },

    replacementTokenExpiresAt: {
      type:
        DataTypes.DATE,

      allowNull:
        true,

      field:
        'replacement_token_expires_at',
    },

    userAgent: {
      type:
        DataTypes.STRING(
          255
        ),

      allowNull:
        true,

      field:
        'user_agent',
    },

    ipAddress: {
      type:
        DataTypes.STRING(
          64
        ),

      allowNull:
        true,

      field:
        'ip_address',
    },
  },
  {
    sequelize,

    modelName:
      'RefreshToken',

    tableName:
      'refresh_tokens',
  }
);

User.hasMany(
  RefreshToken,
  {
    foreignKey:
      'userId',

    as:
      'refreshTokens',
  }
);

RefreshToken.belongsTo(
  User,
  {
    foreignKey:
      'userId',

    as:
      'user',
  }
);

module.exports =
  RefreshToken;