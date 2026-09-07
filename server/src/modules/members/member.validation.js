const { z } = require('zod');

const searchMembersSchema =
  z.object({
    query: z.object({
      search: z
        .string()
        .trim()
        .min(
          2,
          'Search must contain at least 2 characters'
        )
        .max(120),

      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .default(10),
    }),
  });

module.exports = {
  searchMembersSchema,
};