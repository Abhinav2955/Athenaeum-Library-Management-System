const asyncHandler =
  require('../../utils/asyncHandler');

const ApiResponse =
  require('../../utils/ApiResponse');

const {
  listAuditLogs,
} =
  require('./audit.service');

const list =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await listAuditLogs(
          req.query
        );

      return new ApiResponse(
        200,
        result
      ).send(res);
    }
  );

module.exports = {
  list,
};