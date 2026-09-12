const {
  z,
} = require('zod');

const listUsersSchema =
  z.object({
    query:
      z.object({
        page:
          z.coerce
            .number()
            .int()
            .min(1)
            .default(1),

        limit:
          z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20),

        search:
          z
            .string()
            .trim()
            .max(160)
            .optional(),

        role:
          z
            .enum([
              'member',
              'librarian',
              'admin',
            ])
            .optional(),

        membershipStatus:
          z
            .enum([
              'active',
              'suspended',
              'expired',
            ])
            .optional(),
      }),
  });

const userIdSchema =
  z.object({
    params:
      z.object({
        id:
          z
            .string()
            .uuid(),
      }),
  });

const membershipStatusSchema =
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
        membershipStatus:
          z.enum([
            'active',
            'suspended',
            'expired',
          ]),
      }),
  });

const roleSchema =
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
        role:
          z.enum([
            'member',
            'librarian',
            'admin',
          ]),
      }),
  });

module.exports = {
  listUsersSchema,
  userIdSchema,
  membershipStatusSchema,
  roleSchema,
};