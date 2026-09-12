import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import axiosClient
  from '../../api/axiosClient';

import * as authApi
  from '../../api/auth.api';

const AuthContext =
  createContext(null);

const setAxiosAccessToken =
  (token) => {
    if (token) {
      axiosClient.defaults
        .headers
        .common
        .Authorization =
          `Bearer ${token}`;

      return;
    }

    delete axiosClient
      .defaults
      .headers
      .common
      .Authorization;
  };

export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(null);

  const [
    accessToken,
    setAccessTokenState,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const establishSession =
    useCallback(
      ({
        user:
          sessionUser,
        accessToken:
          token,
      }) => {
        setUser(
          sessionUser
        );

        setAccessTokenState(
          token
        );

        setAxiosAccessToken(
          token
        );
      },
      []
    );

  const clearSession =
    useCallback(
      () => {
        setUser(null);

        setAccessTokenState(
          null
        );

        setAxiosAccessToken(
          null
        );
      },
      []
    );

  
  useEffect(() => {
    let mounted = true;

    const bootstrap =
      async () => {
        try {
          const result =
            await authApi
              .refreshSession();

          if (mounted) {
            establishSession(
              result
            );
          }
        } catch {
          if (mounted) {
            clearSession();
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [
    establishSession,
    clearSession,
  ]);

  const login =
    useCallback(
      async (
        credentials
      ) => {
        const result =
          await authApi.login(
            credentials
          );

        establishSession(
          result
        );

        return result;
      },
      [
        establishSession,
      ]
    );

  
  const register =
    useCallback(
      async (
        payload
      ) => {
        return authApi.register(
          payload
        );
      },
      []
    );

  const verifyAndLogin =
    useCallback(
      async (token) => {
        const result =
          await authApi
            .verifyEmail(
              token
            );

        establishSession(
          result
        );

        return result;
      },
      [
        establishSession,
      ]
    );

  const logout =
    useCallback(
      async () => {
        try {
          await authApi.logout();
        } finally {
          clearSession();
        }
      },
      [
        clearSession,
      ]
    );

  const value =
    useMemo(
      () => ({
        user,
        accessToken,
        loading,

        isAuthenticated:
          Boolean(
            user &&
            accessToken
          ),

        login,
        register,
        verifyAndLogin,
        logout,
        establishSession,
      }),
      [
        user,
        accessToken,
        loading,
        login,
        register,
        verifyAndLogin,
        logout,
        establishSession,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}