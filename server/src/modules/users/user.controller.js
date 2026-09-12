const asyncHandler =
  require('../../utils/asyncHandler');

const ApiResponse =
  require('../../utils/ApiResponse');

const userService =
  require('./user.service');

const list =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await userService
          .listUsers(
            req.query
          );

      return new ApiResponse(
        200,
        result
      ).send(res);
    }
  );

const getById =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const user =
        await userService
          .getUserById(
            req.params.id
          );

      return new ApiResponse(
        200,
        user
      ).send(res);
    }
  );

const updateMembershipStatus =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const user =
        await userService
          .updateMembershipStatus({
            targetUserId:
              req.params.id,

            actorUserId:
              req.user.id,

            membershipStatus:
              req.body
                .membershipStatus,
          });

      return new ApiResponse(
        200,
        user,
        'Membership status updated'
      ).send(res);
    }
  );

const updateRole =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const user =
        await userService
          .updateRole({
            targetUserId:
              req.params.id,

            actorUserId:
              req.user.id,

            role:
              req.body.role,
          });

      return new ApiResponse(
        200,
        user,
        'User role updated'
      ).send(res);
    }
  );

module.exports = {
  list,
  getById,
  updateMembershipStatus,
  updateRole,
};