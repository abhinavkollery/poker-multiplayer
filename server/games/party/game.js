/**
 * Party Lobby Game Engine
 * Holds players in a unified group/team party room before launching any game.
 * Host selects games and launches them; all connected players migrate together.
 */
class PartyLobbyGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'party';
    this.maxPlayers = Math.min(32, Math.max(2, Number(options.maxPlayers) || 24));

    this.players = []; // Array of { id, name, connected, ready }
    this.state = 'waiting';
    this.selectedGame = options.selectedGame || options.gameType || 'poker';
    if (this.selectedGame === 'party') this.selectedGame = 'poker';
    this.selectedGameOptions = options.gameOptions || {};
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  clearTimer() {}
  clearTurnTimer() {}

  addPlayer(id, name) {
    if (this.players.length >= this.maxPlayers) {
      return { error: 'Party room is full' };
    }
    const cleanName = (name || '').trim().slice(0, 16);
    if (!cleanName) {
      return { error: 'Player name is required' };
    }

    const existing = this.players.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      existing.id = id;
      existing.connected = true;
      return { success: true, player: existing, reconnected: true };
    }

    const player = {
      id,
      name: cleanName,
      connected: true,
      ready: true,
      joinedAt: Date.now()
    };

    this.players.push(player);
    return { success: true, player };
  }

  reconnectPlayer(id, name) {
    const cleanName = (name || '').trim().toLowerCase();
    const player = this.players.find(p => p.name.toLowerCase() === cleanName);
    if (player) {
      player.id = id;
      player.connected = true;
      return { success: true, player };
    }
    return { success: false };
  }

  removePlayer(id) {
    const player = this.players.find(p => p.id === id);
    if (player) {
      player.connected = false;
    }
    return player;
  }

  getHostId() {
    if (this.hostName) {
      const p = this.players.find(pl => pl.name && pl.name.toLowerCase() === this.hostName.toLowerCase());
      if (p) return p.id;
    }
    const active = this.players.find(p => p.connected);
    return active ? active.id : (this.players[0] ? this.players[0].id : null);
  }

  canStart() {
    const activeCount = this.players.filter(p => p.connected).length;
    return activeCount >= 1;
  }

  startGame(options = {}) {
    this.state = 'starting';
    return { success: true };
  }

  handleAction(playerId, action, payload = {}) {
    const hostId = this.getHostId();
    const isHost = hostId === playerId;

    if (action === 'select-game') {
      if (!isHost) {
        return { error: 'Only the party host can select games' };
      }
      const newGame = payload.gameType || payload.game || 'poker';
      this.selectedGame = newGame;
      if (payload.options) {
        this.selectedGameOptions = payload.options;
      }
      return { success: true, selectedGame: this.selectedGame };
    }

    if (action === 'update-options') {
      if (!isHost) {
        return { error: 'Only the party host can update game settings' };
      }
      this.selectedGameOptions = Object.assign({}, this.selectedGameOptions, payload.options || {});
      return { success: true, options: this.selectedGameOptions };
    }

    if (action === 'toggle-ready') {
      const p = this.players.find(pl => pl.id === playerId);
      if (p) {
        p.ready = !p.ready;
        return { success: true, ready: p.ready };
      }
    }

    return { error: 'Unknown action' };
  }

  getStateForPlayer(playerId) {
    const hostId = this.getHostId();
    return {
      roomId: this.roomId,
      gameType: 'party',
      state: this.state,
      selectedGame: this.selectedGame,
      selectedGameOptions: this.selectedGameOptions,
      isHost: hostId === playerId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        ready: p.ready !== false,
        isHost: p.id === hostId
      })),
      canStart: this.canStart(),
      maxPlayers: this.maxPlayers
    };
  }
}

module.exports = PartyLobbyGame;

