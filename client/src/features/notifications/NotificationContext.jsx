import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useAuth } from '../auth/AuthContext';

import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications.api';

import {
  connectSocket,
  disconnectSocket,
} from './socket';

const NotificationContext = createContext(null);

export function NotificationProvider({
  children,
}) {
  const {
    user,
    accessToken,
  } = useAuth();

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const fetchNotifications =
    useCallback(async () => {
      try {
        const {
          notifications: results,
          unreadCount: count,
        } =
          await listMyNotifications({
            limit: 20,
          });

        setNotifications(results);
        setUnreadCount(count);
      } catch {
        return;
      }
    }, []);

  useEffect(() => {
    if (!user || !accessToken) {
      disconnectSocket();
      setNotifications([]);
      setUnreadCount(0);

      return undefined;
    }

    fetchNotifications();

    const socket = connectSocket();

    const handleIncoming = (incoming) => {
      setNotifications((prev) => [
        incoming,
        ...prev.filter(
          (notification) =>
            notification.id !== incoming.id
        ),
      ].slice(0, 20));

      setUnreadCount(
        (prev) => prev + 1
      );
    };

    socket?.on(
      'notification',
      handleIncoming
    );

    return () => {
      socket?.off(
        'notification',
        handleIncoming
      );

      disconnectSocket();
    };
  }, [
    user,
    accessToken,
    fetchNotifications,
  ]);

  const markRead =
    useCallback(async (id) => {
      let wasUnread = false;

      setNotifications((prev) =>
        prev.map((notification) => {
          if (
            notification.id === id &&
            !notification.readAt
          ) {
            wasUnread = true;

            return {
              ...notification,
              readAt:
                new Date().toISOString(),
            };
          }

          return notification;
        })
      );

      if (wasUnread) {
        setUnreadCount((prev) =>
          Math.max(0, prev - 1)
        );
      }

      try {
        await markNotificationRead(id);
      } catch {
        return;
      }
    }, []);

  const markAllRead =
    useCallback(async () => {
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          readAt:
            notification.readAt ||
            new Date().toISOString(),
        }))
      );

      setUnreadCount(0);

      try {
        await markAllNotificationsRead();
      } catch {
        return;
      }
    }, []);

  const value = {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    refetch: fetchNotifications,
  };

  return (
    <NotificationContext.Provider
      value={value}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context =
    useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }

  return context;
};