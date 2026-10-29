const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');

const PokerGame = require('./games/poker/game');
const ImposterGame = require('./games/imposter/game');
const WavelengthGame = require('./games/wavelength/game');
const PlatformerGame = require('./games/platformer/game');
const DrawGuessGame = require('./games/drawguess/game');
const CodenamesGame = require('./games/codenames/game');
const SpeedTriviaGame = require('./games/trivia/game');
const LiarsDiceGame = require('./games/liarsdice/game');
const SpyfallGame = require('./games/spyfall/game');
const PartyLobbyGame = require('./games/party/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());

// Enable CORS for Vercel, Render, and custom domains
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Specific game routes (registered before express.static)
app.get(['/poker', '/poker/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/poker/lobby.html'));
});
app.get(['/poker/game', '/poker/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/poker/game.html'));
});
app.get('/game.html', (req, res) => {
  // Backwards compatibility for existing poker links
  res.sendFile(path.join(__dirname, '../public/poker/game.html'));
});

// Imposter
app.get(['/imposter', '/imposter/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/imposter/game.html'));
});
app.get(['/imposter/game', '/imposter/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/imposter/game.html'));
});

// Wavelength
app.get(['/wavelength', '/wavelength/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/wavelength/game.html'));
});
app.get(['/wavelength/game', '/wavelength/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/wavelength/game.html'));
});

// Platformer
app.get(['/platformer', '/platformer/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platformer/game.html'));
});
app.get(['/platformer/game', '/platformer/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platformer/game.html'));
});

// Draw & Guess
app.get(['/drawguess', '/drawguess/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/drawguess/game.html'));
});
app.get(['/drawguess/game', '/drawguess/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/drawguess/game.html'));
});

// Codenames
app.get(['/codenames', '/codenames/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/codenames/game.html'));
});
app.get(['/codenames/game', '/codenames/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/codenames/game.html'));
});

// Speed Trivia
app.get(['/trivia', '/trivia/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/trivia/game.html'));
});
app.get(['/trivia/game', '/trivia/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/trivia/game.html'));
});

// Liar's Dice
app.get(['/liarsdice', '/liarsdice/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/liarsdice/game.html'));
});
app.get(['/liarsdice/game', '/liarsdice/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/liarsdice/game.html'));
});

// Spyfall
app.get(['/spyfall', '/spyfall/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/spyfall/game.html'));
});
app.get(['/spyfall/game', '/spyfall/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/spyfall/game.html'));
});

app.use(express.static(path.join(__dirname, '../public')));

const rooms = new Map(); // roomId -> GameInstance

function createGameInstance(gameType, roomId, payload = {}) {
  let game;
  if (gameType === 'party' || gameType === 'lobby') {
    game = new PartyLobbyGame(roomId, payload);
  } else if (gameType === 'imposter') {
    game = new ImposterGame(roomId, payload);
  } else if (gameType === 'wavelength') {
    game = new WavelengthGame(roomId, payload);
  } else if (gameType === 'platformer') {
    game = new PlatformerGame(roomId, payload);
  } else if (gameType === 'drawguess') {
    game = new DrawGuessGame(roomId, payload);
  } else if (gameType === 'codenames') {
    game = new CodenamesGame(roomId, payload);
  } else if (gameType === 'trivia') {
    game = new SpeedTriviaGame(roomId, payload);
  } else if (gameType === 'liarsdice') {
    game = new LiarsDiceGame(roomId, payload);
  } else if (gameType === 'spyfall') {
    game = new SpyfallGame(roomId, payload);
  } else {
    // Poker
    game = new PokerGame(roomId, {
      maxPlayers: Math.min(8, Math.max(2, Number(payload.maxPlayers) || 6)),
      startingChips: Number(payload.startingChips) || 1000,
      smallBlind: Number(payload.smallBlind) || 10,
      bigBlind: Number(payload.bigBlind) || 20
    });
  }

  if (typeof game.setIO === 'function') {
    game.setIO(io);
  } else {
    game.io = io;
  }
  return game;
}

// REST endpoint for health and server status (Vercel & Render)
app.get(['/api', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    games: ['poker', 'imposter', 'wavelength', 'platformer', 'drawguess', 'codenames', 'trivia', 'liarsdice', 'spyfall']
  });
});

