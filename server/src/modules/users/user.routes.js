const express =
  require('express');

const authenticate =
  require('../../middlewares/auth.middleware');

const authorize =
  require('../../middlewares/rbac.middleware');

const validate =
  require('../../middlewares/validate.middleware');

const controller =
  require('./user.controller');

const {
  listUsersSchema,
  userIdSchema,
  membershipStatusSchema,
  roleSchema,
} =
  require('./user.validation');

const router =
  express.Router();

router.use(
  authenticate
);

router.get(
  '/',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    listUsersSchema
  ),
  controller.list
);

router.get(
  '/:id',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    userIdSchema
  ),
  controller.getById
);

router.patch(
  '/:id/membership',
  authorize(
    'admin',
    'librarian'
  ),
  validate(
    membershipStatusSchema
  ),
  controller.updateMembershipStatus
);

router.patch(
  '/:id/role',
  authorize(
    'admin'
  ),
  validate(
    roleSchema
  ),
  controller.updateRole
);

module.exports =
  router;