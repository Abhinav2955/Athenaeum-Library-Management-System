const request = require('supertest');

const app = require('../../src/app');

const {
  sequelize,
  User,
  BookCopy,
} = require('../../src/database/models');

let adminToken;
let memberToken;
let createdBookId;

const stamp = Date.now();

const admin = {
  name: 'Books Admin',
  email: `books.admin.${stamp}@example.com`,
  password: 'StrongPass1',
};

const member = {
  name: 'Books Member',
  email: `books.member.${stamp}@example.com`,
  password: 'StrongPass1',
};

const registerAndLogin = async (credentials) => {
  await request(app)
    .post('/api/v1/auth/register')
    .send(credentials);

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send(credentials);

  return response.body.data.accessToken;
};

beforeAll(async () => {
  await sequelize.sync({
    force: true,
  });

  
  memberToken =
    await registerAndLogin(member);

  
  await registerAndLogin(admin);

  
  await User.update(
    {
      role: 'admin',
    },
    {
      where: {
        email: admin.email,
      },
    }
  );

  
  adminToken =
    await registerAndLogin(admin);
});

describe(
  'Books module',
  () => {
    it(
      'rejects book creation without authentication',
      async () => {
        const res =
          await request(app)
            .post('/api/v1/books')
            .send({
              isbn:
                '9781111111111',

              title:
                'Unauthorized Book',
            });

        expect(
          res.statusCode
        ).toBe(401);
      }
    );

    it(
      'rejects book creation by a normal member',
      async () => {
        const res =
          await request(app)
            .post('/api/v1/books')
            .set(
              'Authorization',
              `Bearer ${memberToken}`
            )
            .send({
              isbn:
                '9781111111112',

              title:
                'Forbidden Book',
            });

        expect(
          res.statusCode
        ).toBe(403);
      }
    );

    it(
      'allows an admin to create a catalog book',
      async () => {
        
        const res =
          await request(app)
            .post('/api/v1/books')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              isbn:
                '9780134494166',

              title:
                'Clean Architecture',

              description:
                'A handbook of software architecture principles.',

              publisher:
                'Prentice Hall',

              publishedYear:
                2017,

              language:
                'English',
            });

        expect(
          res.statusCode
        ).toBe(201);

        expect(
          res.body.data.totalCopies
        ).toBe(0);

        expect(
          res.body.data.availableCopies
        ).toBe(0);

        createdBookId =
          res.body.data.id;

        expect(
          createdBookId
        ).toBeDefined();

        
        const copyRes =
          await request(app)
            .post(
              '/api/v1/borrow/copies'
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              bookId:
                createdBookId,

              quantity: 3,

              shelfLocation:
                'A-01',
            });

        expect(
          copyRes.statusCode
        ).toBe(201);

        
        const copyCount =
          await BookCopy.count({
            where: {
              bookId:
                createdBookId,
            },
          });

        expect(
          copyCount
        ).toBe(3);

        
        const getRes =
          await request(app)
            .get(
              `/api/v1/books/${createdBookId}`
            );

        expect(
          getRes.statusCode
        ).toBe(200);

        expect(
          getRes.body.data.totalCopies
        ).toBe(3);

        expect(
          getRes.body.data.availableCopies
        ).toBe(3);
      }
    );

    it(
      'rejects duplicate ISBN',
      async () => {
        const res =
          await request(app)
            .post('/api/v1/books')
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              isbn:
                '9780134494166',

              title:
                'Duplicate Clean Architecture',
            });

        expect(
          res.statusCode
        ).toBe(409);
      }
    );

    it(
      'lists books',
      async () => {
        const res =
          await request(app)
            .get('/api/v1/books');

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          Array.isArray(
            res.body.data.books
          )
        ).toBe(true);

        expect(
          res.body.data.books.some(
            (book) =>
              book.id ===
              createdBookId
          )
        ).toBe(true);
      }
    );

    it(
      'supports pagination',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/books?page=1&limit=1'
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.books.length
        ).toBeLessThanOrEqual(
          1
        );

        expect(
          res.body.data.meta
        ).toBeDefined();
      }
    );

    it(
      'finds the book via search',
      async () => {
        const res =
          await request(app)
            .get(
              '/api/v1/books?search=architecture'
            );

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.books.some(
            (book) =>
              book.id ===
              createdBookId
          )
        ).toBe(true);
      }
    );

    it(
      'updates a book as admin without changing inventory',
      async () => {
        const res =
          await request(app)
            .put(
              `/api/v1/books/${createdBookId}`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            )
            .send({
              title:
                'Clean Architecture (2nd Edition)',

              
              totalCopies:
                999,
            });

        expect(
          res.statusCode
        ).toBe(200);

        expect(
          res.body.data.title
        ).toBe(
          'Clean Architecture (2nd Edition)'
        );

        
        expect(
          res.body.data.totalCopies
        ).toBe(3);

        expect(
          res.body.data.availableCopies
        ).toBe(3);
      }
    );

    it(
      'soft-deletes a book as admin',
      async () => {
        const res =
          await request(app)
            .delete(
              `/api/v1/books/${createdBookId}`
            )
            .set(
              'Authorization',
              `Bearer ${adminToken}`
            );

        expect(
          res.statusCode
        ).toBe(200);

        const getRes =
          await request(app)
            .get(
              `/api/v1/books/${createdBookId}`
            );

        expect(
          getRes.statusCode
        ).toBe(404);
      }
    );
  }
);