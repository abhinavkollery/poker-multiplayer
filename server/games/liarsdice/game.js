class LiarsDiceGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'liarsdice';
    this.maxPlayers = Math.min(8, Math.max(2, Number(options.maxPlayers) || 6));
    this.startingDice = Math.min(5, Math.max(2, Number(options.startingDice) || 5));

    this.players = [];
    this.state = 'waiting'; // 'waiting' | 'bidding' | 'reveal' | 'game_over'
    this.currentTurnIndex = 0;
    this.currentBid = null; // { playerId, count, face }
    this.lastChallenge = null; // { challengerId, targetId, actualCount, bidCount, loserId, reason }
    this.roundNumber = 1;
    this.winner = null;
    this.io = null;
  }

  setIO(io) {
    this.io = io;
  }

  clearTimer() {}

  addPlayer(id, name) {
    if (this.players.length >= this.maxPlayers) {
      return { error: 'Room is full' };
    }
    const cleanName = (name || '').trim().slice(0, 16) || `Pirate ${this.players.length + 1}`;
    const player = {
      id,
      name: cleanName,
      diceCount: this.startingDice,
      dice: [],
      eliminated: false,
      connected: true
    };
    this.players.push(player);
    return { player };
  }

  removePlayer(id) {
    const p = this.players.find(pl => pl.id === id);
    if (p) p.connected = false;

    // If current player disconnected, advance turn
    if (this.state === 'bidding' && this.getCurrentPlayer()?.id === id) {
      this.advanceTurn();
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
    return this.players.filter(p => p.connected).length >= 2;
  }

  getCurrentPlayer() {
    const active = this.getActivePlayers();
    if (!active.length) return null;
    return active[this.currentTurnIndex % active.length];
  }

  getActivePlayers() {
    return this.players.filter(p => p.connected && !p.eliminated && p.diceCount > 0);
  }

  startGame(options = {}) {
    if (!this.canStart()) return { error: 'Need at least 2 players to start' };
    if (options.startingDice) this.startingDice = Math.min(5, Math.max(2, Number(options.startingDice)));

    this.players.forEach(p => {
      p.diceCount = this.startingDice;
      p.dice = [];
      p.eliminated = false;
    });

    this.roundNumber = 1;
    this.winner = null;
    this.currentTurnIndex = 0;
    this.startRound();
    return { success: true };
  }

  rollAllDice() {
    this.players.forEach(p => {
      if (!p.eliminated && p.diceCount > 0) {
        p.dice = Array.from({ length: p.diceCount }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => a - b);
      } else {
        p.dice = [];
      }
    });
  }

  startRound() {
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this.state = 'game_over';
      this.winner = active[0] || null;
      return;
    }

    this.rollAllDice();
    this.currentBid = null;
    this.lastChallenge = null;
    this.state = 'bidding';
  }

  bid(playerId, count, face) {
    if (this.state !== 'bidding') return { error: 'Not in bidding phase' };
    const curr = this.getCurrentPlayer();
    if (!curr || curr.id !== playerId) return { error: 'Not your turn to bid' };

    const c = Number(count);
    const f = Number(face);
    if (isNaN(c) || isNaN(f) || f < 1 || f > 6 || c < 1) {
      return { error: 'Invalid bid values' };
    }

    // Validate bid escalation
    if (this.currentBid) {
      const prevC = this.currentBid.count;
      const prevF = this.currentBid.face;

      const isValidEscalation = (c > prevC) || (c === prevC && f > prevF);
      if (!isValidEscalation) {
        return { error: `Bid must be higher than ${prevC} × ${prevF}` };
      }
    }

    this.currentBid = {
      playerId,
      playerName: curr.name,
      count: c,
      face: f
    };

    this.advanceTurn();
    return { success: true, bid: this.currentBid };
  }

  challenge(playerId, type = 'liar') {
    if (this.state !== 'bidding') return { error: 'Not in bidding phase' };
    if (!this.currentBid) return { error: 'No bid to challenge' };

    const curr = this.getCurrentPlayer();
    if (!curr || curr.id !== playerId) return { error: 'Not your turn to challenge' };

    const bidder = this.players.find(p => p.id === this.currentBid.playerId);
    const targetFace = this.currentBid.face;
    const bidCount = this.currentBid.count;

    // Count matching dice across all active players
    // Ones are wild unless the bid was on Ones!
    let actualCount = 0;
    this.getActivePlayers().forEach(p => {
      p.dice.forEach(d => {
        if (d === targetFace || (targetFace !== 1 && d === 1)) {
          actualCount++;
        }
      });
    });

    let loser;
    let reason;

    if (type === 'exacto') {
      if (actualCount === bidCount) {
        // Challenger was exactly right! Bidder loses die
        loser = bidder;
        reason = `Spot on! Exactly ${actualCount} found! ${bidder?.name || 'Bidder'} loses a die.`;
      } else {
        loser = curr;
        reason = `Not exact! Actual was ${actualCount}, not ${bidCount}. ${curr.name} loses a die.`;
      }
    } else {
      // Standard "Liar!"
      if (actualCount < bidCount) {
        // Bidder was lying!
        loser = bidder;
        reason = `Liar caught! Only ${actualCount} found (needed ${bidCount}). ${bidder?.name || 'Bidder'} loses a die.`;
      } else {
        // Bid was truthful! Challenger was wrong
        loser = curr;
        reason = `Truth! There were ${actualCount} found (needed ${bidCount}). ${curr.name} loses a die.`;
      }
    }

    if (loser) {
      loser.diceCount = Math.max(0, loser.diceCount - 1);
      if (loser.diceCount === 0) {
        loser.eliminated = true;
      }
    }

    this.lastChallenge = {
      challengerId: curr.id,
      challengerName: curr.name,
      bidderName: this.currentBid.playerName,
      bidCount,
      bidFace: targetFace,
      actualCount,
      loserName: loser ? loser.name : 'Nobody',
      reason
    };

    this.state = 'reveal';

    // Check if only 1 player remains
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this.winner = active[0] || null;
      this.state = 'game_over';
    }

    return { success: true, challenge: this.lastChallenge };
  }

  nextRound() {
    if (this.state !== 'reveal') return { error: 'Not in reveal phase' };
    this.roundNumber++;
    this.startRound();
    return { success: true };
  }

  advanceTurn() {
    const active = this.getActivePlayers();
    if (!active.length) return;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % active.length;
  }

  handleAction(playerId, action, payload = {}) {
    switch (action) {
      case 'bid':
        return this.bid(playerId, payload.count, payload.face);
      case 'challenge':
        return this.challenge(playerId, payload.type || 'liar');
      case 'next-round':
        return this.nextRound();
      case 'restart':
        return this.startGame();
      default:
        return { error: 'Unknown action' };
    }
  }

  getStateForPlayer(playerId) {
    const active = this.getActivePlayers();
    const curr = this.getCurrentPlayer();
    const isReveal = this.state === 'reveal' || this.state === 'game_over';

    return {
      roomId: this.roomId,
      gameType: this.gameType,
      state: this.state,
      roundNumber: this.roundNumber,
      currentTurnPlayer: curr ? { id: curr.id, name: curr.name } : null,
      isMyTurn: curr?.id === playerId,
      currentBid: this.currentBid,
      lastChallenge: this.lastChallenge,
      winner: this.winner ? { id: this.winner.id, name: this.winner.name } : null,
      totalDiceInPlay: active.reduce((sum, p) => sum + p.diceCount, 0),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        diceCount: p.diceCount,
        eliminated: p.eliminated,
        // Anti-cheat: Player only sees their own dice, unless in reveal or game_over!
        dice: (isReveal || p.id === playerId) ? p.dice : Array(p.diceCount).fill('?'),
        connected: p.connected
      }))
    };
  }
}

module.exports = LiarsDiceGame;

