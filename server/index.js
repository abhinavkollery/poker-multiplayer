const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const PokerGame = require('./games/poker/game');
const ImposterGame = require('./games/imposter/game');
const WavelengthGame = require('./games/wavelength/game');
const PlatformerGame = require('./games/platformer/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());

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
app.get(['/imposter', '/imposter/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/imposter/game.html'));
});
app.get(['/imposter/game', '/imposter/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/imposter/game.html'));
});
app.get(['/wavelength', '/wavelength/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/wavelength/game.html'));
});
app.get(['/wavelength/game', '/wavelength/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/wavelength/game.html'));
});
app.get(['/platformer', '/platformer/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platformer/game.html'));
});
app.get(['/platformer/game', '/platformer/game.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/platformer/game.html'));
});

app.use(express.static(path.join(__dirname, '../public')));

const rooms = new Map(); // roomId -> GameInstance (PokerGame | ImposterGame | WavelengthGame)

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

function emitPersonalizedStates(game, socketIo) {
  if (!game) return;
  for (const player of game.players) {
    const sock = socketIo.sockets.sockets.get(player.id);
    if (sock) {
      sock.emit('game-state', game.getStateForPlayer(player.id));
    }
  }
}

function broadcastLobbyUpdate(game, socketIo) {
  if (!game) return;
  socketIo.to(game.roomId).emit('lobby-update', {
    roomId: game.roomId,
    gameType: game.gameType,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      team: p.team,
      ready: p.ready,
      connected: p.connected,
      isHost: p.id === game.players[0]?.id
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
    const name = payload.name;
    const roomId = uuidv4().substring(0, 6).toUpperCase();

    let game;
    if (gameType === 'imposter') {
      game = new ImposterGame(roomId, payload);
    } else if (gameType === 'wavelength') {
      game = new WavelengthGame(roomId, payload);
    } else if (gameType === 'platformer') {
      game = new PlatformerGame(roomId, payload);
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

    socket.emit('room-created', { roomId, gameType: game.gameType });
    socket.emit('game-state', game.getStateForPlayer(socket.id));
    broadcastLobbyUpdate(game, io);
  });

  // 2. Join Room
  socket.on('join-room', ({ roomId, name }) => {
    if (!roomId) {
      socket.emit('join-error', 'Room ID is required');
      return;
    }

    const cleanRoomId = roomId.trim().toUpperCase();
    const game = rooms.get(cleanRoomId);
    if (!game) {
      socket.emit('join-error', 'Room not found. Check the code and try again.');
      return;
    }

    let reconnected = false;
    let player = null;

    // Try reconnecting first
    const reconnectResult = game.reconnectPlayer(socket.id, name);
    if (reconnectResult.success) {
      reconnected = true;
      player = reconnectResult.player;
    } else {
      // Add as new player
      const addResult = game.addPlayer(socket.id, name);
      if (addResult.error) {
        socket.emit('join-error', addResult.error);
        return;
      }
      player = addResult.player;
    }

    socket.join(cleanRoomId);
    socket.data = {
      roomId: cleanRoomId,
      gameType: game.gameType,
      name: player.name,
      isHost: game.players[0]?.id === socket.id
    };

    socket.emit('room-joined', {
      roomId: cleanRoomId,
      gameType: game.gameType,
      reconnected
    });

    socket.emit('game-state', game.getStateForPlayer(socket.id));
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

    if (!game.players[0] || game.players[0].id !== socket.id) {
      socket.emit('action-error', 'Only the room host can start the game');
      return;
    }

    if (!game.canStart()) {
      socket.emit('action-error', 'Cannot start: not enough players (need minimum to play)');
      return;
    }

    game.startGame(options);
    emitPersonalizedStates(game, io);
    broadcastLobbyUpdate(game, io);
  });

  // 4. Player Action (Universal & Poker)
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
    } else {
      emitPersonalizedStates(game, io);
    }
  });

  // 5. Imposter Game Specific Events
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

  // 6. Wavelength Game Specific Events
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
        // Broadcast immediate live needle update for 60fps team synchronization
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

  // 7. Co-op Platformer Game Specific Events
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

  // 8. Chat Message (All Games)
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

  // 8. Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data?.roomId;
    const name = socket.data?.name;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    game.removePlayer(socket.id);
    io.to(roomId).emit('player-disconnected', { name, id: socket.id });

    const anyConnected = game.players.some(p => p.connected);
    if (game.players.length === 0 || !anyConnected) {
      if (typeof game.clearTurnTimer === 'function') game.clearTurnTimer();
      if (typeof game.clearTimer === 'function') game.clearTimer();
      rooms.delete(roomId);
      return;
    }

    if (game.state === 'waiting') {
      broadcastLobbyUpdate(game, io);
    } else {
      emitPersonalizedStates(game, io);
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
  });
}

module.exports = { app, server, io, rooms };
