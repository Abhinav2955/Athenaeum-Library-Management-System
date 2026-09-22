const asyncHandler =
  require('../../utils/asyncHandler');

const ApiResponse =
  require('../../utils/ApiResponse');

const memberService =
  require('./member.service');

const userService =
  require('../users/user.service');

const searchMembers =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const members =
        await memberService
          .searchMembers(
            req.query
          );

      return new ApiResponse(
        200,
        members,
        'Members retrieved successfully'
      ).send(res);
    }
  );

const getMember =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const result =
        await memberService
          .getMemberById(
            req.params.id
          );

      return new ApiResponse(
        200,
        result,
        'Member retrieved successfully'
      ).send(res);
    }
  );

const updateMembershipStatus =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const member =
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
        member,
        'Membership status updated successfully'
      ).send(res);
    }
  );

module.exports = {
  searchMembers,
  getMember,
  updateMembershipStatus,
};