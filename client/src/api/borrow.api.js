import axiosClient
  from './axiosClient';

export const checkoutBook =
  async (bookId) => {
    const res =
      await axiosClient.post(
        '/borrow/checkout',
        {
          bookId,
        }
      );

    return res.data.data;
  };

export const staffCheckoutBook =
  async ({
    bookId,
    userId,
  }) => {
    const res =
      await axiosClient.post(
        '/borrow/checkout',
        {
          bookId,
          userId,
        }
      );

    return res.data.data;
  };

/*
 * condition:
 *
 * good
 * damaged
 */
export const returnLoan =
  async (
    recordId,
    condition = 'good'
  ) => {
    const res =
      await axiosClient.post(
        `/borrow/${recordId}/return`,
        {
          condition,
        }
      );

    return {
      data:
        res.data.data,

      message:
        res.data.message,
    };
  };

/*
 * Staff reports a checked-out book as lost.
 */
export const markLoanLost =
  async (
    recordId
  ) => {
    const res =
      await axiosClient.post(
        `/borrow/${recordId}/lost`
      );

    return res.data.data;
  };

export const renewLoan =
  async (
    recordId
  ) => {
    const res =
      await axiosClient.post(
        `/borrow/${recordId}/renew`
      );

    return res.data.data;
  };

export const listMyLoans =
  async (
    params = {}
  ) => {
    const res =
      await axiosClient.get(
        '/borrow/me',
        {
          params,
        }
      );

    return res.data.data;
  };

export const listAllLoans =
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
        '/borrow',
        {
          params:
            cleaned,
        }
      );

    return res.data.data;
  };

export const addCopies =
  async ({
    bookId,
    quantity,
    shelfLocation,
  }) => {
    const res =
      await axiosClient.post(
        '/borrow/copies',
        {
          bookId,
          quantity,
          shelfLocation,
        }
      );

    return res.data.data;
  };

export const listCopiesForBook =
  async (
    bookId
  ) => {
    const res =
      await axiosClient.get(
        '/borrow/copies',
        {
          params: {
            bookId,
          },
        }
      );

    return res.data.data;
  };

/*
 * Repair lifecycle:
 *
 * available
 * damaged
 * under_repair
 */
export const updateCopyStatus =
  async (
    copyId,
    status
  ) => {
    const res =
      await axiosClient.patch(
        `/borrow/copies/${copyId}/status`,
        {
          status,
        }
      );

    return res.data.data;
  };

export const retireCopy =
  async (
    copyId
  ) => {
    const res =
      await axiosClient.post(
        `/borrow/copies/${copyId}/retire`
      );

    return res.data.data;
  };