// REST endpoint to inspect room status
app.get('/api/room/:roomId', (req, res) => {
  const roomId = (req.params.roomId || '').toUpperCase();
  const game = rooms.get(roomId);
  if (!game) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    roomId: game.roomId,
    gameType: game.gameType || 'poker',
    playerCount: game.players.length,
    maxPlayers: game.maxPlayers,
    state: game.state
  });
});

// Helper: determine local LAN IPv4 address for QR code sharing on Wi-Fi
function getLocalNetworkIp() {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return null;
}

// REST endpoint for local network IP info (for Wi-Fi QR code connection)
app.get('/api/network-info', (req, res) => {
  const localIp = getLocalNetworkIp();
  const port = process.env.PORT || 3000;
  res.json({
    localIp,
    port,
    origin: localIp ? `http://${localIp}:${port}` : null
  });
});

// Persistent Room & Player Disconnection Management
const roomCleanupTimers = new Map(); // roomId -> Timeout
const playerDisconnectTimers = new Map(); // `${roomId}:${playerId}` -> Timeout

function scheduleRoomCleanup(roomId) {
  if (roomCleanupTimers.has(roomId)) return;
  const timer = setTimeout(() => {
    roomCleanupTimers.delete(roomId);
    const game = rooms.get(roomId);
    if (!game) return;
    const anyConnected = game.players.some(p => p.connected);
    if (!anyConnected) {
      if (typeof game.clearTurnTimer === 'function') game.clearTurnTimer();
      if (typeof game.clearTimer === 'function') game.clearTimer();
      rooms.delete(roomId);
    }
  }, 60000); // 60s grace period for page reloads / navigation
  roomCleanupTimers.set(roomId, timer);
}

function cancelRoomCleanup(roomId) {
  const timer = roomCleanupTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(roomId);
  }
}

function getRoomHost(game) {
  if (!game || !game.players || game.players.length === 0) return null;
  // 1. By stored host name
  if (game.hostName) {
    const hostByName = game.players.find(p => p.name && p.name.toLowerCase() === game.hostName.toLowerCase());
    if (hostByName) return hostByName;
  }
  // 2. By stored host player id
  if (game.hostPlayerId) {
    const hostById = game.players.find(p => p.id === game.hostPlayerId);
    if (hostById) return hostById;
  }
  // 3. First connected human player, or first player
  const firstConnected = game.players.find(p => p.connected && !p.isBot);
  return firstConnected || game.players[0];
}

function isSocketHost(game, socket) {
  if (!game || !socket) return false;
  const host = getRoomHost(game);
  if (!host) return false;
  if (socket.id === host.id) return true;
  if (socket.data?.name && game.hostName && socket.data.name.toLowerCase() === game.hostName.toLowerCase()) {
    return true;
  }
  if (socket.data?.isHost === true && socket.data?.roomId === game.roomId) {
    return true;
  }
  return false;
}

function emitPersonalizedStates(game, socketIo) {
  if (!game) return;
  const host = getRoomHost(game);
  for (const player of game.players) {
    const sock = socketIo.sockets.sockets.get(player.id);
    if (sock) {
      const state = game.getStateForPlayer(player.id) || {};
      state.isHost = host ? (player.id === host.id || (player.name && host.name && player.name.toLowerCase() === host.name.toLowerCase())) : false;
      state.hostId = host?.id || null;
      state.hostName = host?.name || null;
      if (Array.isArray(state.players)) {
        state.players.forEach(p => {
          if (host && (p.id === host.id || (p.name && host.name && p.name.toLowerCase() === host.name.toLowerCase()))) {
            p.isHost = true;
          }
        });
      }
      sock.emit('game-state', state);
    }
  }
}

function broadcastLobbyUpdate(game, socketIo) {
  if (!game) return;
  const host = getRoomHost(game);
  socketIo.to(game.roomId).emit('lobby-update', {
    roomId: game.roomId,
    gameType: game.gameType,
    hostId: host?.id || null,
    hostName: host?.name || null,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      team: p.team,
      role: p.role,
      ready: p.ready,
      connected: p.connected,
      isBot: p.isBot || false,
      isHost: host ? (p.id === host.id || (p.name && host.name && p.name.toLowerCase() === host.name.toLowerCase())) : false
    })),
    canStart: game.canStart(),
    maxPlayers: game.maxPlayers,
    state: game.state
  });
}

