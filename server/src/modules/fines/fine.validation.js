const {
  z,
} = require('zod');

const idParamSchema =
  z.object({
    params:
      z.object({
        id:
          z
            .string()
            .uuid(),
      }),
  });

const verifyPaymentSchema =
  z.object({
    params:
      z.object({
        id:
          z
            .string()
            .uuid(),
      }),

    body:
      z.object({
        razorpay_order_id:
          z
            .string()
            .trim()
            .min(1)
            .max(255),

        razorpay_payment_id:
          z
            .string()
            .trim()
            .min(1)
            .max(255),

        razorpay_signature:
          z
            .string()
            .regex(
              /^[a-fA-F0-9]{64}$/
            ),
      }),
  });

const waiveFineSchema =
  z.object({
    params:
      z.object({
        id:
          z
            .string()
            .uuid(),
      }),

    body:
      z.object({
        reason:
          z
            .string()
            .trim()
            .min(3)
            .max(255),
      }),
  });

const listFinesSchema =
  z.object({
    query:
      z.object({
        status:
          z
            .enum([
              'pending',
              'paid',
              'waived',
            ])
            .optional(),

        userId:
          z
            .string()
            .uuid()
            .optional(),

        page:
          z.coerce
            .number()
            .int()
            .min(1)
            .optional(),

        limit:
          z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .optional(),
      }),
  });

module.exports = {
  idParamSchema,
  verifyPaymentSchema,
  waiveFineSchema,
  listFinesSchema,
};