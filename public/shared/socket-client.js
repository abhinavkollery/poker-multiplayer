/**
 * Universal Party Games Socket.IO Client Helper
 * Handles local development, Render deployment, and Vercel edge deployment.
 */
(function() {
  function getPartyBackendUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fromParam = urlParams.get('server');
      if (fromParam && fromParam.trim()) {
        const clean = fromParam.trim().replace(/\/+$/, '');
        localStorage.setItem('party_server_url', clean);
        return clean;
      }
      const fromStorage = localStorage.getItem('party_server_url');
      if (fromStorage && fromStorage.trim()) {
        return fromStorage.trim().replace(/\/+$/, '');
      }
      if (window.PARTY_SERVER_URL && typeof window.PARTY_SERVER_URL === 'string') {
        return window.PARTY_SERVER_URL.trim().replace(/\/+$/, '');
      }
    } catch (e) {}
    return undefined;
  }

  function initPartySocket(options = {}) {
    const backendUrl = getPartyBackendUrl();
    const defaultOptions = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 20000
    };
    const merged = Object.assign({}, defaultOptions, options);

    if (backendUrl) {
      // Connect to specified remote backend (e.g., Render backend from Vercel frontend)
      return io(backendUrl, merged);
    }
    // Connect to current origin
    return io(merged);
  }

  window.getPartyBackendUrl = getPartyBackendUrl;
  window.initPartySocket = initPartySocket;
})();