// Socket.io handlers
io.on('connection', socket => {
  // 1. Create Room (Multi-game)
  socket.on('create-room', (payload = {}) => {
    const gameType = payload.gameType || 'poker';
    const name = (payload.name || 'Host').trim();
    const roomId = uuidv4().substring(0, 6).toUpperCase();

    const game = createGameInstance(gameType, roomId, payload);
    game.hostName = name;
    game.creatorName = name;
    game.hostPlayerId = socket.id;
    rooms.set(roomId, game);

    const joinResult = game.addPlayer(socket.id, name);
    if (joinResult.error) {
      socket.emit('action-error', joinResult.error);
      return;
    }

    socket.join(roomId);
    socket.data = {
      roomId,
      gameType: game.gameType,
      name: joinResult.player.name,
      isHost: true
    };

    socket.emit('room-created', {
      roomId,
      gameType: game.gameType,
      isHost: true,
      hostId: socket.id,
      hostName: name
    });

    const state = game.getStateForPlayer(socket.id) || {};
    state.isHost = true;
    state.hostId = socket.id;
    state.hostName = name;
    if (Array.isArray(state.players)) {
      state.players.forEach(p => {
        if (p.id === socket.id) p.isHost = true;
      });
    }
    socket.emit('game-state', state);
    broadcastLobbyUpdate(game, io);
  });

  // 2. Join Room
  socket.on('join-room', (payload = {}) => {
    const roomId = payload.roomId;
    const name = (payload.name || '').trim();
    if (!roomId) {
      socket.emit('join-error', 'Room ID is required');
      return;
    }

    const cleanRoomId = String(roomId || '').trim().toUpperCase();
    cancelRoomCleanup(cleanRoomId);

    const game = rooms.get(cleanRoomId);
    if (!game) {
      socket.emit('join-error', 'Room not found. Check the code and try again.');
      return;
    }

    // Cancel pending disconnect timers for this player
    const cleanName = (name || '').toLowerCase();
    for (const [key, timer] of playerDisconnectTimers.entries()) {
      if (key.startsWith(`${cleanRoomId}:`)) {
        clearTimeout(timer);
        playerDisconnectTimers.delete(key);
      }
    }

    let reconnected = false;
    let player = null;

    // 1. Try game's reconnectPlayer first
    const reconnectResult = (typeof game.reconnectPlayer === 'function')
      ? game.reconnectPlayer(socket.id, name)
      : { success: false };

    if (reconnectResult && reconnectResult.collision) {
      socket.emit('join-error', reconnectResult.error);
      return;
    }

    if (reconnectResult && reconnectResult.success) {
      reconnected = true;
      player = reconnectResult.player;
    } else {
      // 2. Check if a player with this name already exists in game.players
      const existing = game.players.find(p => p.name && p.name.toLowerCase() === cleanName);
      if (existing) {
        if (existing.connected && existing.id !== socket.id) {
          socket.emit('join-error', `A player named "${name}" is already active in this room. Please choose another name.`);
          return;
        }
        existing.id = socket.id;
        existing.connected = true;
        reconnected = true;
        player = existing;
      } else {
        // 3. Add as new player
        const addResult = game.addPlayer(socket.id, name);
        if (addResult.error) {
          socket.emit('join-error', addResult.error);
          return;
        }
        if (addResult.reconnected) {
          reconnected = true;
        }
        player = addResult.player;
      }
    }

    // Preserve/update host assignment
    if (game.hostName && player.name && player.name.toLowerCase() === game.hostName.toLowerCase()) {
      game.hostPlayerId = socket.id;
    } else if (!game.hostName && game.players[0]?.id === socket.id) {
      game.hostName = player.name;
      game.hostPlayerId = socket.id;
    }

    const host = getRoomHost(game);
    const isHost = host ? (host.id === socket.id || (player && player.name && host.name && player.name.toLowerCase() === host.name.toLowerCase())) : false;

    socket.join(cleanRoomId);
    socket.data = {
      roomId: cleanRoomId,
      gameType: game.gameType,
      name: player.name,
      isHost: !!isHost
    };

    socket.emit('room-joined', {
      roomId: cleanRoomId,
      gameType: game.gameType,
      reconnected,
      isHost: !!isHost,
      hostId: host?.id || null,
      hostName: host?.name || null
    });

    const state = game.getStateForPlayer(socket.id) || {};
    state.isHost = !!isHost;
    state.hostId = host?.id || null;
    state.hostName = host?.name || null;
    if (Array.isArray(state.players)) {
      state.players.forEach(p => {
        if (host && (p.id === host.id || (p.name && host.name && p.name.toLowerCase() === host.name.toLowerCase()))) {
          p.isHost = true;
        }
      });
    }
    socket.emit('game-state', state);
    broadcastLobbyUpdate(game, io);

    socket.to(cleanRoomId).emit('player-joined', {
      name: player.name,
      id: socket.id
    });

    if (game.state !== 'waiting') {
      emitPersonalizedStates(game, io);
    }
  });

  // 3. Start Game
  socket.on('start-game', (options = {}) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    if (!isSocketHost(game, socket)) {
      socket.emit('action-error', 'Only the room host can start the game');
      return;
    }

    if (!game.canStart()) {
      socket.emit('action-error', 'Cannot start: not enough players to play');
      return;
    }

    game.startGame(options);
    emitPersonalizedStates(game, io);
    broadcastLobbyUpdate(game, io);
  });

  // 4. Universal Player Action
  socket.on('player-action', (payload = {}) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    const action = typeof payload === 'string' ? payload : (payload.action || payload.type);
    let result;
    if (game.gameType === 'poker') {
      result = game.handleAction(socket.id, action, payload.amount !== undefined ? payload.amount : payload);
    } else {
      result = game.handleAction(socket.id, action, payload);
    }

    if (result && result.error) {
      socket.emit('action-error', result.error);
    } else if (result && !result.silent) {
      emitPersonalizedStates(game, io);
    }
  });

  // 5. Party Game Switching & Real-Time Selection (Seamless Host Room Migration)
  socket.on('party:select-game', (payload = {}) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    if (!isSocketHost(game, socket)) {
      socket.emit('action-error', 'Only the host can select games');
      return;
    }

    const selectedGame = payload.gameType || payload.game || 'poker';
    if (typeof game.handleAction === 'function') {
      game.handleAction(socket.id, 'select-game', { gameType: selectedGame, options: payload.options });
    }

    io.to(roomId).emit('party:game-selected', {
      selectedGame,
      options: payload.options || {}
    });
    broadcastLobbyUpdate(game, io);
  });

  socket.on('party:switch-game', (payload = {}) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const oldGame = rooms.get(roomId);
    if (!oldGame) return;

    if (!isSocketHost(oldGame, socket)) {
      socket.emit('action-error', 'Only the host can switch games');
      return;
    }

    const newGameType = payload.newGameType || payload.gameType || 'party';
    const gameOptions = payload.options || payload.gameOptions || {};

    if (typeof oldGame.clearTimer === 'function') oldGame.clearTimer();
    if (typeof oldGame.clearTurnTimer === 'function') oldGame.clearTurnTimer();

    const newGame = createGameInstance(newGameType, roomId, gameOptions);
    const host = getRoomHost(oldGame);
    newGame.hostName = host ? host.name : (oldGame.hostName || socket.data?.name);
    newGame.creatorName = newGame.hostName;
    newGame.hostPlayerId = host ? host.id : socket.id;

    // Migrate active connected/recent human players, eliminating ghosts and bots
    const activePlayers = oldGame.players.filter(p => !p.isBot);
    activePlayers.forEach(p => {
      newGame.addPlayer(p.id, p.name);
    });

    rooms.set(roomId, newGame);

    const redirectUrl = (newGameType === 'party' || newGameType === 'lobby')
      ? `/?room=${roomId}`
      : `/${newGameType}/game.html?room=${roomId}`;

    io.to(roomId).emit('party:game-switched', {
      newGameType,
      roomId,
      url: redirectUrl
    });

    // Also send updated lobby & game states to the room sockets
    broadcastLobbyUpdate(newGame, io);
    emitPersonalizedStates(newGame, io);
  });

  // 6. Floating Reactions & Poker Bots
  socket.on('party:reaction', ({ emoji }) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    io.to(roomId).emit('party:reaction', {
      emoji,
      senderName: socket.data?.name || 'Someone'
    });
  });

  socket.on('poker:add-bot', (payload = {}) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'poker') {
      if (!isSocketHost(game, socket)) {
        socket.emit('action-error', 'Only the host can add bots');
        return;
      }
      const bot = game.addBot(payload.name);
      if (bot.error) {
        socket.emit('action-error', bot.error);
      } else {
        emitPersonalizedStates(game, io);
        broadcastLobbyUpdate(game, io);
      }
    }
  });

  // Host Kick Player from room
  socket.on('party:kick-player', ({ targetId }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (!game || !isSocketHost(game, socket)) return;
    if (targetId === socket.id) return;
    game.removePlayer(targetId);
    const targetSock = io.sockets.sockets.get(targetId);
    if (targetSock) {
      targetSock.emit('action-error', 'You were removed from the room by the host');
      targetSock.leave(roomId);
      targetSock.disconnect(true);
    }
    broadcastLobbyUpdate(game, io);
    emitPersonalizedStates(game, io);
  });

  // 7. Imposter Game Specific Events
  socket.on('imposter:ready', () => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'imposter') {
      game.handleAction(socket.id, 'ready');
      emitPersonalizedStates(game, io);
    }
  });

  socket.on('imposter:submit-clue', ({ clue }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'imposter') {
      const res = game.handleAction(socket.id, 'submit-clue', { clue });
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  socket.on('imposter:cast-vote', ({ targetId }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'imposter') {
      const res = game.handleAction(socket.id, 'cast-vote', { targetId });
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  socket.on('imposter:guess', ({ guess }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'imposter') {
      const res = game.handleAction(socket.id, 'imposter-guess', { guess });
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  // 8. Wavelength Game Specific Events
  socket.on('wavelength:submit-clue', ({ clue }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'wavelength') {
      const res = game.handleAction(socket.id, 'submit-clue', { clue });
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  socket.on('wavelength:move-dial', ({ position }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'wavelength') {
      const res = game.handleAction(socket.id, 'move-dial', { position });
      if (res && !res.error) {
        io.to(roomId).emit('wavelength:dial-moved', {
          dialNeedle: game.dialNeedle,
          playerId: socket.id
        });
      }
    }
  });

  socket.on('wavelength:lock-dial', () => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'wavelength') {
      const res = game.handleAction(socket.id, 'lock-dial');
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  socket.on('wavelength:counter-guess', ({ guess }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'wavelength') {
      const res = game.handleAction(socket.id, 'counter-guess', { guess });
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  socket.on('wavelength:switch-team', ({ team }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'wavelength') {
      const res = game.handleAction(socket.id, 'switch-team', { team });
      if (res && res.error) socket.emit('action-error', res.error);
      else {
        emitPersonalizedStates(game, io);
        broadcastLobbyUpdate(game, io);
      }
    }
  });

  socket.on('wavelength:next-round', () => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'wavelength') {
      const res = game.handleAction(socket.id, 'next-round');
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  // 9. Co-op Platformer Game Specific Events
  socket.on('platformer:sync', (data = {}) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'platformer') {
      game.updatePlayerState(socket.id, data);
      socket.to(roomId).emit('platformer:player-moved', {
        playerId: socket.id,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        facing: data.facing,
        isGrounded: data.isGrounded,
        reachedExit: data.reachedExit,
        buttonStates: game.buttonStates,
        doorStates: game.doorStates,
        collectedKeys: Array.from(game.collectedKeys),
        cratePositions: game.cratePositions
      });
    }
  });

  socket.on('platformer:restart-level', () => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'platformer') {
      const res = game.handleAction(socket.id, 'restart-level');
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  socket.on('platformer:next-level', () => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'platformer') {
      const res = game.handleAction(socket.id, 'next-level');
      if (res && res.error) socket.emit('action-error', res.error);
      else emitPersonalizedStates(game, io);
    }
  });

  // 10. Draw & Guess Real-time Differential Drawing & Chat
  socket.on('drawguess:stroke', (strokeData) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'drawguess' && game.state === 'drawing') {
      const drawer = game.getCurrentDrawer();
      if (drawer && drawer.id === socket.id) {
        if (!game.strokes) game.strokes = [];
        game.strokes.push(strokeData);
        socket.to(roomId).emit('drawguess:stroke', strokeData);
      }
    }
  });

  socket.on('drawguess:clear', () => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'drawguess') {
      const drawer = game.getCurrentDrawer();
      if (drawer && drawer.id === socket.id) {
        game.strokes = [];
        io.to(roomId).emit('drawguess:clear');
      }
    }
  });

  socket.on('drawguess:undo', () => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'drawguess') {
      const drawer = game.getCurrentDrawer();
      if (drawer && drawer.id === socket.id) {
        if (game.strokes && game.strokes.length) {
          game.strokes.pop();
          io.to(roomId).emit('drawguess:undo');
        }
      }
    }
  });

  socket.on('drawguess:guess', ({ text }) => {
    const roomId = socket.data?.roomId;
    const game = rooms.get(roomId);
    if (game && game.gameType === 'drawguess') {
      const res = game.handleGuess(socket.id, text);
      if (res && res.error) {
        socket.emit('action-error', res.error);
      } else if (res && res.chat) {
        io.to(roomId).emit('chat-message', {
          senderId: socket.id,
          name: socket.data?.name || 'Player',
          message: text,
          timestamp: Date.now()
        });
      }
    }
  });

  // 11. Chat Message (All Games)
  socket.on('chat-message', ({ message }) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const cleanMsg = String(message || '').slice(0, 200).trim();
    if (!cleanMsg) return;

    io.to(roomId).emit('chat-message', {
      senderId: socket.id,
      name: socket.data?.name || 'Anonymous',
      message: cleanMsg,
      timestamp: Date.now()
    });
  });

  // 12. Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data?.roomId;
    const name = socket.data?.name;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (player) {
      player.connected = false;
    }

    io.to(roomId).emit('player-disconnected', { name, id: socket.id });

    if (game.state !== 'waiting') {
      game.removePlayer(socket.id);
      emitPersonalizedStates(game, io);
    } else {
      // Waiting lobby: 20s grace period for navigation/page reload before removing
      const timerKey = `${roomId}:${socket.id}`;
      const disconnectTimer = setTimeout(() => {
        playerDisconnectTimers.delete(timerKey);
        const currentGame = rooms.get(roomId);
        if (!currentGame || currentGame.state !== 'waiting') return;
        const p = currentGame.players.find(pl => pl.id === socket.id);
        if (p && !p.connected) {
          currentGame.removePlayer(socket.id);
          // If the disconnected player was host, promote next connected player
          if (currentGame.hostName && p.name && currentGame.hostName.toLowerCase() === p.name.toLowerCase()) {
            const nextHost = currentGame.players.find(pl => pl.connected && !pl.isBot) || currentGame.players[0];
            if (nextHost) {
              currentGame.hostName = nextHost.name;
              currentGame.hostPlayerId = nextHost.id;
            }
          }
          broadcastLobbyUpdate(currentGame, io);
        }
      }, 20000);
      playerDisconnectTimers.set(timerKey, disconnectTimer);
      broadcastLobbyUpdate(game, io);
    }

    const anyConnected = game.players.some(p => p.connected);
    if (!anyConnected) {
      scheduleRoomCleanup(roomId);
    }
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🎮 Game Server running on http://localhost:${PORT}`);
    console.log(`   🃏 Poker: http://localhost:${PORT}/poker`);
    console.log(`   🕵️ Imposter: http://localhost:${PORT}/imposter`);
    console.log(`   🌊 Wavelength: http://localhost:${PORT}/wavelength`);
    console.log(`   🏃 Co-op Platformer: http://localhost:${PORT}/platformer`);
    console.log(`   🎨 Draw & Guess: http://localhost:${PORT}/drawguess`);
    console.log(`   🕵️ Codenames: http://localhost:${PORT}/codenames`);
    console.log(`   ⚡ Speed Trivia: http://localhost:${PORT}/trivia`);
    console.log(`   🎲 Liar's Dice: http://localhost:${PORT}/liarsdice`);
    console.log(`   🕵️ Spyfall: http://localhost:${PORT}/spyfall`);
  });
}

// Attach components to app function for unified Vercel and Node module exports
app.app = app;
app.server = server;
app.io = io;
app.rooms = rooms;
app.createGameInstance = createGameInstance;

module.exports = app;
