const asyncHandler =
  require('../../utils/asyncHandler');

const ApiResponse =
  require('../../utils/ApiResponse');

const authService =
  require('./auth.service');

const env =
  require('../../config/env');

const REFRESH_COOKIE_NAME =
  'lms_refresh_token';

const REFRESH_COOKIE_MAX_AGE =
  7 *
  24 *
  60 *
  60 *
  1000;

const refreshCookieOptions = {
  httpOnly:
    true,

  secure:
    env.NODE_ENV ===
    'production',

  sameSite:
    env.NODE_ENV ===
    'production'
      ? 'none'
      : 'lax',

  path:
    '/api/v1/auth',

  maxAge:
    REFRESH_COOKIE_MAX_AGE,
};

const safeUser = (
  user
) => {
  if (!user) {
    return null;
  }

  const data =
    typeof user.toJSON ===
    'function'
      ? user.toJSON()
      : { ...user };

  delete data.passwordHash;

  delete data.emailVerificationTokenHash;
  delete data.emailVerificationExpires;

  delete data.passwordResetTokenHash;
  delete data.passwordResetExpires;

  delete data.failedLoginAttempts;
  delete data.lockedUntil;

  return data;
};

const getMeta = (
  req
) => ({
  userAgent:
    req.get(
      'user-agent'
    ) || null,

  ipAddress:
    req.ip || null,
});

const setRefreshCookie = (
  res,
  refreshToken
) => {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    refreshCookieOptions
  );
};

const clearRefreshCookie = (
  res
) => {
  res.clearCookie(
    REFRESH_COOKIE_NAME,
    {
      httpOnly:
        true,

      secure:
        env.NODE_ENV ===
        'production',

      sameSite:
        env.NODE_ENV ===
        'production'
          ? 'none'
          : 'lax',

      path:
        '/api/v1/auth',
    }
  );
};

const register =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const user =
        await authService
          .register(
            req.body
          );

      
      return new ApiResponse(
        201,
        {
          user:
            safeUser(user),

          requiresVerification:
            true,
        },
        'Account created. Please verify your email before signing in.'
      ).send(res);
    }
  );

const login =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await authService
          .login(
            req.body,
            getMeta(req)
          );

      setRefreshCookie(
        res,
        result.refreshToken
      );

      return new ApiResponse(
        200,
        {
          user:
            safeUser(
              result.user
            ),

          accessToken:
            result.accessToken,
        },
        'Signed in successfully'
      ).send(res);
    }
  );

/*
 * Verification now logs the member in.
 */
const verifyEmail =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await authService
          .verifyEmail(
            req.body.token,
            getMeta(req)
          );

      setRefreshCookie(
        res,
        result.refreshToken
      );

      return new ApiResponse(
        200,
        {
          user:
            safeUser(
              result.user
            ),

          accessToken:
            result.accessToken,
        },
        'Email verified successfully'
      ).send(res);
    }
  );

const resendVerification =
  asyncHandler(
    async (
      req,
      res
    ) => {
      await authService
        .resendVerificationEmail(
          req.body.email
        );

      /*
       * Generic response prevents account
       * enumeration.
       */
      return new ApiResponse(
        200,
        null,
        'If an unverified account exists for that email, a verification email has been sent.'
      ).send(res);
    }
  );

const refresh =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const rawToken =
        req.cookies?.[
          REFRESH_COOKIE_NAME
        ];

      const result =
        await authService
          .refresh(
            rawToken,
            getMeta(req)
          );

      setRefreshCookie(
        res,
        result.refreshToken
      );

      return new ApiResponse(
        200,
        {
          user:
            safeUser(
              result.user
            ),

          accessToken:
            result.accessToken,
        },
        'Session refreshed'
      ).send(res);
    }
  );

const logout =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const rawToken =
        req.cookies?.[
          REFRESH_COOKIE_NAME
        ];

      await authService
        .logout(
          rawToken
        );

      clearRefreshCookie(
        res
      );

      return new ApiResponse(
        200,
        null,
        'Signed out successfully'
      ).send(res);
    }
  );

const me =
  asyncHandler(
    async (
      req,
      res
    ) => {
      return new ApiResponse(
        200,
        safeUser(
          req.user
        )
      ).send(res);
    }
  );

const changePassword =
  asyncHandler(
    async (
      req,
      res
    ) => {
      await authService
        .changePassword(
          req.user.id,
          req.body.currentPassword,
          req.body.newPassword
        );

      clearRefreshCookie(
        res
      );

      return new ApiResponse(
        200,
        null,
        'Password changed. Please sign in again.'
      ).send(res);
    }
  );

const forgotPassword =
  asyncHandler(
    async (
      req,
      res
    ) => {
      await authService
        .forgotPassword(
          req.body.email
        );

      return new ApiResponse(
        200,
        null,
        'If an account exists for that email, a password reset message has been sent.'
      ).send(res);
    }
  );

const resetPassword =
  asyncHandler(
    async (
      req,
      res
    ) => {
      await authService
        .resetPassword(
          req.body.token,
          req.body.password
        );

      clearRefreshCookie(
        res
      );

      return new ApiResponse(
        200,
        null,
        'Password reset successfully. Please sign in.'
      ).send(res);
    }
  );

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};