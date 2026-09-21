const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');

const {
  User,
  RefreshToken,
  sequelize,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');

const env =
  require('../../config/env');

const logger =
  require('../../config/logger');

const {
  queueEmail,
} = require('../../jobs/queues/email.queue');

const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../../utils/token');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS =
  15 * 60 * 1000;
const VERIFICATION_TOKEN_EXPIRY_MS =
  24 * 60 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS =
  60 * 1000;
const RESET_TOKEN_EXPIRY_MS =
  60 * 60 * 1000;

const escapeHtml =
  (value) =>
    String(
      value ?? ''
    ).replace(
      /[&<>"']/g,
      (character) => {
        const entities = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        };

        return entities[
          character
        ];
      }
    );

const msFromExpiry =
  (expiresIn) => {
    const match =
      /^(\d+)([smhd])$/.exec(
        expiresIn
      );

    if (!match) {
      return (
        15 *
        60 *
        1000
      );
    }

    const value =
      Number(
        match[1]
      );

    const multiplier = {
      s: 1000,
      m:
        60 *
        1000,
      h:
        60 *
        60 *
        1000,
      d:
        24 *
        60 *
        60 *
        1000,
    }[match[2]];

    return (
      value *
      multiplier
    );
  };

const withTimeout =
  (promise, ms) =>
    new Promise(
      (
        resolve,
        reject
      ) => {
        const timer =
          setTimeout(
            () => {
              reject(
                new Error(
                  'Email queue timed out'
                )
              );
            },
            ms
          );

        Promise.resolve(
          promise
        )
          .then(
            (result) => {
              clearTimeout(
                timer
              );

              resolve(
                result
              );
            }
          )
          .catch(
            (error) => {
              clearTimeout(
                timer
              );

              reject(
                error
              );
            }
          );
      }
    );

const issueTokenPair =
  async (
    user,
    meta = {},
    transaction = null
  ) => {
    const accessToken =
      signAccessToken(
        user
      );

    const refreshToken =
      signRefreshToken(
        user
      );

    const storedRefreshToken =
      await RefreshToken.create(
        {
          userId:
            user.id,

          tokenHash:
            hashToken(
              refreshToken
            ),

          expiresAt:
            new Date(
              Date.now() +
                msFromExpiry(
                  env.JWT_REFRESH_EXPIRES_IN
                )
            ),

          userAgent:
            meta.userAgent ||
            null,

          ipAddress:
            meta.ipAddress ||
            null,
        },
        {
          transaction,
        }
      );

    return {
      accessToken,
      refreshToken,
      storedRefreshToken,
    };
  };

const revokeActiveRefreshTokens =
  async (
    userId,
    transaction
  ) => {
    await RefreshToken.update(
      {
        revokedAt:
          new Date(),
      },
      {
        where: {
          userId,

          revokedAt: {
            [Op.is]:
              null,
          },
        },

        transaction,
      }
    );
  };

const sendVerificationEmail =
  async (user) => {
    const rawToken =
      crypto
        .randomBytes(32)
        .toString(
          'hex'
        );

    user.emailVerificationTokenHash =
      hashToken(
        rawToken
      );

    user.emailVerificationExpires =
      new Date(
        Date.now() +
          VERIFICATION_TOKEN_EXPIRY_MS
      );

    await user.save();

    const link =
      `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(
        rawToken
      )}`;

    const safeName =
      escapeHtml(
        user.name
      );

    const safeLink =
      escapeHtml(
        link
      );

    try {
      await withTimeout(
        queueEmail({
          to:
            user.email,

          subject:
            'Verify your Athenaeum account',

          html: `
            <p>Hi ${safeName},</p>
            <p>Welcome to Athenaeum Library. Please verify your email address before signing in.</p>
            <p><a href="${safeLink}">Verify my email</a></p>
            <p>This link expires in 24 hours.</p>
            <p>If you did not create this account, you can ignore this email.</p>
          `,
        }),
        2000
      );
    } catch (error) {
      logger.error(
        'Failed to queue verification email',
        {
          error:
            error.message ||
            String(
              error
            ),

          code:
            error.code,
        }
      );
    }
  };

const register =
  async ({
    name,
    email,
    password,
    phone,
  }) => {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const existing =
      await User.findOne({
        where: {
          email:
            normalizedEmail,
        },
      });

    if (existing) {
      throw ApiError.conflict(
        'An account with this email already exists'
      );
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        SALT_ROUNDS
      );

    const user =
      await User.create({
        name,

        email:
          normalizedEmail,

        passwordHash,

        phone,

        role:
          'member',

        isEmailVerified:
          false,
      });

    await sendVerificationEmail(
      user
    );

    return user;
  };

const verifyEmail =
  async (
    rawToken,
    meta = {}
  ) => {
    const tokenHash =
      hashToken(
        rawToken
      );

    const result =
      await sequelize.transaction(
        async (
          transaction
        ) => {
          const user =
            await User.findOne({
              where: {
                emailVerificationTokenHash:
                  tokenHash,
              },

              transaction,

              lock:
                transaction
                  .LOCK.UPDATE,
            });

          if (!user) {
            return {
              invalidToken:
                true,
            };
          }

          if (
            !user.emailVerificationExpires ||
            user.emailVerificationExpires <=
              new Date()
          ) {
            return {
              invalidToken:
                true,
            };
          }

          if (
            user.isEmailVerified
          ) {
            return {
              invalidToken:
                true,
            };
          }

          user.isEmailVerified =
            true;

          user.emailVerificationTokenHash =
            null;

          user.emailVerificationExpires =
            null;

          await user.save({
            transaction,
          });

          const tokens =
            await issueTokenPair(
              user,
              meta,
              transaction
            );

          return {
            invalidToken:
              false,

            user,

            accessToken:
              tokens.accessToken,

            refreshToken:
              tokens.refreshToken,
          };
        }
      );

    if (
      result.invalidToken
    ) {
      throw ApiError.badRequest(
        'This verification link is invalid or has expired'
      );
    }

    return {
      user:
        result.user,

      accessToken:
        result.accessToken,

      refreshToken:
        result.refreshToken,
    };
  };

const resendVerificationEmail =
  async (email) => {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const user =
      await User.findOne({
        where: {
          email:
            normalizedEmail,
        },
      });

    if (!user) {
      return {
        sent: false,
      };
    }

    if (
      user.isEmailVerified
    ) {
      return {
        sent: false,
      };
    }

    if (
      user.emailVerificationExpires
    ) {
      const previousSendAt =
        new Date(
          new Date(
            user.emailVerificationExpires
          ).getTime() -
            VERIFICATION_TOKEN_EXPIRY_MS
        );

      const elapsed =
        Date.now() -
        previousSendAt.getTime();

      if (
        elapsed <
        VERIFICATION_RESEND_COOLDOWN_MS
      ) {
        const remainingSeconds =
          Math.max(
            1,
            Math.ceil(
              (
                VERIFICATION_RESEND_COOLDOWN_MS -
                elapsed
              ) /
                1000
            )
          );

        if (
          typeof ApiError.tooManyRequests ===
          'function'
        ) {
          throw ApiError.tooManyRequests(
            `Please wait ${remainingSeconds} second(s) before requesting another verification email`
          );
        }

        const error =
          ApiError.badRequest(
            `Please wait ${remainingSeconds} second(s) before requesting another verification email`
          );

        error.statusCode =
          429;

        throw error;
      }
    }

    await sendVerificationEmail(
      user
    );

    return {
      sent: true,
    };
  };

const login =
  async (
    {
      email,
      password,
    },
    meta = {}
  ) => {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const result =
      await sequelize.transaction(
        async (
          transaction
        ) => {
          const user =
            await User.findOne({
              where: {
                email:
                  normalizedEmail,
              },

              transaction,

              lock:
                transaction
                  .LOCK.UPDATE,
            });

          if (!user) {
            throw ApiError.unauthorized(
              'Invalid email or password'
            );
          }

          if (
            user.lockedUntil &&
            user.lockedUntil >
              new Date()
          ) {
            const minutesLeft =
              Math.ceil(
                (
                  user.lockedUntil -
                  new Date()
                ) /
                  60000
              );

            throw ApiError.forbidden(
              `Account temporarily locked. Try again in ${minutesLeft} minute(s)`
            );
          }

          const isMatch =
            await bcrypt.compare(
              password,
              user.passwordHash
            );

          if (!isMatch) {
            user.failedLoginAttempts +=
              1;

            if (
              user.failedLoginAttempts >=
              MAX_FAILED_ATTEMPTS
            ) {
              user.lockedUntil =
                new Date(
                  Date.now() +
                    LOCK_DURATION_MS
                );

              user.failedLoginAttempts =
                0;
            }

            await user.save({
              transaction,
            });

            return {
              invalidCredentials:
                true,
            };
          }

          if (
            !user.isEmailVerified &&
            env.NODE_ENV !==
              'test'
          ) {
            throw ApiError.forbidden(
              'Please verify your email before signing in'
            );
          }

          if (
            user.membershipStatus ===
            'suspended'
          ) {
            throw ApiError.forbidden(
              'Your account has been suspended. Contact the library.'
            );
          }

          user.failedLoginAttempts =
            0;

          user.lockedUntil =
            null;

          await user.save({
            transaction,
          });

          const tokens =
            await issueTokenPair(
              user,
              meta,
              transaction
            );

          return {
            invalidCredentials:
              false,

            user,

            accessToken:
              tokens.accessToken,

            refreshToken:
              tokens.refreshToken,
          };
        }
      );

    if (
      result.invalidCredentials
    ) {
      throw ApiError.unauthorized(
        'Invalid email or password'
      );
    }

    return {
      user:
        result.user,

      accessToken:
        result.accessToken,

      refreshToken:
        result.refreshToken,
    };
  };

const refresh =
  async (
    rawToken,
    meta = {}
  ) => {
    if (!rawToken) {
      throw ApiError.unauthorized(
        'Refresh token missing'
      );
    }

    let payload;

    try {
      payload =
        verifyRefreshToken(
          rawToken
        );
    } catch {
      throw ApiError.unauthorized(
        'Invalid or expired refresh token'
      );
    }

    if (
      payload.type !==
      'refresh'
    ) {
      throw ApiError.unauthorized(
        'Invalid refresh token'
      );
    }

    const tokenHash =
      hashToken(
        rawToken
      );

    const result =
      await sequelize.transaction(
        async (t) => {
          const stored =
            await RefreshToken.findOne({
              where: {
                userId:
                  payload.sub,

                tokenHash,
              },

              transaction:
                t,

              lock:
                t.LOCK.UPDATE,
            });

          if (!stored) {
            throw ApiError.unauthorized(
              'Refresh token not recognized'
            );
          }

          if (
            stored.revokedAt
          ) {
            await RefreshToken.update(
              {
                revokedAt:
                  new Date(),
              },
              {
                where: {
                  userId:
                    payload.sub,

                  revokedAt: {
                    [Op.is]:
                      null,
                  },
                },

                transaction:
                  t,
              }
            );

            return {
              reuseDetected:
                true,
            };
          }

          if (
            stored.expiresAt <
            new Date()
          ) {
            throw ApiError.unauthorized(
              'Refresh token expired'
            );
          }

          const user =
            await User.findByPk(
              payload.sub,
              {
                transaction:
                  t,
              }
            );

          if (!user) {
            throw ApiError.unauthorized(
              'User no longer exists'
            );
          }

          if (
            !user.isEmailVerified &&
            env.NODE_ENV !==
              'test'
          ) {
            throw ApiError.forbidden(
              'Please verify your email before continuing'
            );
          }

          if (
            user.membershipStatus ===
            'suspended'
          ) {
            throw ApiError.forbidden(
              'Your account has been suspended'
            );
          }

          const tokens =
            await issueTokenPair(
              user,
              meta,
              t
            );

          stored.revokedAt =
            new Date();

          stored.replacedByTokenId =
            tokens
              .storedRefreshToken
              .id;

          await stored.save({
            transaction:
              t,
          });

          return {
            reuseDetected:
              false,

            user,

            accessToken:
              tokens.accessToken,

            refreshToken:
              tokens.refreshToken,
          };
        }
      );

    if (
      result.reuseDetected
    ) {
      throw ApiError.unauthorized(
        'Refresh token reuse detected — all sessions revoked'
      );
    }

    return {
      user:
        result.user,

      accessToken:
        result.accessToken,

      refreshToken:
        result.refreshToken,
    };
  };

const logout =
  async (rawToken) => {
    if (!rawToken) {
      return;
    }

    const tokenHash =
      hashToken(
        rawToken
      );

    await RefreshToken.update(
      {
        revokedAt:
          new Date(),
      },
      {
        where: {
          tokenHash,

          revokedAt: {
            [Op.is]:
              null,
          },
        },
      }
    );
  };

const changePassword =
  async (
    userId,
    currentPassword,
    newPassword
  ) => {
    const result =
      await sequelize.transaction(
        async (
          transaction
        ) => {
          const user =
            await User.findByPk(
              userId,
              {
                transaction,

                lock:
                  transaction
                    .LOCK.UPDATE,
              }
            );

          if (!user) {
            throw ApiError.notFound(
              'User not found'
            );
          }

          const isMatch =
            await bcrypt.compare(
              currentPassword,
              user.passwordHash
            );

          if (!isMatch) {
            return {
              incorrectPassword:
                true,
            };
          }

          user.passwordHash =
            await bcrypt.hash(
              newPassword,
              SALT_ROUNDS
            );

          user.failedLoginAttempts =
            0;

          user.lockedUntil =
            null;

          await user.save({
            transaction,
          });

          await revokeActiveRefreshTokens(
            user.id,
            transaction
          );

          return {
            incorrectPassword:
              false,
          };
        }
      );

    if (
      result.incorrectPassword
    ) {
      throw ApiError.badRequest(
        'Current password is incorrect'
      );
    }
  };

const forgotPassword =
  async (email) => {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const user =
      await User.findOne({
        where: {
          email:
            normalizedEmail,
        },
      });

    if (!user) {
      return;
    }

    const rawToken =
      crypto
        .randomBytes(32)
        .toString(
          'hex'
        );

    user.passwordResetTokenHash =
      hashToken(
        rawToken
      );

    user.passwordResetExpires =
      new Date(
        Date.now() +
          RESET_TOKEN_EXPIRY_MS
      );

    await user.save();

    const link =
      `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(
        rawToken
      )}`;

    const safeName =
      escapeHtml(
        user.name
      );

    const safeLink =
      escapeHtml(
        link
      );

    try {
      await withTimeout(
        queueEmail({
          to:
            user.email,

          subject:
            'Reset your Athenaeum password',

          html: `
            <p>Hi ${safeName},</p>
            <p>We received a request to reset your password.</p>
            <p><a href="${safeLink}">Reset my password</a></p>
            <p>This link expires in 1 hour.</p>
          `,
        }),
        2000
      );
    } catch (error) {
      logger.error(
        'Failed to queue password reset email',
        {
          error:
            error.message ||
            String(
              error
            ),

          code:
            error.code,
        }
      );
    }
  };

const resetPassword =
  async (
    rawToken,
    newPassword
  ) => {
    const tokenHash =
      hashToken(
        rawToken
      );

    const result =
      await sequelize.transaction(
        async (
          transaction
        ) => {
          const user =
            await User.findOne({
              where: {
                passwordResetTokenHash:
                  tokenHash,
              },

              transaction,

              lock:
                transaction
                  .LOCK.UPDATE,
            });

          if (!user) {
            return {
              invalidToken:
                true,
            };
          }

          if (
            !user.passwordResetExpires ||
            user.passwordResetExpires <=
              new Date()
          ) {
            return {
              invalidToken:
                true,
            };
          }

          user.passwordHash =
            await bcrypt.hash(
              newPassword,
              SALT_ROUNDS
            );

          user.passwordResetTokenHash =
            null;

          user.passwordResetExpires =
            null;

          user.failedLoginAttempts =
            0;

          user.lockedUntil =
            null;

          await user.save({
            transaction,
          });

          await revokeActiveRefreshTokens(
            user.id,
            transaction
          );

          return {
            invalidToken:
              false,
          };
        }
      );

    if (
      result.invalidToken
    ) {
      throw ApiError.badRequest(
        'This password reset link is invalid or has expired'
      );
    }
  };

module.exports = {
  VERIFICATION_RESEND_COOLDOWN_MS,
  register,
  login,
  refresh,
  logout,
  changePassword,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};