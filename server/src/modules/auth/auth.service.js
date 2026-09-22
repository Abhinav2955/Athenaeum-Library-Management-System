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
const PASSWORD_RESET_REQUEST_COOLDOWN_MS =
  60 * 1000;
const REFRESH_ROTATION_GRACE_MS =
  3000;
const MAX_REFRESH_RECOVERY_DEPTH =
  10;

const refreshRecoveryKey =
  crypto
    .createHash(
      'sha256'
    )
    .update(
      `athenaeum-refresh-recovery:${env.JWT_REFRESH_SECRET}`
    )
    .digest();

const encryptRefreshToken =
  (token) => {
    const iv =
      crypto.randomBytes(
        12
      );

    const cipher =
      crypto.createCipheriv(
        'aes-256-gcm',
        refreshRecoveryKey,
        iv
      );

    const encrypted =
      Buffer.concat([
        cipher.update(
          token,
          'utf8'
        ),
        cipher.final(),
      ]);

    const tag =
      cipher.getAuthTag();

    return [
      iv.toString(
        'base64url'
      ),
      tag.toString(
        'base64url'
      ),
      encrypted.toString(
        'base64url'
      ),
    ].join('.');
  };

const decryptRefreshToken =
  (value) => {
    if (
      typeof value !==
      'string'
    ) {
      return null;
    }

    const parts =
      value.split('.');

    if (
      parts.length !== 3
    ) {
      return null;
    }

    try {
      const iv =
        Buffer.from(
          parts[0],
          'base64url'
        );

      const tag =
        Buffer.from(
          parts[1],
          'base64url'
        );

      const encrypted =
        Buffer.from(
          parts[2],
          'base64url'
        );

      const decipher =
        crypto.createDecipheriv(
          'aes-256-gcm',
          refreshRecoveryKey,
          iv
        );

      decipher.setAuthTag(
        tag
      );

      return Buffer.concat([
        decipher.update(
          encrypted
        ),
        decipher.final(),
      ]).toString(
        'utf8'
      );
    } catch {
      return null;
    }
  };

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

