const { z } = require('zod');

const checkoutSchema = z.object({
  body: z.object({
    bookId: z.string().uuid(),
    userId: z.string().uuid().optional(),
  }),
});

const addCopySchema = z.object({
  body: z.object({
    bookId: z.string().uuid(),

    shelfLocation: z
      .string()
      .trim()
      .max(50)
      .optional(),

    quantity: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(1),
  }),
});

const recordIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const returnBookSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),

  body: z
    .object({
      condition: z
        .enum([
          'good',
          'damaged',
        ])
        .optional()
        .default('good'),
    })
    .optional()
    .default({
      condition: 'good',
    }),
});

const updateCopyStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),

  body: z.object({
    status: z.enum([
      'available',
      'damaged',
      'under_repair',
    ]),
  }),
});

const listBorrowRecordsSchema = z.object({
  query: z.object({
    status: z
      .enum([
        'active',
        'returned',
        'overdue',
        'lost',
      ])
      .optional(),

    userId: z
      .string()
      .uuid()
      .optional(),

    page: z.coerce
      .number()
      .int()
      .min(1)
      .optional(),

    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional(),
  }),
});

const listCopiesSchema = z.object({
  query: z.object({
    bookId: z.string().uuid(),
  }),
});

module.exports = {
  checkoutSchema,
  addCopySchema,
  recordIdSchema,
  returnBookSchema,
  updateCopyStatusSchema,
  listBorrowRecordsSchema,
  listCopiesSchema,
};