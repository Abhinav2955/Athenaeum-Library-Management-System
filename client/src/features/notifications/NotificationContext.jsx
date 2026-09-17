import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useAuth,
} from '../auth/AuthContext';

import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications.api';

import {
  connectSocket,
  disconnectSocket,
} from './socket';

const NotificationContext =
  createContext(null);

export function NotificationProvider({
  children,
}) {
  const {
    user,
    accessToken,
    refreshUser,
  } = useAuth();

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    resourceVersions,
    setResourceVersions,
  ] = useState({});

  const pendingResourcesRef =
    useRef(
      new Set()
    );

  const resourceTimerRef =
    useRef(null);

  const profileRefreshPendingRef =
    useRef(false);

  const fetchNotifications =
    useCallback(
      async () => {
        try {
          const {
            notifications:
              results,
            unreadCount:
              count,
          } =
            await listMyNotifications({
              limit: 20,
            });

          setNotifications(
            results
          );

          setUnreadCount(
            count
          );
        } catch {
          return;
        }
      },
      []
    );

  useEffect(() => {
    if (
      !user ||
      !accessToken
    ) {
      disconnectSocket();

      if (
        resourceTimerRef.current
      ) {
        clearTimeout(
          resourceTimerRef.current
        );

        resourceTimerRef.current =
          null;
      }

      pendingResourcesRef.current.clear();

      profileRefreshPendingRef.current =
        false;

      setNotifications(
        []
      );

      setUnreadCount(
        0
      );

      setResourceVersions(
        {}
      );

      return undefined;
    }

    fetchNotifications();

    const socket =
      connectSocket();

    const handleIncoming =
      (incoming) => {
        setNotifications(
          (previous) => [
            incoming,

            ...previous.filter(
              (
                notification
              ) =>
                notification.id !==
                incoming.id
            ),
          ].slice(
            0,
            20
          )
        );

        setUnreadCount(
          (previous) =>
            previous + 1
        );
      };

    const flushResources =
      () => {
        resourceTimerRef.current =
          null;

        const resources =
          Array.from(
            pendingResourcesRef.current
          );

        pendingResourcesRef.current.clear();

        if (
          resources.length ===
          0
        ) {
          profileRefreshPendingRef.current =
            false;

          return;
        }

        setResourceVersions(
          (previous) => {
            const next = {
              ...previous,
            };

            for (
              const resource of resources
            ) {
              next[
                resource
              ] =
                (
                  previous[
                    resource
                  ] || 0
                ) + 1;
            }

            return next;
          }
        );

        if (
          profileRefreshPendingRef.current
        ) {
          profileRefreshPendingRef.current =
            false;

          refreshUser().catch(
            () => {}
          );
        }
      };

    const handleDataChanged =
      (payload) => {
        const resources =
          Array.isArray(
            payload?.resources
          )
            ? payload.resources
            : [];

        if (
          resources.length ===
          0
        ) {
          return;
        }

        for (
          const resource of resources
        ) {
          if (resource) {
            pendingResourcesRef.current.add(
              resource
            );
          }
        }

        if (
          resources.includes(
            'profile'
          )
        ) {
          profileRefreshPendingRef.current =
            true;
        }

        if (
          resourceTimerRef.current
        ) {
          clearTimeout(
            resourceTimerRef.current
          );
        }

        resourceTimerRef.current =
          setTimeout(
            flushResources,
            50
          );
      };

    socket?.on(
      'notification',
      handleIncoming
    );

    socket?.on(
      'data_changed',
      handleDataChanged
    );

    return () => {
      socket?.off(
        'notification',
        handleIncoming
      );

      socket?.off(
        'data_changed',
        handleDataChanged
      );

      if (
        resourceTimerRef.current
      ) {
        clearTimeout(
          resourceTimerRef.current
        );

        resourceTimerRef.current =
          null;
      }

      pendingResourcesRef.current.clear();

      profileRefreshPendingRef.current =
        false;

      disconnectSocket();
    };
  }, [
    user,
    accessToken,
    fetchNotifications,
    refreshUser,
  ]);

  const markRead =
    useCallback(
      async (id) => {
        let wasUnread =
          false;

        setNotifications(
          (previous) =>
            previous.map(
              (
                notification
              ) => {
                if (
                  notification.id ===
                    id &&
                  !notification.readAt
                ) {
                  wasUnread =
                    true;

                  return {
                    ...notification,

                    readAt:
                      new Date().toISOString(),
                  };
                }

                return notification;
              }
            )
        );

        if (
          wasUnread
        ) {
          setUnreadCount(
            (previous) =>
              Math.max(
                0,
                previous - 1
              )
          );
        }

        try {
          await markNotificationRead(
            id
          );
        } catch {
          return;
        }
      },
      []
    );

  const markAllRead =
    useCallback(
      async () => {
        setNotifications(
          (previous) =>
            previous.map(
              (
                notification
              ) => ({
                ...notification,

                readAt:
                  notification.readAt ||
                  new Date().toISOString(),
              })
            )
        );

        setUnreadCount(
          0
        );

        try {
          await markAllNotificationsRead();
        } catch {
          return;
        }
      },
      []
    );

  const value =
    useMemo(
      () => ({
        notifications,
        unreadCount,
        resourceVersions,
        markRead,
        markAllRead,

        refetch:
          fetchNotifications,
      }),
      [
        notifications,
        unreadCount,
        resourceVersions,
        markRead,
        markAllRead,
        fetchNotifications,
      ]
    );

  return (
    <NotificationContext.Provider
      value={
        value
      }
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications =
  () => {
    const context =
      useContext(
        NotificationContext
      );

    if (!context) {
      throw new Error(
        'useNotifications must be used within a NotificationProvider'
      );
    }

    return context;
  };

export const useResourceVersion =
  (resource) => {
    const {
      resourceVersions,
    } =
      useNotifications();

    return (
      resourceVersions[
        resource
      ] || 0
    );
  };
  