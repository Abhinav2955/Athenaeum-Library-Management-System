import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api/v1';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token;

  if (token) {
    axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete axiosClient.defaults.headers.common.Authorization;
};

export const getAccessToken = () => accessToken;

const noRefreshPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
];

const shouldSkipRefresh = (url = '') =>
  noRefreshPaths.some((path) => url.includes(path));

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const response = error.response;

    if (
      response?.status !== 401 ||
      !config ||
      config._retried ||
      shouldSkipRefresh(config.url)
    ) {
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      if (!refreshPromise) {
        refreshPromise = axiosClient
          .post('/auth/refresh')
          .finally(() => {
            refreshPromise = null;
          });
      }

      const refreshResponse = await refreshPromise;
      const newAccessToken = refreshResponse.data.data.accessToken;

      setAccessToken(newAccessToken);

      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${newAccessToken}`;

      return axiosClient(config);
    } catch {
      setAccessToken(null);
      return Promise.reject(error);
    }
  }
);

export default axiosClient;