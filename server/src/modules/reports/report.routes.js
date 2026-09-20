const express =
  require('express');

const controller =
  require('./report.controller');

const validate =
  require('../../middlewares/validate.middleware');

const authenticate =
  require('../../middlewares/auth.middleware');

const authorize =
  require('../../middlewares/rbac.middleware');

const {
  topBooksSchema,
  circulationStatsSchema,
} = require('./report.validation');

const router =
  express.Router();


router.use(
  authenticate,
  authorize(
    'admin',
    'librarian'
  )
);

router.get(
  '/dashboard',
  controller.dashboard
);

router.get(
  '/inventory-health',
  controller.inventoryHealth
);

router.get(
  '/top-books',
  validate(
    topBooksSchema
  ),
  controller.topBooks
);

router.get(
  '/overdue',
  controller.overdue
);

router.get(
  '/overdue/export',
  controller.exportOverdueCsv
);

router.get(
  '/inventory/export',
  controller.exportInventoryCsv
);

router.get(
  '/circulation',
  validate(
    circulationStatsSchema
  ),
  controller.circulation
);

router.get(
  '/fines-revenue',
  controller.fineRevenue
);

router.post(
  '/run-maintenance',
  controller.runMaintenance
);

module.exports =
  router;