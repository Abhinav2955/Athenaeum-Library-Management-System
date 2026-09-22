import axiosClient
  from './axiosClient';

export const searchMembers =
  async (
    search,
    limit = 10
  ) => {
    const response =
      await axiosClient.get(
        '/members',
        {
          params: {
            search,
            limit,
          },
        }
      );

    return (
      response.data.data ||
      []
    );
  };

export const getMemberById =
  async (
    memberId
  ) => {
    const response =
      await axiosClient.get(
        `/members/${memberId}`
      );

    return response.data.data;
  };

export const updateMembershipStatus =
  async (
    memberId,
    membershipStatus
  ) => {
    const response =
      await axiosClient.patch(
        `/members/${memberId}/status`,
        {
          membershipStatus,
        }
      );

    return response.data.data;
  };