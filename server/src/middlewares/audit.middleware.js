const logger =
  require('../config/logger');

const {
  createAuditLog,
  sanitizeValue,
} =
  require('../modules/audit/audit.service');

const resolveAuditEvent =
  ({
    method,
    path,
    body,
    responseBody,
  }) => {
    if (
      method === 'POST' &&
      /^\/api\/v1\/books\/?$/.test(
        path
      )
    ) {
      return {
        action:
          'BOOK_CREATED',
        entity:
          'book',
        entityId:
          responseBody?.data?.id ||
          null,
      };
    }

    const bookMatch =
      path.match(
        /^\/api\/v1\/books\/([^/]+)\/?$/
      );

    if (
      bookMatch &&
      (
        method === 'PUT' ||
        method === 'PATCH'
      )
    ) {
      return {
        action:
          'BOOK_UPDATED',
        entity:
          'book',
        entityId:
          bookMatch[1],
      };
    }

    if (
      bookMatch &&
      method ===
        'DELETE'
    ) {
      return {
        action:
          'BOOK_DELETED',
        entity:
          'book',
        entityId:
          bookMatch[1],
      };
    }

    if (
      method === 'POST' &&
      /^\/api\/v1\/borrow\/copies\/?$/.test(
        path
      )
    ) {
      return {
        action:
          'COPIES_ADDED',
        entity:
          'book',
        entityId:
          body?.bookId ||
          null,
      };
    }

    const retireMatch =
      path.match(
        /^\/api\/v1\/borrow\/copies\/([^/]+)\/retire\/?$/
      );

    if (
      retireMatch &&
      method ===
        'POST'
    ) {
      return {
        action:
          'COPY_RETIRED',
        entity:
          'book_copy',
        entityId:
          retireMatch[1],
      };
    }

    const copyActionMatch =
      path.match(
        /^\/api\/v1\/borrow\/copies\/([^/]+)\/([^/]+)\/?$/
      );

    if (
      copyActionMatch &&
      (
        method === 'POST' ||
        method === 'PATCH' ||
        method === 'PUT'
      )
    ) {
      const copyId =
        copyActionMatch[1];

      const operation =
        copyActionMatch[2]
          .toLowerCase();

      const actionMap = {
        lost:
          'COPY_MARKED_LOST',

        'mark-lost':
          'COPY_MARKED_LOST',

        damaged:
          'COPY_MARKED_DAMAGED',

        'mark-damaged':
          'COPY_MARKED_DAMAGED',

        repair:
          'COPY_REPAIR_UPDATED',

        'start-repair':
          'COPY_REPAIR_STARTED',

        'complete-repair':
          'COPY_REPAIR_COMPLETED',

        restore:
          'COPY_RESTORED',

        available:
          'COPY_RESTORED',
      };

      if (
        actionMap[
          operation
        ]
      ) {
        return {
          action:
            actionMap[
              operation
            ],
          entity:
            'book_copy',
          entityId:
            copyId,
        };
      }
    }

    const copyStatusMatch =
      path.match(
        /^\/api\/v1\/borrow\/copies\/([^/]+)\/?$/
      );

    if (
      copyStatusMatch &&
      (
        method === 'PATCH' ||
        method === 'PUT'
      ) &&
      body?.status
    ) {
      const statusMap = {
        lost:
          'COPY_MARKED_LOST',

        damaged:
          'COPY_MARKED_DAMAGED',

        under_repair:
          'COPY_REPAIR_STARTED',

        available:
          'COPY_RESTORED',
      };

      if (
        statusMap[
          body.status
        ]
      ) {
        return {
          action:
            statusMap[
              body.status
            ],
          entity:
            'book_copy',
          entityId:
            copyStatusMatch[1],
        };
      }
    }

    const returnMatch =
      path.match(
        /^\/api\/v1\/borrow\/([^/]+)\/return\/?$/
      );

    if (
      returnMatch &&
      method ===
        'POST'
    ) {
      return {
        action:
          'LOAN_RETURN_RECORDED',
        entity:
          'borrow_record',
        entityId:
          returnMatch[1],
      };
    }

    const finePaymentMatch =
      path.match(
        /^\/api\/v1\/fines\/([^/]+)\/pay\/?$/
      );

    if (
      finePaymentMatch &&
      method ===
        'POST'
    ) {
      return {
        action:
          'FINE_MANUAL_PAYMENT_RECORDED',
        entity:
          'fine',
        entityId:
          finePaymentMatch[1],
      };
    }

    const fineWaiveMatch =
      path.match(
        /^\/api\/v1\/fines\/([^/]+)\/waive\/?$/
      );

    if (
      fineWaiveMatch &&
      method ===
        'POST'
    ) {
      return {
        action:
          'FINE_WAIVED',
        entity:
          'fine',
        entityId:
          fineWaiveMatch[1],
      };
    }

    const membershipMatch =
      path.match(
        /^\/api\/v1\/users\/([^/]+)\/membership\/?$/
      );

    if (
      membershipMatch &&
      method ===
        'PATCH'
    ) {
      const actionMap = {
        active:
          'MEMBERSHIP_ACTIVATED',

        suspended:
          'MEMBERSHIP_SUSPENDED',

        expired:
          'MEMBERSHIP_EXPIRED',
      };

      return {
        action:
          actionMap[
            body?.membershipStatus
          ] ||
          'MEMBERSHIP_UPDATED',

        entity:
          'user',

        entityId:
          membershipMatch[1],
      };
    }

    const roleMatch =
      path.match(
        /^\/api\/v1\/users\/([^/]+)\/role\/?$/
      );

    if (
      roleMatch &&
      method ===
        'PATCH'
    ) {
      return {
        action:
          'USER_ROLE_CHANGED',

        entity:
          'user',

        entityId:
          roleMatch[1],
      };
    }

    if (
      method === 'POST' &&
      /^\/api\/v1\/reports\/run-maintenance\/?$/.test(
        path
      )
    ) {
      return {
        action:
          'MAINTENANCE_SWEEP_TRIGGERED',

        entity:
          'system',

        entityId:
          null,
      };
    }

    return null;
  };

