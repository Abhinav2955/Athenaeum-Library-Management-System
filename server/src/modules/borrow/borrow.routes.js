const express =
  require('express');

const controller =
  require('./borrow.controller');

const validate =
  require('../../middlewares/validate.middleware');

const authenticate =
  require('../../middlewares/auth.middleware');

const authorize =
  require('../../middlewares/rbac.middleware');

const {
  checkoutSchema,
  addCopySchema,
  recordIdSchema,
  returnBookSchema,
  updateCopyStatusSchema,
  listBorrowRecordsSchema,
  listCopiesSchema,
} = require('./borrow.validation');

const router =
  express.Router();

router.use(
  authenticate
);

/*
 * Checkout.
 */
router.post(
  '/checkout',
  validate(
    checkoutSchema
  ),
  controller.checkout
);

/*
 * Staff return.
 *
 * body:
 *
 * {
 *   condition: "good"
 * }
 *
 * OR
 *
 * {
 *   condition: "damaged"
 * }
 */
router.post(
  '/:id/return',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    returnBookSchema
  ),
  controller.returnBook
);

/*
 * Staff can declare a checked-out loan lost.
 */
router.post(
  '/:id/lost',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    recordIdSchema
  ),
  controller.markLoanLost
);

router.post(
  '/:id/renew',
  validate(
    recordIdSchema
  ),
  controller.renew
);

router.get(
  '/me',
  controller.myLoans
);

router.get(
  '/',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    listBorrowRecordsSchema
  ),
  controller.allRecords
);

/*
 * Physical copy management.
 */
router.post(
  '/copies',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    addCopySchema
  ),
  controller.addCopies
);

router.get(
  '/copies',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    listCopiesSchema
  ),
  controller.listCopies
);

/*
 * Repair / condition lifecycle.
 */
router.patch(
  '/copies/:id/status',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    updateCopyStatusSchema
  ),
  controller.updateCopyStatus
);

router.post(
  '/copies/:id/retire',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    recordIdSchema
  ),
  controller.retireCopy
);

module.exports =
  router;