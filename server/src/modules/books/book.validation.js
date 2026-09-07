const { z } = require('zod');

const isbnSchema = z.string().trim().min(10).max(20);

const createBookSchema = z.object({
  body: z.object({
    isbn: isbnSchema,
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).optional(),
    publisher: z.string().trim().max(150).optional(),
    publishedYear: z.coerce
      .number()
      .int()
      .min(1000)
      .max(new Date().getFullYear())
      .optional(),
    language: z.string().trim().max(50).optional(),
    coverUrl: z.string().url().optional(),
    authorIds: z.array(z.string().uuid()).optional().default([]),
    categoryIds: z.array(z.string().uuid()).optional().default([]),

    // Creating a catalog entry does NOT create a physical book copy.
    // Physical inventory is created through addCopies().
    totalCopies: z.coerce.number().int().min(0).default(0),
  }),
});

const updateBookSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: createBookSchema.shape.body.partial(),
});

const listBooksSchema = z.object({
  query: z.object({
    search: z.string().trim().max(200).optional(),
    categoryId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    language: z.string().trim().max(50).optional(),

    availableOnly: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),

    page: z.coerce.number().int().min(1).optional(),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),

    sortBy: z
      .enum([
        'title',
        'publishedYear',
        'avgRating',
        'createdAt',
      ])
      .optional()
      .default('createdAt'),

    sortOrder: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc'),
  }),
});

const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const recommendationsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),

  query: z.object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5),
  }),
});

module.exports = {
  createBookSchema,
  updateBookSchema,
  listBooksSchema,
  idParamSchema,
  recommendationsSchema,
};