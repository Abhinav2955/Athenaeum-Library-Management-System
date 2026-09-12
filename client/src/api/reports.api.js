import axiosClient
  from './axiosClient';

export const getDashboardSummary =
  async () => {
    const res =
      await axiosClient.get(
        '/reports/dashboard'
      );

    return res.data.data;
  };

export const getInventoryHealth =
  async () => {
    const res =
      await axiosClient.get(
        '/reports/inventory-health'
      );

    return res.data.data;
  };

export const getTopBooks =
  async (
    limit = 10
  ) => {
    const res =
      await axiosClient.get(
        '/reports/top-books',
        {
          params: {
            limit,
          },
        }
      );

    return res.data.data;
  };

export const getOverdueLoans =
  async () => {
    const res =
      await axiosClient.get(
        '/reports/overdue'
      );

    return res.data.data;
  };

export const getFineRevenue =
  async () => {
    const res =
      await axiosClient.get(
        '/reports/fines-revenue'
      );

    return res.data.data;
  };

export const getCirculationStats =
  async (
    days = 30
  ) => {
    const res =
      await axiosClient.get(
        '/reports/circulation',
        {
          params: {
            days,
          },
        }
      );

    return res.data.data;
  };

const downloadBlob =
  (
    data,
    filename
  ) => {
    const url =
      window.URL
        .createObjectURL(
          new Blob(
            [data]
          )
        );

    const link =
      document
        .createElement(
          'a'
        );

    link.href =
      url;

    link.download =
      filename;

    document.body
      .appendChild(
        link
      );

    link.click();

    link.remove();

    window.URL
      .revokeObjectURL(
        url
      );
  };

export const downloadOverdueCsv =
  async () => {
    const res =
      await axiosClient.get(
        '/reports/overdue/export',
        {
          responseType:
            'blob',
        }
      );

    downloadBlob(
      res.data,
      'overdue-loans.csv'
    );
  };

export const downloadInventoryCsv =
  async () => {
    const res =
      await axiosClient.get(
        '/reports/inventory/export',
        {
          responseType:
            'blob',
        }
      );

    downloadBlob(
      res.data,
      'inventory-report.csv'
    );
  };