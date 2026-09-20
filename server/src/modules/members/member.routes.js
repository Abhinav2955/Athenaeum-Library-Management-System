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
  memberIdSchema,
  updateMembershipStatusSchema,
} = require('./member.validation');

const router =
  express.Router();


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


router.get(
  '/:id',
  validate(
    memberIdSchema
  ),
  controller.getMember
);


router.patch(
  '/:id/status',
  validate(
    updateMembershipStatusSchema
  ),
  controller.updateMembershipStatus
);

module.exports =
  router;