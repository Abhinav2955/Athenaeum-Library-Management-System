import axiosClient
  from './axiosClient';

export const createReservation =
  async (bookId) => {
    const res =
      await axiosClient.post(
        '/reservations',
        {
          bookId,
        }
      );

    return res.data.data;
  };

export const cancelReservation =
  async (reservationId) => {
    const res =
      await axiosClient.post(
        `/reservations/${reservationId}/cancel`
      );

    return res.data.data;
  };

export const listMyReservations =
  async (params = {}) => {
    const res =
      await axiosClient.get(
        '/reservations/me',
        {
          params,
        }
      );

    return res.data.data;
  };

/*
 * Staff-only reservation list.
 */
export const listAllReservations =
  async (params = {}) => {
    const cleaned =
      Object.fromEntries(
        Object.entries(
          params
        ).filter(
          ([, value]) =>
            value !== '' &&
            value !== undefined &&
            value !== null
        )
      );

    const res =
      await axiosClient.get(
        '/reservations',
        {
          params:
            cleaned,
        }
      );

    return res.data.data;
  };