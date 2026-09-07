const {
  Op,
  literal,
  QueryTypes,
} = require('sequelize');

const {
  Book,
  Author,
  Category,
  sequelize,
} = require('../../database/models');

const ApiError = require('../../utils/ApiError');

const {
  parsePagination,
  buildPaginationMeta,
} = require('../../utils/pagination');

const includeRelations = [
  {
    model: Author,
    as: 'authors',
    through: {
      attributes: [],
    },
    attributes: ['id', 'name'],
  },

  {
    model: Category,
    as: 'categories',
    through: {
      attributes: [],
    },
    attributes: ['id', 'name'],
  },
];

const createBook = async (data) => {
  const existing = await Book.findOne({
    where: {
      isbn: data.isbn,
    },
  });

  if (existing) {
    throw ApiError.conflict(
      'A book with this ISBN already exists'
    );
  }

  return sequelize.transaction(async (t) => {
    /*
     * Important:
     *
     * Book represents the catalog/title.
     * BookCopy represents an actual physical copy.
     *
     * Therefore creating a Book must NOT automatically
     * increase inventory.
     */
    const book = await Book.create(
      {
        isbn: data.isbn,
        title: data.title,
        description: data.description,
        publisher: data.publisher,
        publishedYear: data.publishedYear,
        language: data.language,
        coverUrl: data.coverUrl,

        totalCopies: 0,
        availableCopies: 0,
      },
      {
        transaction: t,
      }
    );

    if (data.authorIds?.length) {
      await book.setAuthors(
        data.authorIds,
        {
          transaction: t,
        }
      );
    }

    if (data.categoryIds?.length) {
      await book.setCategories(
        data.categoryIds,
        {
          transaction: t,
        }
      );
    }

    return getBookById(
      book.id,
      {
        transaction: t,
      }
    );
  });
};

const getBookById = async (
  id,
  options = {}
) => {
  const book = await Book.findByPk(
    id,
    {
      include: includeRelations,
      ...options,
    }
  );

  if (!book) {
    throw ApiError.notFound(
      'Book not found'
    );
  }

  return book;
};

const listBooks = async (query) => {
  const {
    page,
    limit,
    offset,
  } = parsePagination(query);

  const {
    search,
    categoryId,
    authorId,
    language,
    availableOnly,
    sortBy,
    sortOrder,
  } = query;

  const where = {};

  if (language) {
    where.language = language;
  }

  if (availableOnly) {
    where.availableCopies = {
      [Op.gt]: 0,
    };
  }

  if (
    search &&
    search.trim().length >= 3
  ) {
    where[Op.and] =
      where[Op.and] || [];

    where[Op.and].push(
      literal(
        `MATCH(title, description) AGAINST(:search IN NATURAL LANGUAGE MODE)`
      )
    );
  } else if (search) {
    where[Op.or] = [
      {
        title: {
          [Op.like]: `%${search}%`,
        },
      },
      {
        isbn: {
          [Op.like]: `%${search}%`,
        },
      },
    ];
  }

  const include = [
    ...includeRelations,
  ];

  if (categoryId) {
    include[1] = {
      ...include[1],
      where: {
        id: categoryId,
      },
      required: true,
    };
  }

  if (authorId) {
    include[0] = {
      ...include[0],
      where: {
        id: authorId,
      },
      required: true,
    };
  }

  const {
    rows,
    count,
  } =
    await Book.findAndCountAll({
      where,
      include,
      limit,
      offset,
      distinct: true,

      order: [
        [
          sortBy,
          sortOrder.toUpperCase(),
        ],
      ],

      replacements: {
        search,
      },

      subQuery: false,
    });

  return {
    books: rows,

    meta: buildPaginationMeta({
      page,
      limit,
      total: count,
    }),
  };
};

const updateBook = async (
  id,
  data
) => {
  const book =
    await Book.findByPk(id);

  if (!book) {
    throw ApiError.notFound(
      'Book not found'
    );
  }

  if (
    data.isbn &&
    data.isbn !== book.isbn
  ) {
    const clash =
      await Book.findOne({
        where: {
          isbn: data.isbn,
        },
      });

    if (clash) {
      throw ApiError.conflict(
        'Another book already uses this ISBN'
      );
    }
  }

  return sequelize.transaction(
    async (t) => {
      /*
       * Make a copy so we can safely remove
       * relationship and inventory fields.
       */
      const bookFields = {
        ...data,
      };

      /*
       * These fields are handled separately.
       */
      delete bookFields.authorIds;
      delete bookFields.categoryIds;

      /*
       * NEVER allow book metadata editing to
       * manually alter inventory counters.
       *
       * Inventory must only change when physical
       * BookCopy rows change.
       */
      delete bookFields.totalCopies;
      delete bookFields.availableCopies;

      await book.update(
        bookFields,
        {
          transaction: t,
        }
      );

      if (data.authorIds) {
        await book.setAuthors(
          data.authorIds,
          {
            transaction: t,
          }
        );
      }

      if (data.categoryIds) {
        await book.setCategories(
          data.categoryIds,
          {
            transaction: t,
          }
        );
      }

      return getBookById(
        book.id,
        {
          transaction: t,
        }
      );
    }
  );
};

const deleteBook = async (id) => {
  const book =
    await Book.findByPk(id);

  if (!book) {
    throw ApiError.notFound(
      'Book not found'
    );
  }

  await book.destroy();
};

const getRelatedBooks = async (
  bookId,
  limit = 5
) => {
  const borrowerRows =
    await sequelize.query(
      `
      SELECT DISTINCT
        br.user_id AS userId
      FROM borrow_records br
      JOIN book_copies bc
        ON br.copy_id = bc.id
      WHERE bc.book_id = :bookId
      `,
      {
        replacements: {
          bookId,
        },
        type: QueryTypes.SELECT,
      }
    );

  const userIds =
    borrowerRows.map(
      (row) => row.userId
    );

  if (userIds.length === 0) {
    return [];
  }

  const relatedRows =
    await sequelize.query(
      `
      SELECT
        bc.book_id AS bookId,
        COUNT(DISTINCT br.user_id)
          AS coBorrowerCount
      FROM borrow_records br
      JOIN book_copies bc
        ON br.copy_id = bc.id
      WHERE
        br.user_id IN (:userIds)
        AND bc.book_id != :bookId
      GROUP BY bc.book_id
      ORDER BY coBorrowerCount DESC
      LIMIT :limit
      `,
      {
        replacements: {
          userIds,
          bookId,
          limit,
        },
        type: QueryTypes.SELECT,
      }
    );

  if (
    relatedRows.length === 0
  ) {
    return [];
  }

  const relatedBookIds =
    relatedRows.map(
      (row) => row.bookId
    );

  const books =
    await Book.findAll({
      where: {
        id: relatedBookIds,
      },
      include: includeRelations,
    });

  const bookById =
    Object.fromEntries(
      books.map(
        (book) => [
          book.id,
          book,
        ]
      )
    );

  return relatedRows
    .map((row) => ({
      book:
        bookById[row.bookId],

      coBorrowerCount:
        Number(
          row.coBorrowerCount
        ),
    }))
    .filter(
      (row) => row.book
    );
};

module.exports = {
  createBook,
  getBookById,
  listBooks,
  updateBook,
  deleteBook,
  getRelatedBooks,
};