const { z } = require('zod');

const passwordSchema =
  z
    .string()
    .min(
      8,
      'Password must be at least 8 characters'
    )
    .max(
      128,
      'Password is too long'
    )
    .regex(
      /[A-Z]/,
      'Password must contain an uppercase letter'
    )
    .regex(
      /[a-z]/,
      'Password must contain a lowercase letter'
    )
    .regex(
      /\d/,
      'Password must contain a number'
    );

const registerSchema =
  z.object({
    body:
      z.object({
        name:
          z
            .string()
            .trim()
            .min(2)
            .max(100),

        email:
          z
            .string()
            .trim()
            .email()
            .transform(
              (value) =>
                value.toLowerCase()
            ),

        password:
          passwordSchema,

        phone:
          z
            .string()
            .trim()
            .max(20)
            .optional()
            .or(
              z.literal('')
            ),
      }),
  });

const loginSchema =
  z.object({
    body:
      z.object({
        email:
          z
            .string()
            .trim()
            .email()
            .transform(
              (value) =>
                value.toLowerCase()
            ),

        password:
          z
            .string()
            .min(1),
      }),
  });

const verifyEmailSchema =
  z.object({
    body:
      z.object({
        token:
          z
            .string()
            .min(20),
      }),
  });

const resendVerificationSchema =
  z.object({
    body:
      z.object({
        email:
          z
            .string()
            .trim()
            .email()
            .transform(
              (value) =>
                value.toLowerCase()
            ),
      }),
  });

const changePasswordSchema =
  z.object({
    body:
      z.object({
        currentPassword:
          z
            .string()
            .min(1),

        newPassword:
          passwordSchema,
      }),
  });

const forgotPasswordSchema =
  z.object({
    body:
      z.object({
        email:
          z
            .string()
            .trim()
            .email()
            .transform(
              (value) =>
                value.toLowerCase()
            ),
      }),
  });

const resetPasswordSchema =
  z.object({
    body:
      z.object({
        token:
          z
            .string()
            .min(20),

        password:
          passwordSchema,
      }),
  });

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};