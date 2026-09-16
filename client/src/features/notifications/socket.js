import { io } from 'socket.io-client';
import { getAccessToken } from '../../api/axiosClient';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  'http://localhost:5000';

let socket = null;

export const connectSocket = () => {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  if (socket) {
    socket.auth = { token };

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: [
      'websocket',
      'polling',
    ],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};