/**
 * Universal Party Games Socket.IO Client & Party Room Navigation Helper
 * Handles local development, Render deployment, Vercel edge deployment,
 * player session resolution without host hijacking, and multi-game switching.
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

    if (backendUrl && typeof io === 'function') {
      return io(backendUrl, merged);
    }
    if (typeof io === 'function') {
      return io(merged);
    }
    return null;
  }

  /**
   * Safely resolves the player's unique name.
   * If URL has name, use it; otherwise check storage.
   * If completely empty, prompt the player or create a non-colliding guest name.
   */
  function resolvePlayerName(promptIfEmpty = false) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let name = urlParams.get('name') || urlParams.get('playerName');
      if (name && name.trim()) {
        const clean = name.trim().slice(0, 16);
        localStorage.setItem('party_player_name', clean);
        localStorage.setItem('playerName', clean);
        sessionStorage.setItem('playerName', clean);
        return clean;
      }

      name = sessionStorage.getItem('playerName') ||
             localStorage.getItem('party_player_name') ||
             localStorage.getItem('playerName');
      if (name && name.trim()) {
        return name.trim().slice(0, 16);
      }

      if (promptIfEmpty && typeof window !== 'undefined' && window.prompt) {
        const input = window.prompt("Enter your player name to join:", "");
        if (input && input.trim()) {
          const clean = input.trim().slice(0, 16);
          localStorage.setItem('party_player_name', clean);
          localStorage.setItem('playerName', clean);
          sessionStorage.setItem('playerName', clean);
          return clean;
        }
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const guestName = `Player_${randomSuffix}`;
      localStorage.setItem('party_player_name', guestName);
      localStorage.setItem('playerName', guestName);
      sessionStorage.setItem('playerName', guestName);
      return guestName;
    } catch (e) {
      return `Player_${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  /**
   * Generates a clean invite URL that points to the group join route and NEVER includes host name
   */
  function getCleanInviteUrl(roomId, gameType) {
    const cleanRoom = String(roomId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : '') || 'ROOM').trim().toUpperCase();
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
    let url = `${origin}/?join=${encodeURIComponent(cleanRoom)}`;
    if (gameType && gameType !== 'party') {
      url += `&game=${encodeURIComponent(gameType)}`;
    }
    const backend = getPartyBackendUrl();
    if (backend) {
      url += `&server=${encodeURIComponent(backend)}`;
    }
    return url;
  }

  /**
   * Universal listener for server-driven party game switching
   */
  function listenForPartyGameSwitch(socket, myPlayerName) {
    if (!socket || typeof socket.on !== 'function') return;

    socket.on('party:game-switched', (data) => {
      if (!data || !data.url) return;
      const name = encodeURIComponent(myPlayerName || resolvePlayerName());
      let dest = data.url;

      // Always pass the current player's distinct name so sessions never clash
      if (!dest.includes('name=')) {
        dest += (dest.includes('?') ? '&' : '?') + `name=${name}`;
      }

      const backendUrl = getPartyBackendUrl();
      if (backendUrl && !dest.includes('server=')) {
        dest += `&server=${encodeURIComponent(backendUrl)}`;
      }

      if (window.sounds && typeof window.sounds.play === 'function') {
        window.sounds.play('success');
      }

      window.location.href = dest;
    });
  }

  const PARTY_GAMES_LIST = [
    { id: 'party', title: 'Party Lobby Hub', icon: '🏠', desc: 'Return together to pick games' },
    { id: 'poker', title: "Texas Hold'em Poker", icon: '🃏', desc: "Chips, pots, and bluffing" },
    { id: 'imposter', title: 'The Imposter', icon: '🕵️', desc: 'Find the mole with word clues' },
    { id: 'wavelength', title: 'Wavelength', icon: '🌊', desc: 'Telepathy spectrum dial game' },
    { id: 'platformer', title: 'Co-op Platformer', icon: '🏃‍♂️', desc: 'Collaborative team puzzles' },
    { id: 'drawguess', title: 'Draw & Guess', icon: '🎨', desc: 'Live sketching & chat guessing' },
    { id: 'codenames', title: 'Codenames', icon: '🕵️', desc: 'Red vs Blue operative clues' },
    { id: 'trivia', title: 'Speed Trivia', icon: '⚡', desc: '15-second lightning quiz blitz' },
    { id: 'liarsdice', title: "Liar's Dice", icon: '🎲', desc: 'Dice shaking & table bids' },
    { id: 'spyfall', title: 'Spyfall', icon: '🕵️‍♂️', desc: 'Uncover the undercover spy' }
  ];

  /**
   * Opens the interactive Game Switcher modal for the host
   */
  function openPartySwitchModal(socket, roomId, isHost = true) {
    const cleanRoom = (roomId || (new URLSearchParams(window.location.search).get('room') || '')).toUpperCase();
    const existing = document.getElementById('partySwitchModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'partySwitchModal';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      z-index: 10000; display: flex; align-items: center; justify-content: center;
      padding: 16px; font-family: system-ui, -apple-system, sans-serif;
    `;
    overlay.onclick = (e) => {
      if (e.target === overlay) closePartySwitchModal();
    };

    const gamesHtml = PARTY_GAMES_LIST.map(g => `
      <div onclick="window.triggerPartyGameSwitch('${g.id}')" style="
        background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px; padding: 14px; cursor: pointer; display: flex; align-items: center;
        gap: 12px; transition: all 0.2s ease;
      " onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.borderColor='#38bdf8';this.style.transform='translateY(-2px)'"
         onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(255,255,255,0.12)';this.style.transform='none'">
        <div style="font-size: 26px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 8px;">${g.icon}</div>
        <div style="flex: 1; text-align: left;">
          <div style="color: #f8fafc; font-weight: 700; font-size: 14px;">${g.title}</div>
          <div style="color: #94a3b8; font-size: 12px; line-height: 1.3;">${g.desc}</div>
        </div>
        <div style="color: #38bdf8; font-size: 16px; font-weight: 700;">➔</div>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div style="
        background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 20px; max-width: 580px; width: 100%; max-height: 90vh;
        overflow-y: auto; padding: 24px; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7);
        position: relative; display: flex; flex-direction: column; gap: 16px;
      ">
        <button onclick="window.closePartySwitchModal()" style="
          position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.08);
          border: none; border-radius: 50%; width: 32px; height: 32px; color: #cbd5e1;
          font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
        ">✕</button>

        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 20px;">🔄</span>
            <h3 style="margin: 0; color: #f8fafc; font-size: 20px; font-weight: 800;">Switch Party Game</h3>
            <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">ROOM: ${cleanRoom}</span>
          </div>
          <p style="margin: 0; color: #94a3b8; font-size: 13px;">
            Pick a new game or return to the lobby. All connected players migrate together automatically without re-entering the room code!
          </p>
        </div>

        <div id="partySwitchList" style="display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto; padding-right: 4px;">
          ${gamesHtml}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    window._partySwitchSocket = socket;
    window._partySwitchRoomId = cleanRoom;

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closePartySwitchModal();
        window.removeEventListener('keydown', escHandler);
      }
    };
    window.addEventListener('keydown', escHandler);
  }

  function closePartySwitchModal() {
    const modal = document.getElementById('partySwitchModal');
    if (modal) modal.remove();
  }

  function triggerPartyGameSwitch(targetGame) {
    const socket = window._partySwitchSocket || window.socket;
    const roomId = window._partySwitchRoomId || (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
    if (!socket || !roomId) {
      alert('Unable to switch games at this time');
      return;
    }

    const list = document.getElementById('partySwitchList');
    if (list) {
      list.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #38bdf8; font-weight: 700;">
          <div style="font-size: 32px; animation: spin 1s linear infinite; margin-bottom: 12px;">🔄</div>
          Switching all players to ${targetGame.toUpperCase()}...
        </div>
      `;
    }

    socket.emit('party:switch-game', { newGameType: targetGame, roomId });
  }

  window.getPartyBackendUrl = getPartyBackendUrl;
  window.initPartySocket = initPartySocket;
  window.resolvePlayerName = resolvePlayerName;
  window.getCleanInviteUrl = getCleanInviteUrl;
  window.listenForPartyGameSwitch = listenForPartyGameSwitch;
  window.openPartySwitchModal = openPartySwitchModal;
  window.closePartySwitchModal = closePartySwitchModal;
  window.triggerPartyGameSwitch = triggerPartyGameSwitch;
})();
