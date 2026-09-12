const {
  sequelize,
} = require('../../config/db');

const User =
  require('./user.model');

const RefreshToken =
  require('./refreshToken.model');

const Book =
  require('./book.model');

const Author =
  require('./author.model');

const Category =
  require('./category.model');

const BookCopy =
  require('./bookCopy.model');

const BorrowRecord =
  require('./borrowRecord.model');

const Reservation =
  require('./reservation.model');

const Fine =
  require('./fine.model');

const Notification =
  require('./notification.model');

const AuditLog =
  require('./auditLog.model');

module.exports = {
  sequelize,

  User,
  RefreshToken,

  Book,
  Author,
  Category,
  BookCopy,

  BorrowRecord,
  Reservation,

  Fine,
  Notification,

  AuditLog,
};