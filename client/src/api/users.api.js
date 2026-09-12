import axiosClient
  from './axiosClient';

export const getUsers =
  async ({
    page = 1,
    limit = 20,
    search = '',
    role = '',
    membershipStatus = '',
  } = {}) => {
    const params = {
      page,
      limit,
    };

    if (search) {
      params.search =
        search;
    }

    if (role) {
      params.role =
        role;
    }

    if (
      membershipStatus
    ) {
      params.membershipStatus =
        membershipStatus;
    }

    const response =
      await axiosClient.get(
        '/users',
        {
          params,
        }
      );

    return response.data.data;
  };

export const getUser =
  async (id) => {
    const response =
      await axiosClient.get(
        `/users/${id}`
      );

    return response.data.data;
  };

export const updateMembershipStatus =
  async (
    id,
    membershipStatus
  ) => {
    const response =
      await axiosClient.patch(
        `/users/${id}/membership`,
        {
          membershipStatus,
        }
      );

    return response.data.data;
  };

export const updateUserRole =
  async (
    id,
    role
  ) => {
    const response =
      await axiosClient.patch(
        `/users/${id}/role`,
        {
          role,
        }
      );

    return response.data.data;
  };