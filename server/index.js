const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const PokerGame = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const rooms = new Map(); // roomId -> PokerGame

// REST endpoints
app.get('/api/room/:roomId', (req, res) => {
  const roomId = (req.params.roomId || '').toUpperCase();
  const game = rooms.get(roomId);
  if (!game) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    roomId: game.roomId,
    playerCount: game.players.length,
    maxPlayers: game.maxPlayers,
    state: game.state,
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    startingChips: game.startingChips
  });
});

function emitPersonalizedStates(game, socketIo) {
  for (const player of game.players) {
    const sock = socketIo.sockets.sockets.get(player.id);
    if (sock) {
      sock.emit('game-state', game.getStateForPlayer(player.id));
    }
  }
}

// Socket.io handlers
io.on('connection', socket => {
  // 1. Create Room
  socket.on('create-room', ({ name, maxPlayers, startingChips, smallBlind, bigBlind }) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const game = new PokerGame(roomId, {
      maxPlayers: Math.min(8, Math.max(2, Number(maxPlayers) || 6)),
      startingChips: Number(startingChips) || 1000,
      smallBlind: Number(smallBlind) || 10,
      bigBlind: Number(bigBlind) || 20
    });
    game.io = io;
    rooms.set(roomId, game);

    const joinResult = game.addPlayer(socket.id, name);
    if (joinResult.error) {
      socket.emit('action-error', joinResult.error);
      return;
    }

    socket.join(roomId);
    socket.data = {
      roomId,
      name: joinResult.player.name,
      isHost: true
    };

    socket.emit('room-created', { roomId });
    socket.emit('game-state', game.getStateForPlayer(socket.id));
    io.to(roomId).emit('lobby-update', {
      roomId,
      players: game.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        connected: p.connected,
        isHost: p.id === game.players[0]?.id
      })),
      canStart: game.canStart()
    });
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
      socket.emit('join-error', 'Room not found');
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
      name: player.name,
      isHost: game.players[0]?.id === socket.id
    };

    socket.emit('room-joined', { roomId: cleanRoomId, reconnected });
    socket.emit('game-state', game.getStateForPlayer(socket.id));

    io.to(cleanRoomId).emit('lobby-update', {
      roomId: cleanRoomId,
      players: game.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        connected: p.connected,
        isHost: p.id === game.players[0]?.id
      })),
      canStart: game.canStart()
    });

    socket.to(cleanRoomId).emit('player-joined', {
      name: player.name,
      id: socket.id
    });

    if (game.state !== 'waiting') {
      emitPersonalizedStates(game, io);
    }
  });

  // 3. Start Game
  socket.on('start-game', () => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    if (!game.players[0] || game.players[0].id !== socket.id) {
      socket.emit('action-error', 'Only the host can start the game');
      return;
    }

    if (!game.canStart()) {
      socket.emit('action-error', 'Cannot start game (need at least 2 players in waiting state)');
      return;
    }

    game.startGame();
    emitPersonalizedStates(game, io);
  });

  // 4. Player Action
  socket.on('player-action', ({ action, amount }) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const game = rooms.get(roomId);
    if (!game) return;

    const result = game.handleAction(socket.id, action, amount);
    if (result && result.error) {
      socket.emit('action-error', result.error);
    } else {
      emitPersonalizedStates(game, io);
    }
  });

  // 5. Chat Message
  socket.on('chat-message', ({ message }) => {
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const cleanMsg = String(message || '').slice(0, 200).trim();
    if (!cleanMsg) return;

    io.to(roomId).emit('chat-message', {
      name: socket.data?.name || 'Anonymous',
      message: cleanMsg,
      timestamp: Date.now()
    });
  });

  // 6. Disconnect
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
      game.clearTurnTimer();
      rooms.delete(roomId);
      return;
    }

    if (game.state === 'waiting') {
      io.to(roomId).emit('lobby-update', {
        roomId,
        players: game.players.map(p => ({
          id: p.id,
          name: p.name,
          chips: p.chips,
          connected: p.connected,
          isHost: p.id === game.players[0]?.id
        })),
        canStart: game.canStart()
      });
    } else {
      emitPersonalizedStates(game, io);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🃏 Poker server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io, rooms };
