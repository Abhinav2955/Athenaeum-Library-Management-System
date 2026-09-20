import axiosClient
  from './axiosClient';

export const register =
  async (payload) => {
    const response =
      await axiosClient.post(
        '/auth/register',
        payload
      );

    return response.data.data;
  };

export const login =
  async (payload) => {
    const response =
      await axiosClient.post(
        '/auth/login',
        payload
      );

    return response.data.data;
  };

export const refreshSession =
  async () => {
    const response =
      await axiosClient.post(
        '/auth/refresh'
      );

    return response.data.data;
  };

export const logout =
  async () => {
    const response =
      await axiosClient.post(
        '/auth/logout'
      );

    return response.data.data;
  };

export const getMe =
  async () => {
    const response =
      await axiosClient.get(
        '/auth/me'
      );

    return response.data.data;
  };


export const verifyEmail =
  async (token) => {
    const response =
      await axiosClient.post(
        '/auth/verify-email',
        {
          token,
        }
      );

    return response.data.data;
  };

export const resendVerification =
  async (email) => {
    const response =
      await axiosClient.post(
        '/auth/resend-verification',
        {
          email,
        }
      );

    return response.data;
  };

export const forgotPassword =
  async (email) => {
    const response =
      await axiosClient.post(
        '/auth/forgot-password',
        {
          email,
        }
      );

    return response.data;
  };

export const resetPassword =
  async (
    token,
    password
  ) => {
    const response =
      await axiosClient.post(
        '/auth/reset-password',
        {
          token,
          password,
        }
      );

    return response.data;
  };

export const changePassword =
  async (
    currentPassword,
    newPassword
  ) => {
    const response =
      await axiosClient.post(
        '/auth/change-password',
        {
          currentPassword,
          newPassword,
        }
      );

    return response.data;
  };