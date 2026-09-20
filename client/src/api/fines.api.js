import axiosClient
  from './axiosClient';

export const listMyFines =
  async (
    params = {}
  ) => {
    const res =
      await axiosClient.get(
        '/fines/me',
        {
          params,
        }
      );

    return res.data.data;
  };

export const createPaymentOrder =
  async (fineId) => {
    const res =
      await axiosClient.post(
        `/fines/${fineId}/create-order`
      );

    return res.data.data;
  };

export const verifyPayment =
  async (
    fineId,
    payload
  ) => {
    const res =
      await axiosClient.post(
        `/fines/${fineId}/verify-payment`,
        payload
      );

    return res.data.data;
  };


export const listAllFines =
  async (
    params = {}
  ) => {
    const cleaned =
      Object.fromEntries(
        Object.entries(
          params
        ).filter(
          (
            [, value]
          ) =>
            value !== '' &&
            value !== undefined &&
            value !== null
        )
      );

    const res =
      await axiosClient.get(
        '/fines',
        {
          params:
            cleaned,
        }
      );

    return res.data.data;
  };


export const recordManualPayment =
  async (
    fineId
  ) => {
    const res =
      await axiosClient.post(
        `/fines/${fineId}/pay`
      );

    return res.data.data;
  };


export const waiveFine =
  async (
    fineId,
    reason
  ) => {
    const res =
      await axiosClient.post(
        `/fines/${fineId}/waive`,
        {
          reason,
        }
      );

    return res.data.data;
  };