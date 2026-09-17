const crypto = require('crypto');

const {
  Fine,
  User,
  BorrowRecord,
  BookCopy,
  Book,
  sequelize,
} = require('../../database/models');

const ApiError =
  require('../../utils/ApiError');

const {
  parsePagination,
  buildPaginationMeta,
} = require('../../utils/pagination');

const razorpay =
  require('../../config/razorpay');

const env =
  require('../../config/env');

const {
  emitDataChanged,
} = require('../../sockets/io');

const FINE_RATE_PER_DAY = 0.5;
const FINE_CAP = 20.0;

const MAX_UNPAID_BALANCE_FOR_CHECKOUT =
  10.0;

const msPerDay = 86400000;

const emitFineChange = (
  userId,
  transaction = null
) => {
  emitDataChanged(
    {
      resources: [
        'fines',
      ],
      userId,
    },
    transaction
  );

  emitDataChanged(
    {
      resources: [
        'fines',
        'reports',
      ],
      staff: true,
    },
    transaction
  );
};

const createFineForOverdueReturn =
  async (
    record,
    transaction
  ) => {
    const daysLate =
      Math.ceil(
        (
          record.returnedAt -
          record.dueAt
        ) /
          msPerDay
      );

    const amount =
      Math.min(
        daysLate *
          FINE_RATE_PER_DAY,
        FINE_CAP
      ).toFixed(2);

    const fine =
      await Fine.create(
        {
          userId:
            record.userId,

          borrowRecordId:
            record.id,

          amount,

          reason:
            `Overdue return — ${daysLate} day(s) late`,

          status:
            'pending',
        },

        {
          transaction,
        }
      );

    emitFineChange(
      record.userId,
      transaction
    );

    return fine;
  };

const getPendingBalance =
  async (userId) => {
    const result =
      await Fine.sum(
        'amount',
        {
          where: {
            userId,
            status:
              'pending',
          },
        }
      );

    return Number(result) || 0;
  };

const assertCheckoutNotBlocked =
  async (userId) => {
    const balance =
      await getPendingBalance(
        userId
      );

    if (
      balance >
      MAX_UNPAID_BALANCE_FOR_CHECKOUT
    ) {
      throw ApiError.forbidden(
        `Outstanding fines of ${balance.toFixed(
          2
        )} exceed the ${MAX_UNPAID_BALANCE_FOR_CHECKOUT.toFixed(
          2
        )} limit for new checkouts`
      );
    }
  };

const recordManualPayment =
  async (
    fineId
  ) => {
    return sequelize.transaction(
      async (t) => {
        const fine =
          await Fine.findByPk(
            fineId,
            {
              transaction: t,
              lock:
                t.LOCK.UPDATE,
            }
          );

        if (!fine) {
          throw ApiError.notFound(
            'Fine not found'
          );
        }

        if (
          fine.status !==
          'pending'
        ) {
          throw ApiError.badRequest(
            'This fine is not pending payment'
          );
        }

        fine.status =
          'paid';

        fine.paidAt =
          new Date();

        await fine.save({
          transaction: t,
        });

        emitFineChange(
          fine.userId,
          t
        );

        return fine;
      }
    );
  };

const createPaymentOrder =
  async (
    fineId,
    requestingUser
  ) => {
    if (!razorpay) {
      throw ApiError.internal(
        'Online payments are not configured on this server yet'
      );
    }

    const fine =
      await Fine.findByPk(
        fineId
      );

    if (!fine) {
      throw ApiError.notFound(
        'Fine not found'
      );
    }

    if (
      fine.userId !==
        requestingUser.id &&
      ![
        'admin',
        'librarian',
      ].includes(
        requestingUser.role
      )
    ) {
      throw ApiError.forbidden(
        'You can only pay your own fines'
      );
    }

    if (
      fine.status !==
      'pending'
    ) {
      throw ApiError.badRequest(
        'This fine is not pending payment'
      );
    }

    const amountInPaise =
      Math.round(
        Number(
          fine.amount
        ) * 100
      );

    const order =
      await razorpay.orders.create(
        {
          amount:
            amountInPaise,

          currency:
            'INR',

          receipt:
            `fine_${fine.id}`,

          notes: {
            fineId:
              fine.id,

            userId:
              fine.userId,
          },
        }
      );

    fine.razorpayOrderId =
      order.id;

    await fine.save();

    return {
      orderId:
        order.id,

      amount:
        amountInPaise,

      currency:
        'INR',

      keyId:
        env.RAZORPAY_KEY_ID,
    };
  };

