const { getRandomSpectrumCard } = require('./cards');

class WavelengthGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'wavelength';
    this.maxPlayers = Math.min(16, Math.max(2, Number(options.maxPlayers) || 12));
    this.mode = options.mode === 'teams' ? 'teams' : 'coop'; // 'coop' | 'teams'
    this.pointsToWin = Math.max(5, Math.min(25, Number(options.pointsToWin) || 10)); // For teams mode
    this.totalRounds = Math.max(3, Math.min(15, Number(options.totalRounds) || 7)); // For coop mode

    this.players = []; // Array of player objects
    this.state = 'waiting'; // waiting, psychic_clue, team_guess, counter_guess, reveal, game_over

    this.currentRound = 0;
    this.psychicIndex = 0;
    this.currentPsychicId = null;

    this.currentCard = null;
    this.usedCardIds = [];

    this.target = 50; // Target center (12 - 88)
    this.dialNeedle = 50; // Current dial needle position (0 - 100)
    this.clue = '';

    // Teams mode tracking
    this.activeTeam = 'red'; // 'red' or 'blue'
    this.counterGuess = null; // 'left' or 'right'
    this.scores = {
      coop: 0,
      red: 0,
      blue: 0
    };

    this.lastRoundResult = null; // { round, card, target, dialNeedle, distance, points, counterGuess, counterCorrect, bonusPoint }
    this.history = []; // Array of past round results

    this.timer = null;
    this.timerEndsAt = null;
    this.io = null;

    this.winner = null;
    this.winReason = '';
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

    // Auto-balance teams in teams mode
    const redCount = this.players.filter(p => p.team === 'red').length;
    const blueCount = this.players.filter(p => p.team === 'blue').length;
    const assignedTeam = redCount <= blueCount ? 'red' : 'blue';

    const player = {
      id: socketId,
      name: cleanName,
      isHost: this.players.length === 0,
      team: assignedTeam, // 'red' or 'blue'
      connected: true,
      avatarIndex: (this.players.length % 8) + 1
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
      // If psychic disconnects during psychic phase, pass to next player
      if (this.currentPsychicId === socketId && this.state === 'psychic_clue') {
        this.nextPsychic();
      }
    }
  }

  switchPlayerTeam(socketId, newTeam) {
    if (this.state !== 'waiting') return { error: 'Cannot switch teams during game' };
    const player = this.players.find(p => p.id === socketId);
    if (!player) return { error: 'Player not found' };
    if (newTeam === 'red' || newTeam === 'blue') {
      player.team = newTeam;
      return { success: true };
    }
    return { error: 'Invalid team' };
  }

  canStart() {
    if (this.state !== 'waiting') return false;
    if (this.mode === 'teams') {
      const red = this.players.filter(p => p.team === 'red');
      const blue = this.players.filter(p => p.team === 'blue');
      return red.length >= 1 && blue.length >= 1;
    }
    return this.players.length >= 2;
  }

  startGame(customOptions = {}) {
    if (!this.canStart()) return false;

    this.clearTimer();
    this.currentRound = 0;
    this.scores = { coop: 0, red: 0, blue: 0 };
    this.history = [];
    this.lastRoundResult = null;
    this.winner = null;
    this.winReason = '';
    this.psychicIndex = -1;
    this.activeTeam = 'red';

    if (customOptions.mode) this.mode = customOptions.mode;
    if (customOptions.pointsToWin) this.pointsToWin = Number(customOptions.pointsToWin);
    if (customOptions.totalRounds) this.totalRounds = Number(customOptions.totalRounds);
    if (customOptions.customLeft && customOptions.customRight) {
      this.pendingCustomCard = { id: 'custom', left: String(customOptions.customLeft).trim(), right: String(customOptions.customRight).trim() };
    } else {
      this.pendingCustomCard = null;
    }

    this.startNewRound();
    return true;
  }

  startNewRound() {
    this.clearTimer();
    this.currentRound += 1;
    this.clue = '';
    this.dialNeedle = 50; // Reset dial to center
    this.counterGuess = null;

    // In teams mode, alternate active team each round
    if (this.mode === 'teams') {
      this.activeTeam = this.currentRound % 2 === 1 ? 'red' : 'blue';
    }

    // Pick next psychic
    this.nextPsychic();

    // Pick new spectrum card (or custom card if provided)
    if (this.pendingCustomCard) {
      this.currentCard = this.pendingCustomCard;
      this.pendingCustomCard = null;
    } else {
      this.currentCard = getRandomSpectrumCard(this.usedCardIds);
      this.usedCardIds.push(this.currentCard.id);
      if (this.usedCardIds.length > 40) this.usedCardIds.shift();
    }

    // Pick secret target position between 12% and 88%
    this.target = Math.floor(Math.random() * 77) + 12;

    this.state = 'psychic_clue';
  }

  nextPsychic() {
    const connectedPlayers = this.players.filter(p => p.connected);
    if (connectedPlayers.length === 0) return;

    if (this.mode === 'teams') {
      // Pick next player belonging to active team
      const teamPlayers = connectedPlayers.filter(p => p.team === this.activeTeam);
      if (teamPlayers.length > 0) {
        const nextIndex = (this.currentRound - 1) % teamPlayers.length;
        this.currentPsychicId = teamPlayers[nextIndex].id;
        return;
      }
    }

    // Co-op mode or fallback: rotate among all players
    this.psychicIndex = (this.psychicIndex + 1) % connectedPlayers.length;
    this.currentPsychicId = connectedPlayers[this.psychicIndex].id;
  }

  submitClue(socketId, clueText) {
    if (this.state !== 'psychic_clue') return { error: 'Not in clue giving phase' };
    if (socketId !== this.currentPsychicId) return { error: 'Only the Psychic can give a clue' };

    const cleanClue = String(clueText || '').trim().slice(0, 100);
    if (!cleanClue) return { error: 'Clue cannot be empty' };

    this.clue = cleanClue;
    this.state = 'team_guess';
    return { success: true };
  }

  moveDial(socketId, position) {
    if (this.state !== 'team_guess') return { error: 'Dial cannot be moved right now' };

    // Psychic cannot move dial
    if (socketId === this.currentPsychicId) return { error: 'Psychic cannot adjust the dial' };

    // In teams mode, only active team members can move dial
    if (this.mode === 'teams') {
      const player = this.players.find(p => p.id === socketId);
      if (!player || player.team !== this.activeTeam) {
        return { error: 'Only the active guessing team can move the dial' };
      }
    }

    const pos = Math.max(0, Math.min(100, Number(position) || 0));
    this.dialNeedle = Math.round(pos * 10) / 10; // 1 decimal place

    return { success: true, dialNeedle: this.dialNeedle };
  }

  lockDial(socketId) {
    if (this.state !== 'team_guess') return { error: 'Cannot lock dial right now' };
    if (socketId === this.currentPsychicId) return { error: 'Psychic cannot lock the dial' };

    if (this.mode === 'teams') {
      const player = this.players.find(p => p.id === socketId);
      if (!player || player.team !== this.activeTeam) {
        return { error: 'Only the active guessing team can lock the dial' };
      }
      // In teams mode, move to counter-guess phase for the other team
      this.state = 'counter_guess';
    } else {
      // In coop mode, reveal immediately
      this.revealResult();
    }

    return { success: true };
  }

  submitCounterGuess(socketId, guess) {
    if (this.state !== 'counter_guess') return { error: 'Not in counter-guess phase' };
    const player = this.players.find(p => p.id === socketId);
    if (!player) return { error: 'Player not found' };

    const opponentTeam = this.activeTeam === 'red' ? 'blue' : 'red';
    if (player.team !== opponentTeam) {
      return { error: 'Only opposing team can counter-guess' };
    }

    if (guess !== 'left' && guess !== 'right') {
      return { error: 'Counter-guess must be "left" or "right"' };
    }

    this.counterGuess = guess;
    this.revealResult();
    return { success: true };
  }

  revealResult() {
    this.state = 'reveal';

    // Calculate score based on distance from target
    const distance = Math.abs(this.dialNeedle - this.target);
    let points = 0;
    let zone = 'miss';

    if (distance <= 3.5) {
      points = 4;
      zone = 'bullseye';
    } else if (distance <= 8) {
      points = 3;
      zone = 'inner';
    } else if (distance <= 14) {
      points = 2;
      zone = 'outer';
    } else {
      points = 0;
      zone = 'miss';
    }

    let counterCorrect = false;
    let bonusPoint = 0;

    if (this.mode === 'teams' && this.counterGuess) {
      // Target relative to needle
      const actualSide = this.target < this.dialNeedle ? 'left' : (this.target > this.dialNeedle ? 'right' : 'exact');
      if (actualSide === this.counterGuess && points < 4) {
        // Counter guess only awards point if dial wasn't bullseye (official rule)
        counterCorrect = true;
        bonusPoint = 1;
        const opponentTeam = this.activeTeam === 'red' ? 'blue' : 'red';
        this.scores[opponentTeam] += 1;
      }
    }

    // Add main points
    if (this.mode === 'teams') {
      this.scores[this.activeTeam] += points;
    } else {
      this.scores.coop += points;
    }

    const psychic = this.players.find(p => p.id === this.currentPsychicId);
    this.lastRoundResult = {
      round: this.currentRound,
      card: this.currentCard,
      clue: this.clue,
      target: this.target,
      dialNeedle: this.dialNeedle,
      distance: Math.round(distance * 10) / 10,
      points,
      zone,
      psychicName: psychic ? psychic.name : 'Unknown',
      activeTeam: this.activeTeam,
      counterGuess: this.counterGuess,
      counterCorrect,
      bonusPoint
    };

    this.history.unshift(this.lastRoundResult);

    // Check game over
    this.checkGameOver();
  }

  checkGameOver() {
    if (this.mode === 'teams') {
      const redWon = this.scores.red >= this.pointsToWin;
      const blueWon = this.scores.blue >= this.pointsToWin;
      if (redWon && blueWon) {
        if (this.scores.red !== this.scores.blue) {
          this.winner = this.scores.red > this.scores.blue ? 'red' : 'blue';
          this.winReason = `🏆 ${this.winner === 'red' ? 'Team Red' : 'Team Blue'} reached ${this.pointsToWin} points and won!`;
          this.state = 'game_over';
        }
        // Sudden death if tied above pointsToWin
      } else if (redWon) {
        this.winner = 'red';
        this.winReason = `🏆 Team Red scored ${this.scores.red} points and reached the target score!`;
        this.state = 'game_over';
      } else if (blueWon) {
        this.winner = 'blue';
        this.winReason = `🏆 Team Blue scored ${this.scores.blue} points and reached the target score!`;
        this.state = 'game_over';
      }
    } else {
      // Co-op mode: end after totalRounds
      if (this.currentRound >= this.totalRounds) {
        this.state = 'game_over';
        const score = this.scores.coop;
        const maxScore = this.totalRounds * 4;
        let rank = 'Novice';
        if (score >= maxScore * 0.85) rank = '🧠 Psychic Masters (Telepathic Legends!)';
        else if (score >= maxScore * 0.65) rank = '✨ Mind Readers (In Great Sync!)';
        else if (score >= maxScore * 0.45) rank = '📻 Clear Signals (Decent Tune-in)';
        else rank = '📡 Static on the Line (Needs Practice)';

        this.winner = 'coop';
        this.winReason = `Game Over! Final Co-op Score: ${score}/${maxScore} points. Rating: ${rank}`;
      }
    }
  }

  nextRound() {
    if (this.state === 'reveal' && this.state !== 'game_over') {
      this.startNewRound();
      return { success: true };
    }
    return { error: 'Cannot start next round right now' };
  }

  resetToLobby() {
    this.clearTimer();
    this.state = 'waiting';
    this.currentRound = 0;
    this.clue = '';
    this.dialNeedle = 50;
    this.scores = { coop: 0, red: 0, blue: 0 };
    this.history = [];
    this.lastRoundResult = null;
    this.winner = null;
    this.winReason = '';
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timerEndsAt = null;
  }

  getStateForPlayer(socketId) {
    const isPsychic = socketId === this.currentPsychicId;
    const isRevealed = this.state === 'reveal' || this.state === 'game_over';
    const player = this.players.find(p => p.id === socketId);
    const psychic = this.players.find(p => p.id === this.currentPsychicId);

    return {
      gameType: 'wavelength',
      roomId: this.roomId,
      state: this.state,
      mode: this.mode,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      pointsToWin: this.pointsToWin,
      scores: this.scores,

      currentPsychic: psychic ? { id: psychic.id, name: psychic.name, team: psychic.team } : null,
      isPsychic,
      activeTeam: this.activeTeam,

      currentCard: this.currentCard,
      clue: this.clue,
      dialNeedle: this.dialNeedle,
      counterGuess: this.counterGuess,

      // Target position is strictly secret!
      // Only the psychic sees it while giving clues and guessing.
      // Everyone sees it once revealed.
      target: (isPsychic || isRevealed) ? this.target : null,
      isTargetVisible: isPsychic || isRevealed,

      lastRoundResult: this.lastRoundResult,
      history: this.history,
      winner: this.winner,
      winReason: this.winReason,

      myPlayer: player ? {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        team: player.team,
        isPsychic
      } : null,

      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        team: p.team,
        connected: p.connected,
        avatarIndex: p.avatarIndex,
        isPsychic: p.id === this.currentPsychicId
      })),

      canStart: this.canStart(),
      settings: {
        maxPlayers: this.maxPlayers,
        mode: this.mode,
        pointsToWin: this.pointsToWin,
        totalRounds: this.totalRounds
      }
    };
  }

  handleAction(socketId, action, data = {}) {
    switch (action) {
      case 'submit-clue':
        return this.submitClue(socketId, data.clue);
      case 'move-dial':
        return this.moveDial(socketId, data.position);
      case 'lock-dial':
        return this.lockDial(socketId);
      case 'counter-guess':
        return this.submitCounterGuess(socketId, data.guess);
      case 'next-round': {
        const player = this.players.find(p => p.id === socketId);
        if (player && (player.isHost || player.id === this.currentPsychicId)) {
          return this.nextRound();
        }
        return { error: 'Only the host or psychic can advance to next round' };
      }
      case 'switch-team':
        return this.switchPlayerTeam(socketId, data.team);
      case 'play-again': {
        const player = this.players.find(p => p.id === socketId);
        if (player && player.isHost) {
          this.resetToLobby();
          return { success: true };
        }
        return { error: 'Only the host can reset the game' };
      }
      default:
        return { error: `Unknown action: ${action}` };
    }
  }
}

module.exports = WavelengthGame;

