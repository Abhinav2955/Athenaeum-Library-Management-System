const {
  Op,
} = require('sequelize');

const {
  AuditLog,
  User,
} = require('../../database/models');

/*
 * Audit logging must never contain secrets.
 *
 * Even if a future endpoint accidentally passes a
 * request body containing one of these fields,
 * it is removed before persistence.
 */
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|signature/i;

const sanitizeValue =
  (value) => {
    if (
      value === null ||
      value === undefined
    ) {
      return value;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      return value.map(
        sanitizeValue
      );
    }

    if (
      typeof value ===
      'object'
    ) {
      const result = {};

      for (
        const [
          key,
          nestedValue,
        ] of Object.entries(
          value
        )
      ) {
        if (
          SENSITIVE_KEY_PATTERN.test(
            key
          )
        ) {
          continue;
        }

        result[key] =
          sanitizeValue(
            nestedValue
          );
      }

      return result;
    }

    return value;
  };

const createAuditLog =
  async ({
    actorId,
    action,
    entity,
    entityId = null,
    metadata = null,
  }) => {
    if (
      !actorId ||
      !action ||
      !entity
    ) {
      return null;
    }

    return AuditLog.create({
      actorId,

      action,

      entity,

      entityId:
        entityId
          ? String(
              entityId
            )
          : null,

      metadataJson:
        metadata
          ? sanitizeValue(
              metadata
            )
          : null,
    });
  };

const listAuditLogs =
  async ({
    page = 1,
    limit = 25,
    action,
    entity,
    actorId,
    from,
    to,
  }) => {
    const where = {};

    if (action) {
      where.action =
        action;
    }

    if (entity) {
      where.entity =
        entity;
    }

    if (actorId) {
      where.actorId =
        actorId;
    }

    if (
      from ||
      to
    ) {
      where.created_at =
        {};

      if (from) {
        where.created_at[
          Op.gte
        ] =
          new Date(from);
      }

      if (to) {
        where.created_at[
          Op.lte
        ] =
          new Date(to);
      }
    }

    const offset =
      (page - 1) *
      limit;

    const {
      rows,
      count,
    } =
      await AuditLog
        .findAndCountAll({
          where,

          include: [
            {
              model:
                User,

              as:
                'actor',

              attributes: [
                'id',
                'name',
                'email',
                'role',
              ],
            },
          ],

          order: [
            [
              'created_at',
              'DESC',
            ],
          ],

          limit,
          offset,
        });

    return {
      logs:
        rows,

      meta: {
        page,

        limit,

        total:
          count,

        totalPages:
          Math.max(
            1,
            Math.ceil(
              count /
                limit
            )
          ),
      },
    };
  };

module.exports = {
  sanitizeValue,

  createAuditLog,

  listAuditLogs,
};