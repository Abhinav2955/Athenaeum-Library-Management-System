const express =
  require('express');

const authenticate =
  require('../../middlewares/auth.middleware');

const authorize =
  require('../../middlewares/rbac.middleware');

const validate =
  require('../../middlewares/validate.middleware');

const controller =
  require('./audit.controller');

const {
  listAuditLogsSchema,
} =
  require('./audit.validation');

const router =
  express.Router();


router.use(
  authenticate,
  authorize(
    'admin'
  )
);

router.get(
  '/',
  validate(
    listAuditLogsSchema
  ),
  controller.list
);

module.exports =
  router;