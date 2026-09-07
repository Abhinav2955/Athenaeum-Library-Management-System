const asyncHandler =
  require('../../utils/asyncHandler');

const ApiResponse =
  require('../../utils/ApiResponse');

const memberService =
  require('./member.service');

const searchMembers =
  asyncHandler(
    async (req, res) => {
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

module.exports = {
  searchMembers,
};