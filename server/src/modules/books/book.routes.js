const express = require('express');
const controller = require('./book.controller');
const validate = require('../../middlewares/validate.middleware');
const authenticate = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/rbac.middleware');

const {
  createBookSchema,
  updateBookSchema,
  listBooksSchema,
  idParamSchema,
  recommendationsSchema,
} = require('./book.validation');

const router = express.Router();

router.get(
  '/',
  validate(listBooksSchema),
  controller.list
);

router.get(
  '/:id',
  validate(idParamSchema),
  controller.getOne
);

router.get(
  '/:id/recommendations',
  validate(recommendationsSchema),
  controller.recommendations
);

router.post(
  '/',
  authenticate,
  authorize(
    'admin',
    'librarian'
  ),
  validate(createBookSchema),
  controller.create
);

router.put(
  '/:id',
  authenticate,
  authorize(
    'admin',
    'librarian'
  ),
  validate(updateBookSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticate,
  authorize(
    'admin',
    'librarian'
  ),
  validate(idParamSchema),
  controller.remove
);

module.exports = router;