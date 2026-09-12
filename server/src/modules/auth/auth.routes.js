const express =
  require('express');

const controller =
  require('./auth.controller');

const validate =
  require('../../middlewares/validate.middleware');

const authenticate =
  require('../../middlewares/auth.middleware');

const {
  authLimiter,
  verificationResendLimiter,
} = require('../../middlewares/rateLimiter.middleware');

const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.validation');

const router =
  express.Router();

router.post(
  '/register',
  authLimiter,
  validate(
    registerSchema
  ),
  controller.register
);

router.post(
  '/login',
  authLimiter,
  validate(
    loginSchema
  ),
  controller.login
);

router.post(
  '/refresh',
  authLimiter,
  controller.refresh
);

router.post(
  '/logout',
  controller.logout
);

router.get(
  '/me',
  authenticate,
  controller.me
);

router.post(
  '/change-password',
  authenticate,
  validate(
    changePasswordSchema
  ),
  controller.changePassword
);

router.post(
  '/verify-email',
  authLimiter,
  validate(
    verifyEmailSchema
  ),
  controller.verifyEmail
);

/*
 * No authenticate middleware here.
 *
 * An unverified account intentionally has no
 * authenticated session.
 */
router.post(
  '/resend-verification',
  verificationResendLimiter,
  validate(
    resendVerificationSchema
  ),
  controller.resendVerification
);

router.post(
  '/forgot-password',
  authLimiter,
  validate(
    forgotPasswordSchema
  ),
  controller.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  validate(
    resetPasswordSchema
  ),
  controller.resetPassword
);

module.exports =
  router;