const auditMiddleware =
  (
    req,
    res,
    next
  ) => {
    let responseBody =
      null;

    const originalJson =
      res.json.bind(
        res
      );

    res.json =
      (body) => {
        responseBody =
          body;

        return originalJson(
          body
        );
      };

    res.on(
      'finish',
      () => {
        if (
          res.statusCode <
            200 ||
          res.statusCode >=
            400
        ) {
          return;
        }

        const actor =
          req.user;

        if (
          !actor ||
          ![
            'admin',
            'librarian',
          ].includes(
            actor.role
          )
        ) {
          return;
        }

        const method =
          req.method
            .toUpperCase();

        const path =
          req.originalUrl
            .split('?')[0];

        const event =
          resolveAuditEvent({
            method,
            path,
            body:
              req.body,
            responseBody,
          });

        if (!event) {
          return;
        }

        createAuditLog({
          actorId:
            actor.id,

          action:
            event.action,

          entity:
            event.entity,

          entityId:
            event.entityId,

          metadata: {
            method,
            path,

            statusCode:
              res.statusCode,

            actorRole:
              actor.role,

            request: {
              body:
                sanitizeValue(
                  req.body
                ),
            },

            ipAddress:
              req.ip ||
              null,

            userAgent:
              req.get(
                'user-agent'
              ) ||
              null,
          },
        }).catch(
          (error) => {
            logger.error(
              'Failed to create audit log',
              {
                error:
                  error.message ||
                  String(
                    error
                  ),

                action:
                  event.action,

                actorId:
                  actor.id,
              }
            );
          }
        );
      }
    );

    next();
  };

module.exports = {
  auditMiddleware,
  resolveAuditEvent,
};