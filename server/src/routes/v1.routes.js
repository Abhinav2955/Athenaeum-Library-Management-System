const express =
  require('express');

const authRoutes =
  require('../modules/auth/auth.routes');

const bookRoutes =
  require('../modules/books/book.routes');

const borrowRoutes =
  require('../modules/borrow/borrow.routes');

const reservationRoutes =
  require('../modules/reservations/reservation.routes');

const fineRoutes =
  require('../modules/fines/fine.routes');

const reportRoutes =
  require('../modules/reports/report.routes');

const notificationRoutes =
  require('../modules/notifications/notification.routes');

const auditRoutes =
  require('../modules/audit/audit.routes');

const userRoutes =
  require('../modules/users/user.routes');

const router =
  express.Router();

router.use(
  '/auth',
  authRoutes
);

router.use(
  '/books',
  bookRoutes
);

router.use(
  '/borrow',
  borrowRoutes
);

router.use(
  '/reservations',
  reservationRoutes
);

router.use(
  '/fines',
  fineRoutes
);

router.use(
  '/reports',
  reportRoutes
);

router.use(
  '/notifications',
  notificationRoutes
);

router.use(
  '/audit',
  auditRoutes
);

router.use(
  '/users',
  userRoutes
);

module.exports =
  router;