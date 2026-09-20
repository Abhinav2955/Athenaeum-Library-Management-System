const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../../config/db');
const Book = require('./book.model');

class BookCopy extends Model {}

BookCopy.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    bookId: { type: DataTypes.UUID, allowNull: false, field: 'book_id' },
    barcode: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    shelfLocation: { type: DataTypes.STRING(50), allowNull: true, field: 'shelf_location' },
    status: {
      type: DataTypes.ENUM('available', 'borrowed', 'reserved', 'lost', 'damaged', 'under_repair'),
      allowNull: false,
      defaultValue: 'available',
    },
     reservedForUserId: { type: DataTypes.UUID, allowNull: true, field: 'reserved_for_user_id' },
  },
  { sequelize, modelName: 'BookCopy', tableName: 'book_copies' }
);

Book.hasMany(BookCopy, { foreignKey: 'bookId', as: 'copies' });
BookCopy.belongsTo(Book, { foreignKey: 'bookId', as: 'book' });

module.exports = BookCopy;