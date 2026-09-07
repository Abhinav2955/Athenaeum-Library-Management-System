const express =
  require('express');

const authenticate =
  require('../../middlewares/auth.middleware');

const authorize =
  require('../../middlewares/rbac.middleware');

const validate =
  require('../../middlewares/validate.middleware');

const controller =
  require('./member.controller');

const {
  searchMembersSchema,
} = require('./member.validation');

const router =
  express.Router();

/*
 * All member-management endpoints are
 * staff only.
 */
router.use(
  authenticate
);

router.use(
  authorize(
    'admin',
    'librarian'
  )
);

router.get(
  '/',
  validate(
    searchMembersSchema
  ),
  controller.searchMembers
);

module.exports =
  router;