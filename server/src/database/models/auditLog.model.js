const {
  DataTypes,
  Model,
} = require('sequelize');

const {
  sequelize,
} = require('../../config/db');

const User =
  require('./user.model');

class AuditLog extends Model {}

AuditLog.init(
  {
    id: {
      type:
        DataTypes.UUID,

      defaultValue:
        DataTypes.UUIDV4,

      primaryKey:
        true,
    },

    actorId: {
      type:
        DataTypes.UUID,

      allowNull:
        false,

      field:
        'actor_id',
    },

    action: {
      type:
        DataTypes.STRING(80),

      allowNull:
        false,
    },

    entity: {
      type:
        DataTypes.STRING(80),

      allowNull:
        false,
    },

    entityId: {
      type:
        DataTypes.STRING(100),

      allowNull:
        true,

      field:
        'entity_id',
    },

    metadataJson: {
      type:
        DataTypes.JSON,

      allowNull:
        true,

      field:
        'metadata_json',
    },
  },

  {
    sequelize,

    modelName:
      'AuditLog',

    tableName:
      'audit_logs',

    updatedAt:
      false,

    createdAt:
      'created_at',

    indexes: [
      {
        fields: [
          'actor_id',
        ],
      },

      {
        fields: [
          'action',
        ],
      },

      {
        fields: [
          'entity',
        ],
      },

      {
        fields: [
          'created_at',
        ],
      },
    ],
  }
);

AuditLog.belongsTo(
  User,
  {
    foreignKey:
      'actorId',

    as:
      'actor',
  }
);

User.hasMany(
  AuditLog,
  {
    foreignKey:
      'actorId',

    as:
      'auditLogs',
  }
);

module.exports =
  AuditLog;