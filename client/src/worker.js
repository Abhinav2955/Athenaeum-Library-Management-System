const BACKEND_ORIGIN =
  'https://athenaeum-backend-g5pw.onrender.com';

const proxyToBackend = async (request) => {
  const incomingUrl = new URL(request.url);

  const targetUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    BACKEND_ORIGIN
  );

  const upstreamRequest = new Request(
    targetUrl.toString(),
    request
  );

  return fetch(upstreamRequest);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/api' ||
      url.pathname.startsWith('/socket.io/')
    ) {
      return proxyToBackend(request);
    }

    return env.ASSETS.fetch(request);
  },
};