const verifyAndMarkPaid =
  async (
    fineId,
    payload,
    requestingUser
  ) => {
    const {
      razorpay_order_id:
        orderId,

      razorpay_payment_id:
        paymentId,

      razorpay_signature:
        signature,
    } = payload;

    return sequelize.transaction(
      async (t) => {
        const fine =
          await Fine.findByPk(
            fineId,
            {
              transaction: t,
              lock:
                t.LOCK.UPDATE,
            }
          );

        if (!fine) {
          throw ApiError.notFound(
            'Fine not found'
          );
        }

        if (
          fine.userId !==
            requestingUser.id &&
          ![
            'admin',
            'librarian',
          ].includes(
            requestingUser.role
          )
        ) {
          throw ApiError.forbidden(
            'You can only pay your own fines'
          );
        }

        if (
          fine.status ===
          'paid'
        ) {
          return fine;
        }

        if (
          fine.razorpayOrderId !==
          orderId
        ) {
          throw ApiError.badRequest(
            'This payment does not match the order for this fine'
          );
        }

        const expectedSignature =
          crypto
            .createHmac(
              'sha256',
              env.RAZORPAY_KEY_SECRET
            )
            .update(
              `${orderId}|${paymentId}`
            )
            .digest('hex');

        if (
          expectedSignature !==
          signature
        ) {
          throw ApiError.badRequest(
            'Payment verification failed — signature mismatch'
          );
        }

        fine.status =
          'paid';

        fine.paidAt =
          new Date();

        fine.razorpayPaymentId =
          paymentId;

        await fine.save({
          transaction: t,
        });

        emitFineChange(
          fine.userId,
          t
        );

        return fine;
      }
    );
  };

const waiveFine =
  async (
    fineId,
    staffUser,
    reason
  ) => {
    return sequelize.transaction(
      async (t) => {
        const fine =
          await Fine.findByPk(
            fineId,
            {
              transaction: t,
              lock:
                t.LOCK.UPDATE,
            }
          );

        if (!fine) {
          throw ApiError.notFound(
            'Fine not found'
          );
        }

        if (
          fine.status !==
          'pending'
        ) {
          throw ApiError.badRequest(
            'Only pending fines can be waived'
          );
        }

        fine.status =
          'waived';

        fine.waivedByUserId =
          staffUser.id;

        fine.waivedReason =
          reason;

        await fine.save({
          transaction: t,
        });

        emitFineChange(
          fine.userId,
          t
        );

        return fine;
      }
    );
  };

const listMyFines =
  async (
    userId,
    query
  ) => {
    const {
      page,
      limit,
      offset,
    } =
      parsePagination(
        query
      );

    const where = {
      userId,
    };

    if (
      query.status
    ) {
      where.status =
        query.status;
    }

    const {
      rows,
      count,
    } =
      await Fine.findAndCountAll(
        {
          where,

          order: [
            [
              'createdAt',
              'DESC',
            ],
          ],

          limit,
          offset,
        }
      );

    const pendingBalance =
      await getPendingBalance(
        userId
      );

    return {
      fines:
        rows,

      pendingBalance,

      meta:
        buildPaginationMeta({
          page,
          limit,
          total:
            count,
        }),
    };
  };

const listAllFines =
  async (query) => {
    const {
      page,
      limit,
      offset,
    } =
      parsePagination(
        query
      );

    const where = {};

    if (
      query.status
    ) {
      where.status =
        query.status;
    }

    if (
      query.userId
    ) {
      where.userId =
        query.userId;
    }

    const {
      rows,
      count,
    } =
      await Fine.findAndCountAll(
        {
          where,

          include: [
            {
              model:
                User,

              as:
                'member',

              attributes: [
                'id',
                'name',
                'email',
                'phone',
                'membershipStatus',
              ],
            },

            {
              model:
                BorrowRecord,

              as:
                'borrowRecord',

              attributes: [
                'id',
                'borrowedAt',
                'dueAt',
                'returnedAt',
                'status',
              ],

              include: [
                {
                  model:
                    BookCopy,

                  as:
                    'copy',

                  attributes: [
                    'id',
                    'barcode',
                    'shelfLocation',
                  ],

                  include: [
                    {
                      model:
                        Book,

                      as:
                        'book',

                      attributes: [
                        'id',
                        'title',
                        'isbn',
                      ],
                    },
                  ],
                },
              ],
            },
          ],

          order: [
            [
              'createdAt',
              'DESC',
            ],
          ],

          limit,
          offset,

          distinct:
            true,
        }
      );

    return {
      fines:
        rows,

      meta:
        buildPaginationMeta({
          page,
          limit,
          total:
            count,
        }),
    };
  };

module.exports = {
  createFineForOverdueReturn,
  getPendingBalance,
  assertCheckoutNotBlocked,
  recordManualPayment,
  createPaymentOrder,
  verifyAndMarkPaid,
  waiveFine,
  listMyFines,
  listAllFines,
};