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