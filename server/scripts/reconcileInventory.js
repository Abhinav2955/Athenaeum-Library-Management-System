require('dotenv').config();

const { Op } = require('sequelize');

const {
  sequelize,
  Book,
  BookCopy,
} = require('../src/database/models');

/*
 * One-time repair utility.
 *
 * This does NOT create or delete physical copies.
 *
 * It simply recalculates Book.totalCopies and
 * Book.availableCopies from the actual BookCopy
 * rows already stored in the database.
 */

const reconcileInventory =
  async () => {
    try {
      await sequelize.authenticate();

      console.log(
        'Database connected.'
      );

      console.log(
        'Starting inventory reconciliation...'
      );

      console.log('');

      const books =
        await Book.findAll({
          paranoid: false,
        });

      let corrected = 0;

      for (
        const book of books
      ) {
        /*
         * Current project semantics:
         *
         * lost copies have been retired from
         * active inventory.
         */
        const totalCopies =
          await BookCopy.count({
            where: {
              bookId:
                book.id,

              status: {
                [Op.ne]:
                  'lost',
              },
            },
          });

        /*
         * Only BookCopy rows with status
         * "available" count toward
         * Book.availableCopies.
         */
        const availableCopies =
          await BookCopy.count({
            where: {
              bookId:
                book.id,

              status:
                'available',
            },
          });

        const oldTotal =
          book.totalCopies;

        const oldAvailable =
          book.availableCopies;

        if (
          oldTotal !==
            totalCopies ||
          oldAvailable !==
            availableCopies
        ) {
          await book.update({
            totalCopies,
            availableCopies,
          });

          corrected += 1;

          console.log(
            `Fixed: ${book.title}`
          );

          console.log(
            `  totalCopies: ${oldTotal} -> ${totalCopies}`
          );

          console.log(
            `  availableCopies: ${oldAvailable} -> ${availableCopies}`
          );

          console.log('');
        }
      }

      console.log(
        'Inventory reconciliation complete.'
      );

      console.log(
        `Books corrected: ${corrected}`
      );
    } catch (error) {
      console.error(
        'Inventory reconciliation failed:',
        error
      );

      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  };

reconcileInventory();