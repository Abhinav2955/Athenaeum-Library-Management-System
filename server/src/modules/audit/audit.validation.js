const {
  z,
} = require('zod');

const listAuditLogsSchema =
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
            .default(25),

        action:
          z
            .string()
            .trim()
            .min(1)
            .max(80)
            .optional(),

        entity:
          z
            .string()
            .trim()
            .min(1)
            .max(80)
            .optional(),

        actorId:
          z
            .string()
            .uuid()
            .optional(),

        from:
          z
            .string()
            .datetime()
            .optional(),

        to:
          z
            .string()
            .datetime()
            .optional(),
      }),
  });

module.exports = {
  listAuditLogsSchema,
};