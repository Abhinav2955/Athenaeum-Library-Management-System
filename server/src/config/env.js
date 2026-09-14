const { z } = require('zod');

require('dotenv').config();

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      'development',
      'test',
      'production',
    ])
    .default('development'),

  PORT: z.coerce
    .number()
    .default(5000),

  CLIENT_ORIGIN: z
    .string()
    .url()
    .default(
      'http://localhost:5173'
    ),

  FRONTEND_URL: z
    .string()
    .url()
    .default(
      'http://localhost:5173'
    ),

  DB_HOST: z
    .string()
    .min(1),

  DB_PORT: z.coerce
    .number()
    .default(3306),

  DB_NAME: z
    .string()
    .min(1),

  DB_USER: z
    .string()
    .min(1),

  DB_PASSWORD: z
    .string()
    .default(''),

  DB_SSL: z
    .enum([
      'true',
      'false',
    ])
    .default('false'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32),

  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m'),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32),

  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .default('7d'),

  REFRESH_COOKIE_NAME: z
    .string()
    .default(
      'lms_refresh_token'
    ),

  AUTH_RATE_LIMIT_WINDOW_MS:
    z.coerce
      .number()
      .default(900000),

  AUTH_RATE_LIMIT_MAX:
    z.coerce
      .number()
      .default(20),

  RAZORPAY_KEY_ID: z
    .string()
    .optional(),

  RAZORPAY_KEY_SECRET: z
    .string()
    .optional(),

  SMTP_HOST: z
    .string()
    .optional(),

  SMTP_PORT: z.coerce
    .number()
    .optional(),

  SMTP_USER: z
    .string()
    .optional(),

  SMTP_PASS: z
    .string()
    .optional(),

  SMTP_FROM: z
    .string()
    .optional(),

  REDIS_HOST: z
    .string()
    .default('localhost'),

  REDIS_PORT: z.coerce
    .number()
    .default(6379),

  REDIS_USERNAME: z
    .string()
    .optional(),

  REDIS_PASSWORD: z
    .string()
    .optional(),

  REDIS_TLS: z
    .enum([
      'true',
      'false',
    ])
    .default('false'),
});

const parsed =
  envSchema.safeParse(
    process.env
  );

if (!parsed.success) {
  console.error(
    'Invalid environment configuration'
  );

  console.error(
    parsed.error.flatten()
      .fieldErrors
  );

  process.exit(1);
}

const data =
  parsed.data;

if (
  data.NODE_ENV ===
    'test' &&
  !data.DB_NAME.endsWith(
    '_test'
  )
) {
  data.DB_NAME =
    `${data.DB_NAME}_test`;
}

module.exports =
  data;