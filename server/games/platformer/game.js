const { LEVELS, getLevel } = require('./levels');

const PLAYER_COLORS = [
  { name: 'Sky Blue', hex: '#3498db', glow: 'rgba(52, 152, 219, 0.4)' },
  { name: 'Crimson Red', hex: '#e74c3c', glow: 'rgba(231, 76, 60, 0.4)' },
  { name: 'Emerald Green', hex: '#2ecc71', glow: 'rgba(46, 204, 113, 0.4)' },
  { name: 'Amber Gold', hex: '#f1c40f', glow: 'rgba(241, 196, 15, 0.4)' },
  { name: 'Neon Purple', hex: '#9b59b6', glow: 'rgba(155, 89, 182, 0.4)' },
  { name: 'Sunset Orange', hex: '#e67e22', glow: 'rgba(230, 126, 34, 0.4)' }
];

class PlatformerGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'platformer';
    this.maxPlayers = Math.min(6, Math.max(2, Number(options.maxPlayers) || 4));

    this.players = [];
    this.state = 'waiting'; // 'waiting', 'playing', 'level_cleared', 'game_over'

    this.currentLevelIndex = 0;
    this.currentLevel = null;

    // Interactive level state
    this.buttonStates = {}; // buttonId -> boolean (pressed or not)
    this.doorStates = {}; // doorId -> boolean (open or not)
    this.collectedKeys = new Set(); // set of keyIds
    this.cratePositions = {}; // crateId -> { x, y }

    this.timer = null;
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  addPlayer(socketId, name) {
    if (this.players.length >= this.maxPlayers) {
      return { error: 'Room is full' };
    }
    if (this.state !== 'waiting') {
      return { error: 'Game already in progress' };
    }
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { error: 'Player name is required' };
    }
    const existing = this.players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      if (!existing.connected) {
        existing.id = socketId;
        existing.connected = true;
        return { success: true, player: existing, reconnected: true };
      }
      return { error: 'Player name already taken' };
    }

    const colorObj = PLAYER_COLORS[this.players.length % PLAYER_COLORS.length];
    const player = {
      id: socketId,
      name: cleanName,
      isHost: this.players.length === 0,
      color: colorObj.hex,
      colorName: colorObj.name,
      x: 2 + this.players.length * 1.2,
      y: 9,
      vx: 0,
      vy: 0,
      facing: 'right',
      isGrounded: true,
      reachedExit: false,
      deaths: 0,
      connected: true
    };

    this.players.push(player);
    return { success: true, player };
  }

  reconnectPlayer(socketId, name) {
    const cleanName = (name || '').trim().toLowerCase();
    const player = this.players.find(p => p.name.toLowerCase() === cleanName);
    if (player) {
      player.id = socketId;
      player.connected = true;
      return { success: true, player };
    }
    return { success: false };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.id === socketId);
    if (idx === -1) return;

    const removed = this.players[idx];
    if (this.state === 'waiting') {
      this.players.splice(idx, 1);
      if (this.players.length > 0 && removed.isHost) {
        this.players[0].isHost = true;
      }
    } else {
      removed.connected = false;
      this.checkLevelCompletion();
    }
  }

  canStart() {
    return this.state === 'waiting' && this.players.length >= 2;
  }

  startGame(options = {}) {
    if (!this.canStart()) return false;

    this.currentLevelIndex = Number(options.levelIndex) || 0;
    this.loadLevel(this.currentLevelIndex);
    this.state = 'playing';
    return true;
  }

  loadLevel(levelIndex) {
    this.currentLevelIndex = levelIndex;
    this.state = 'playing';
    const level = getLevel(levelIndex);
    this.currentLevel = level;

    // Reset interactive states
    this.buttonStates = {};
    this.doorStates = {};
    this.collectedKeys = new Set();
    this.cratePositions = {};

    if (level.buttons) {
      for (const b of level.buttons) {
        this.buttonStates[b.id] = false;
      }
    }
    if (level.doors) {
      for (const d of level.doors) {
        this.doorStates[d.id] = false;
      }
    }
    if (level.lockedDoors) {
      for (const ld of level.lockedDoors) {
        this.doorStates[ld.id] = false;
      }
    }
    if (level.crates) {
      for (const c of level.crates) {
        this.cratePositions[c.id] = { x: c.x, y: c.y };
      }
    }

    // Place players at level spawn points
    this.players.forEach((p, i) => {
      const spawn = level.spawns[i % level.spawns.length] || { x: 2, y: 9 };
      p.x = spawn.x;
      p.y = spawn.y;
      p.vx = 0;
      p.vy = 0;
      p.facing = 'right';
      p.isGrounded = true;
      p.reachedExit = false;
    });
  }

  updatePlayerState(socketId, data) {
    const player = this.players.find(p => p.id === socketId);
    if (!player || this.state !== 'playing') return;

    if (typeof data.x === 'number') player.x = data.x;
    if (typeof data.y === 'number') player.y = data.y;
    if (typeof data.vx === 'number') player.vx = data.vx;
    if (typeof data.vy === 'number') player.vy = data.vy;
    if (data.facing) player.facing = data.facing;
    if (typeof data.isGrounded === 'boolean') player.isGrounded = data.isGrounded;

    // Update button states if client reports stepped on buttons or crates moved
    if (data.buttonStates) {
      for (const [btnId, isPressed] of Object.entries(data.buttonStates)) {
        this.buttonStates[btnId] = !!isPressed;
        // Check linked doors
        const button = this.currentLevel.buttons?.find(b => b.id === btnId);
        if (button && button.linkedDoorId) {
          this.doorStates[button.linkedDoorId] = !!isPressed;
        }
      }
    }

    // Update collected keys
    if (data.collectedKeyId) {
      this.collectedKeys.add(data.collectedKeyId);
      // Unlock any doors requiring this key
      const lockedDoor = this.currentLevel.lockedDoors?.find(ld => ld.keyId === data.collectedKeyId);
      if (lockedDoor) {
        this.doorStates[lockedDoor.id] = true;
      }
    }

    // Update crate positions
    if (data.crateId && typeof data.crateX === 'number' && typeof data.crateY === 'number') {
      this.cratePositions[data.crateId] = { x: data.crateX, y: data.crateY };
    }

    // Check if player reached exit portal
    if (this.currentLevel && this.currentLevel.exit) {
      const ex = this.currentLevel.exit;
      const dist = Math.hypot(player.x - ex.x, player.y - ex.y);
      player.reachedExit = dist < 1.4;
    }

    // Check if all players reached exit to clear level
    this.checkLevelCompletion();
  }

  checkLevelCompletion() {
    if (this.state !== 'playing' || !this.currentLevel) return;

    const activePlayers = this.players.filter(p => p.connected);
    if (activePlayers.length === 0) return;

    const allAtExit = activePlayers.every(p => p.reachedExit);
    if (allAtExit) {
      if (this.currentLevelIndex + 1 < LEVELS.length) {
        this.state = 'level_cleared';
        if (this.io) this.emitState();

        // 3-second delay to show celebration before loading next level
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.loadLevel(this.currentLevelIndex + 1);
          this.state = 'playing';
          if (this.io) this.emitState();
        }, 3200);
      } else {
        // Completed all levels!
        this.state = 'game_over';
        if (this.io) this.emitState();
      }
    }
  }

  restartLevel() {
    if (this.currentLevel) {
      this.loadLevel(this.currentLevelIndex);
      this.state = 'playing';
      return { success: true };
    }
    return { error: 'No active level' };
  }

  nextLevel() {
    if (this.currentLevelIndex + 1 < LEVELS.length) {
      this.loadLevel(this.currentLevelIndex + 1);
      this.state = 'playing';
      return { success: true };
    }
    this.state = 'game_over';
    return { success: true };
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resetToLobby() {
    this.clearTimer();
    this.state = 'waiting';
    this.currentLevelIndex = 0;
    this.currentLevel = null;
    this.players.forEach(p => {
      p.reachedExit = false;
      p.deaths = 0;
    });
  }

  emitState() {
    if (!this.io) return;
    for (const player of this.players) {
      const sock = this.io.sockets.sockets.get(player.id);
      if (sock) {
        sock.emit('game-state', this.getStateForPlayer(player.id));
      }
    }
  }

  getStateForPlayer(socketId) {
    const player = this.players.find(p => p.id === socketId);

    return {
      gameType: 'platformer',
      roomId: this.roomId,
      state: this.state,
      currentLevelIndex: this.currentLevelIndex,
      totalLevels: LEVELS.length,
      currentLevel: this.currentLevel ? {
        id: this.currentLevel.id,
        name: this.currentLevel.name,
        hint: this.currentLevel.hint,
        width: this.currentLevel.width,
        height: this.currentLevel.height,
        map: this.currentLevel.map,
        exit: this.currentLevel.exit,
        spawns: this.currentLevel.spawns,
        buttons: this.currentLevel.buttons,
        doors: this.currentLevel.doors,
        lockedDoors: this.currentLevel.lockedDoors,
        crates: this.currentLevel.crates,
        keys: this.currentLevel.keys,
        hazards: this.currentLevel.hazards
      } : null,

      buttonStates: this.buttonStates,
      doorStates: this.doorStates,
      collectedKeys: Array.from(this.collectedKeys),
      cratePositions: this.cratePositions,

      myPlayer: player ? {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        color: player.color,
        colorName: player.colorName,
        reachedExit: player.reachedExit
      } : null,

      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        color: p.color,
        colorName: p.colorName,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        isGrounded: p.isGrounded,
        reachedExit: p.reachedExit,
        connected: p.connected
      })),

      canStart: this.canStart(),
      settings: {
        maxPlayers: this.maxPlayers
      }
    };
  }

  handleAction(socketId, action, data = {}) {
    switch (action) {
      case 'sync-position':
        this.updatePlayerState(socketId, data);
        return { success: true };
      case 'restart-level': {
        const player = this.players.find(p => p.id === socketId);
        if (player && (player.isHost || this.state === 'playing')) {
          return this.restartLevel();
        }
        return { error: 'Cannot restart right now' };
      }
      case 'next-level': {
        const player = this.players.find(p => p.id === socketId);
        if (player && player.isHost) {
          return this.nextLevel();
        }
        return { error: 'Only host can skip to next level' };
      }
      case 'play-again': {
        const player = this.players.find(p => p.id === socketId);
        if (player && player.isHost) {
          this.resetToLobby();
          return { success: true };
        }
        return { error: 'Only host can reset to lobby' };
      }
      default:
        return { error: `Unknown action: ${action}` };
    }
  }
}

module.exports = PlatformerGame;

