import axiosClient
  from './axiosClient';

export const searchMembers =
  async (
    search,
    limit = 10
  ) => {
    const response =
      await axiosClient.get(
        '/users',
        {
          params: {
            search,
            limit,
            role:
              'member',
          },
        }
      );

    return (
      response.data.data
        .users || []
    );
  };

export const getMemberById =
  async (
    memberId
  ) => {
    const response =
      await axiosClient.get(
        `/users/${memberId}`
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
        `/users/${memberId}/membership`,
        {
          membershipStatus,
        }
      );

    return response.data.data;
  };