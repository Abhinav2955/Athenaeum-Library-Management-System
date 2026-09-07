import axiosClient
  from './axiosClient';

export const searchMembers =
  async (
    search,
    limit = 10
  ) => {
    const res =
      await axiosClient.get(
        '/members',
        {
          params: {
            search,
            limit,
          },
        }
      );

    return res.data.data;
  };

export const getMemberById =
  async (memberId) => {
    const res =
      await axiosClient.get(
        `/members/${memberId}`
      );

    return res.data.data;
  };

export const updateMembershipStatus =
  async (
    memberId,
    membershipStatus
  ) => {
    const res =
      await axiosClient.patch(
        `/members/${memberId}/status`,
        {
          membershipStatus,
        }
      );

    return res.data.data;
  };