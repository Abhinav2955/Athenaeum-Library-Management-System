const {
  DataTypes,
  Model,
} = require('sequelize');

const {
  sequelize,
} = require('../../config/db');

const User =
  require('./user.model');

const BorrowRecord =
  require('./borrowRecord.model');

class Notification extends Model {}

Notification.init(
  {
    id: {
      type:
        DataTypes.UUID,
      defaultValue:
        DataTypes.UUIDV4,
      primaryKey: true,
    },

    userId: {
      type:
        DataTypes.UUID,
      allowNull: false,
      field:
        'user_id',
    },

    type: {
      type:
        DataTypes.ENUM(
          'due_soon',
          'overdue',
          'reservation_ready',
          'fine_issued',
          'book_checked_out'
        ),
      allowNull: false,
    },

    message: {
      type:
        DataTypes.STRING(
          500
        ),
      allowNull: false,
    },

    borrowRecordId: {
      type:
        DataTypes.UUID,
      allowNull: true,
      field:
        'borrow_record_id',
    },

    readAt: {
      type:
        DataTypes.DATE,
      allowNull: true,
      field:
        'read_at',
    },
  },
  {
    sequelize,
    modelName:
      'Notification',
    tableName:
      'notifications',
  }
);

Notification.belongsTo(
  User,
  {
    foreignKey:
      'userId',
    as:
      'recipient',
  }
);

Notification.belongsTo(
  BorrowRecord,
  {
    foreignKey:
      'borrowRecordId',
    as:
      'borrowRecord',
  }
);

User.hasMany(
  Notification,
  {
    foreignKey:
      'userId',
    as:
      'notifications',
  }
);

module.exports =
  Notification;