const sameRefreshClient =
  (
    stored,
    meta
  ) => {
    const storedUserAgent =
      stored.userAgent ||
      null;

    const storedIpAddress =
      stored.ipAddress ||
      null;

    const requestUserAgent =
      meta.userAgent ||
      null;

    const requestIpAddress =
      meta.ipAddress ||
      null;

    return (
      storedUserAgent ===
        requestUserAgent &&
      storedIpAddress ===
        requestIpAddress
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

const recoverRotatedRefreshToken =
  async (
    stored,
    userId,
    meta,
    transaction
  ) => {
    let current =
      stored;

    let recoveredToken =
      null;

    for (
      let depth = 0;
      depth <
      MAX_REFRESH_RECOVERY_DEPTH;
      depth += 1
    ) {
      if (
        !current.revokedAt
      ) {
        if (
          !recoveredToken
        ) {
          return null;
        }

        if (
          current.expiresAt <
          new Date()
        ) {
          return null;
        }

        if (
          hashToken(
            recoveredToken
          ) !==
          current.tokenHash
        ) {
          return null;
        }

        return {
          stored:
            current,

          refreshToken:
            recoveredToken,
        };
      }

      if (
        !sameRefreshClient(
          current,
          meta
        )
      ) {
        return null;
      }

      if (
        !current
          .replacementTokenCiphertext ||
        !current
          .replacementTokenExpiresAt ||
        current
          .replacementTokenExpiresAt <=
          new Date() ||
        !current
          .replacedByTokenId
      ) {
        return null;
      }

      const nextToken =
        decryptRefreshToken(
          current
            .replacementTokenCiphertext
        );

      if (!nextToken) {
        return null;
      }

      const next =
        await RefreshToken.findOne({
          where: {
            id:
              current
                .replacedByTokenId,

            userId,
          },

          transaction,

          lock:
            transaction
              .LOCK.UPDATE,
        });

      if (!next) {
        return null;
      }

      if (
        hashToken(
          nextToken
        ) !==
        next.tokenHash
      ) {
        return null;
      }

      recoveredToken =
        nextToken;

      current =
        next;
    }

    return null;
  };

const queueVerificationEmail =
  async (
    user,
    rawToken
  ) => {
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

const createVerificationToken =
  async (
    user,
    transaction = null
  ) => {
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

    await user.save({
      transaction,
    });

    return rawToken;
  };

const sendVerificationEmail =
  async (user) => {
    const rawToken =
      await createVerificationToken(
        user
      );

    await queueVerificationEmail(
      user,
      rawToken
    );
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
            return {
              sent:
                false,
            };
          }

          if (
            user.isEmailVerified
          ) {
            return {
              sent:
                false,
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

              return {
                sent:
                  false,

                rateLimited:
                  true,

                remainingSeconds,
              };
            }
          }

          const rawToken =
            await createVerificationToken(
              user,
              transaction
            );

          return {
            sent:
              true,

            user,

            rawToken,
          };
        }
      );

    if (
      result.rateLimited
    ) {
      if (
        typeof ApiError.tooManyRequests ===
        'function'
      ) {
        throw ApiError.tooManyRequests(
          `Please wait ${result.remainingSeconds} second(s) before requesting another verification email`
        );
      }

      const error =
        ApiError.badRequest(
          `Please wait ${result.remainingSeconds} second(s) before requesting another verification email`
        );

      error.statusCode =
        429;

      throw error;
    }

    if (
      result.sent
    ) {
      await queueVerificationEmail(
        result.user,
        result.rawToken
      );
    }

    return {
      sent:
        result.sent,
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
            const recovered =
              await recoverRotatedRefreshToken(
                stored,
                payload.sub,
                meta,
                t
              );

            if (
              recovered
            ) {
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

              return {
                reuseDetected:
                  false,

                recovered:
                  true,

                user,

                accessToken:
                  signAccessToken(
                    user
                  ),

                refreshToken:
                  recovered
                    .refreshToken,
              };
            }

            await revokeActiveRefreshTokens(
              payload.sub,
              t
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

          const now =
            new Date();

          stored.revokedAt =
            now;

          stored.replacedByTokenId =
            tokens
              .storedRefreshToken
              .id;

          stored.replacementTokenCiphertext =
            encryptRefreshToken(
              tokens.refreshToken
            );

          stored.replacementTokenExpiresAt =
            new Date(
              now.getTime() +
                REFRESH_ROTATION_GRACE_MS
            );

          await stored.save({
            transaction:
              t,
          });

          return {
            reuseDetected:
              false,

            recovered:
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
            return {
              found:
                false,
            };
          }

          if (
            user.passwordResetTokenHash &&
            user.passwordResetExpires
          ) {
            const previousSendAt =
              new Date(
                new Date(
                  user.passwordResetExpires
                ).getTime() -
                  RESET_TOKEN_EXPIRY_MS
              );

            const elapsed =
              Date.now() -
              previousSendAt.getTime();

            if (
              elapsed <
              PASSWORD_RESET_REQUEST_COOLDOWN_MS
            ) {
              return {
                found:
                  true,

                issued:
                  false,
              };
            }
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

          await user.save({
            transaction,
          });

          return {
            found:
              true,

            issued:
              true,

            user,

            rawToken,
          };
        }
      );

    if (
      !result.found ||
      !result.issued
    ) {
      return;
    }

    const link =
      `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(
        result.rawToken
      )}`;

    const safeName =
      escapeHtml(
        result.user.name
      );

    const safeLink =
      escapeHtml(
        link
      );

    try {
      await withTimeout(
        queueEmail({
          to:
            result.user.email,

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
  PASSWORD_RESET_REQUEST_COOLDOWN_MS,
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