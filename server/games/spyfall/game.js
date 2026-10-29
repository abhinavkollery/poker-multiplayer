const { SPYFALL_LOCATIONS, getRandomLocation } = require('./locations');

class SpyfallGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'spyfall';
    this.maxPlayers = Math.min(16, Math.max(3, Number(options.maxPlayers) || 8));
    this.gameDuration = Math.min(600, Math.max(180, Number(options.duration) || 480)); // 8 minutes default

    this.players = [];
    this.state = 'waiting'; // 'waiting' | 'playing' | 'voting' | 'game_over'
    this.currentLocation = null;
    this.spyId = null;
    this.timeLeft = 0;
    this.timer = null;
    this.currentAccusation = null; // { accuser, accused, votes: Map() }
    this.winner = null;
    this.winReason = '';
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  addPlayer(id, name) {
    if (this.players.length >= this.maxPlayers) {
      return { error: 'Room is full' };
    }
    const cleanName = (name || '').trim().slice(0, 16) || `Agent ${this.players.length + 1}`;
    const player = {
      id,
      name: cleanName,
      role: 'Civilian',
      isSpy: false,
      connected: true
    };
    this.players.push(player);
    return { player };
  }

  removePlayer(id) {
    const p = this.players.find(pl => pl.id === id);
    if (p) p.connected = false;

    // If spy left, end game
    if (this.state === 'playing' && this.spyId === id) {
      this.winner = 'civilians';
      this.winReason = 'The Spy disconnected from the game!';
      this.state = 'game_over';
      this.clearTimer();
    }
  }

  reconnectPlayer(id, name) {
    const p = this.players.find(pl => pl.name === name);
    if (p) {
      p.id = id;
      p.connected = true;
      return { success: true, player: p };
    }
    return { success: false };
  }

  canStart() {
    return this.players.filter(p => p.connected).length >= 3;
  }

  startGame(options = {}) {
    if (!this.canStart()) return { error: 'Need at least 3 players to start Spyfall' };
    if (options.duration) this.gameDuration = Math.min(600, Math.max(180, Number(options.duration)));

    this.clearTimer();
    this.currentLocation = getRandomLocation();
    this.winner = null;
    this.winReason = '';
    this.currentAccusation = null;

    const connected = this.players.filter(p => p.connected);
    // Pick 1 spy
    const spyIdx = Math.floor(Math.random() * connected.length);
    this.spyId = connected[spyIdx].id;

    // Assign roles to non-spies
    const roles = [...this.currentLocation.roles].sort(() => 0.5 - Math.random());
    let roleIdx = 0;

    this.players.forEach(p => {
      if (p.id === this.spyId) {
        p.isSpy = true;
        p.role = 'Spy';
      } else {
        p.isSpy = false;
        p.role = roles[roleIdx % roles.length] || 'Visitor';
        roleIdx++;
      }
    });

    this.state = 'playing';
    this.timeLeft = this.gameDuration;

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.clearTimer();
        // Time expired: spy wins if not caught
        this.winner = 'spy';
        this.winReason = 'Time ran out! The Spy remained undetected!';
        this.state = 'game_over';
      }
      this.emitPersonalized();
    }, 1000);

    return { success: true };
  }

  accuse(accuserId, accusedId) {
    if (this.state !== 'playing') return { error: 'Not in questioning phase' };
    if (accuserId === accusedId) return { error: 'Cannot accuse yourself' };

    const accuser = this.players.find(p => p.id === accuserId);
    const accused = this.players.find(p => p.id === accusedId);
    if (!accuser || !accused) return { error: 'Player not found' };

    this.currentAccusation = {
      accuserId,
      accuserName: accuser.name,
      accusedId,
      accusedName: accused.name,
      votes: new Map([[accuserId, true]]) // Accuser votes yes by default
    };

    this.state = 'voting';
    return { success: true, accusation: this.currentAccusation };
  }

  vote(playerId, approve) {
    if (this.state !== 'voting' || !this.currentAccusation) {
      return { error: 'No active vote' };
    }
    if (playerId === this.currentAccusation.accusedId) {
      return { error: 'The accused cannot vote on their own trial' };
    }

    this.currentAccusation.votes.set(playerId, Boolean(approve));

    const eligibleVoters = this.players.filter(p => p.connected && p.id !== this.currentAccusation.accusedId);
    if (this.currentAccusation.votes.size >= eligibleVoters.length) {
      // Tally votes
      const yesVotes = Array.from(this.currentAccusation.votes.values()).filter(v => v === true).length;
      if (yesVotes === eligibleVoters.length) {
        // Unanimous conviction!
        this.clearTimer();
        if (this.currentAccusation.accusedId === this.spyId) {
          this.winner = 'civilians';
          this.winReason = `The Spy was successfully caught! (${this.currentAccusation.accusedName} was the Spy!)`;
        } else {
          this.winner = 'spy';
          this.winReason = `An innocent civilian was convicted! The Spy wins!`;
        }
        this.state = 'game_over';
      } else {
        // Vote failed, resume game
        this.state = 'playing';
        this.currentAccusation = null;
      }
    }

    return { success: true };
  }

  spyGuess(playerId, locationName) {
    if (this.state !== 'playing' && this.state !== 'voting') {
      return { error: 'Cannot guess now' };
    }
    if (playerId !== this.spyId) {
      return { error: 'Only the Spy can reveal and guess the location' };
    }

    this.clearTimer();
    const cleanGuess = (locationName || '').trim().toLowerCase();
    const actualLocation = this.currentLocation.name.trim().toLowerCase();

    if (cleanGuess === actualLocation) {
      this.winner = 'spy';
      this.winReason = `The Spy revealed themselves and guessed the exact location correctly: ${this.currentLocation.name}!`;
    } else {
      this.winner = 'civilians';
      this.winReason = `The Spy guessed wrong (${locationName})! The actual location was ${this.currentLocation.name}. Civilians win!`;
    }

    this.state = 'game_over';
    return { success: true, winner: this.winner };
  }

  handleAction(playerId, action, payload = {}) {
    switch (action) {
      case 'accuse':
        return this.accuse(playerId, payload.accusedId);
      case 'vote':
        return this.vote(playerId, payload.approve);
      case 'spy-guess':
        return this.spyGuess(playerId, payload.location);
      case 'restart':
        return this.startGame();
      default:
        return { error: 'Unknown action' };
    }
  }

  emitPersonalized() {
    if (!this.io) return;
    for (const player of this.players) {
      const sock = this.io.sockets.sockets.get(player.id);
      if (sock) {
        sock.emit('game-state', this.getStateForPlayer(player.id));
      }
    }
  }

  getStateForPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const isSpy = player?.id === this.spyId;
    const isGameOver = this.state === 'game_over';

    return {
      roomId: this.roomId,
      gameType: this.gameType,
      state: this.state,
      timeLeft: this.timeLeft,
      isSpy,
      // Anti-cheat: Location is masked for Spy until game over
      location: (isGameOver || !isSpy) ? (this.currentLocation?.name || '') : '??? (Secret)',
      role: isSpy ? 'The Spy' : (player?.role || 'Civilian'),
      allLocations: SPYFALL_LOCATIONS.map(l => l.name),
      spyName: isGameOver ? this.players.find(p => p.id === this.spyId)?.name : null,
      winner: this.winner,
      winReason: this.winReason,
      accusation: this.currentAccusation ? {
        accuserName: this.currentAccusation.accuserName,
        accusedId: this.currentAccusation.accusedId,
        accusedName: this.currentAccusation.accusedName,
        votesCount: this.currentAccusation.votes.size
      } : null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        connected: p.connected
      }))
    };
  }
}

module.exports = SpyfallGame;

