const { getRandomWordPair } = require('./words');

class ImposterGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'imposter';
    this.maxPlayers = Math.min(16, Math.max(3, Number(options.maxPlayers) || 10));
    this.imposterCount = Math.max(1, Math.min(3, Number(options.imposterCount) || 1));
    this.roundTime = Number(options.roundTime) || 35; // seconds per clue
    this.discussionTime = Number(options.discussionTime) || 60; // seconds for discussion
    this.votingTime = Number(options.votingTime) || 30; // seconds for voting
    this.category = options.category || 'all';

    this.players = []; // Array of player objects
    this.state = 'waiting'; // waiting, revealing, clues, discussion, voting, vote_result, imposter_guess, game_over

    this.currentPair = null;
    this.civilianWord = '';
    this.imposterWord = '';
    this.usedPairIds = [];

    this.roundNumber = 0;
    this.clueRound = 1;
    this.maxClueRounds = 1; // 1 round of clues before each vote

    this.turnOrder = []; // array of player ids
    this.currentTurnIndex = 0;

    this.clues = []; // [{ round, clueRound, playerId, playerName, text, timestamp }]
    this.votes = {}; // voterId -> targetId
    this.lastVoteResult = null; // { eliminatedPlayer, voteCounts, wasImposter, tie: boolean }

    this.timer = null;
    this.timerEndsAt = null;
    this.io = null;

    this.winner = null; // 'civilians' | 'imposters'
    this.winReason = '';
    this.imposterGuessResult = null; // { guess, correct }
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

    const player = {
      id: socketId,
      name: cleanName,
      isHost: this.players.length === 0,
      isImposter: false,
      word: '',
      alive: true,
      ready: false,
      connected: true,
      score: 0,
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
      // If active player in clue phase disconnects, skip their turn
      if (this.state === 'clues' && this.getCurrentTurnPlayerId() === socketId) {
        this.nextClueTurn();
      }
      // Check win condition if in progress
      this.checkWinCondition();
    }
  }

  canStart() {
    return this.state === 'waiting' && this.players.length >= 3;
  }

  startGame(customOptions = {}) {
    if (!this.canStart()) return false;

    this.clearTimer();
    this.state = 'revealing';
    this.roundNumber += 1;
    this.clueRound = 1;
    this.clues = [];
    this.votes = {};
    this.lastVoteResult = null;
    this.winner = null;
    this.winReason = '';
    this.imposterGuessResult = null;
    this.blankMode = !!customOptions.blankMode;

    // Pick word pair
    if (customOptions.civilianWord && customOptions.imposterWord) {
      this.civilianWord = customOptions.civilianWord.trim();
      this.imposterWord = customOptions.imposterWord.trim();
      this.currentPair = { category: 'Custom', civilianWord: this.civilianWord, imposterWord: this.imposterWord };
    } else {
      const pair = getRandomWordPair(this.category, this.usedPairIds);
      this.currentPair = pair;
      this.civilianWord = pair.civilianWord;
      this.imposterWord = pair.imposterWord;
      this.usedPairIds.push(pair.id);
      if (this.usedPairIds.length > 30) this.usedPairIds.shift();
    }

    // Determine imposter count (1 for 3-5 players, up to 2 for 6+)
    const maxAllowedImposters = Math.max(1, Math.floor((this.players.length - 1) / 2));
    const effectiveImposters = Math.min(this.imposterCount, maxAllowedImposters);

    // Shuffle and assign roles
    const shuffled = [...this.players].sort(() => Math.random() - 0.5);
    const imposterIds = new Set(shuffled.slice(0, effectiveImposters).map(p => p.id));

    for (const player of this.players) {
      player.alive = true;
      player.ready = false;
      player.isImposter = imposterIds.has(player.id);
      player.word = player.isImposter ? (this.blankMode ? '??? (NO WORD - BLUFF!)' : this.imposterWord) : this.civilianWord;
    }

    // Turn order for clues
    this.turnOrder = this.players.map(p => p.id).sort(() => Math.random() - 0.5);
    this.currentTurnIndex = 0;

    // 12 second auto-start for reveal, or starts when all players click Ready
    this.startTimer(12, () => this.startCluePhase());

    return true;
  }

  playerReady(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player) return;
    player.ready = true;

    if (this.state === 'revealing' && this.players.filter(p => p.connected).every(p => p.ready)) {
      this.clearTimer();
      this.startCluePhase();
    }
  }

  startCluePhase() {
    this.clearTimer();
    this.state = 'clues';
    // Filter turn order to alive players
    this.turnOrder = this.turnOrder.filter(id => {
      const p = this.players.find(pl => pl.id === id);
      return p && p.alive && p.connected;
    });
    this.currentTurnIndex = 0;
    this.startTurnTimer();
  }

  getCurrentTurnPlayerId() {
    if (this.turnOrder.length === 0) return null;
    return this.turnOrder[this.currentTurnIndex];
  }

  startTurnTimer() {
    this.clearTimer();
    const activePlayerId = this.getCurrentTurnPlayerId();
    if (!activePlayerId) {
      this.startDiscussionPhase();
      return;
    }

    const duration = this.roundTime > 0 ? this.roundTime : 40;
    this.startTimer(duration, () => {
      // Auto-pass if timeout
      const p = this.players.find(pl => pl.id === activePlayerId);
      if (p) {
        this.submitClue(activePlayerId, '(Passed turn / No clue)');
      } else {
        this.nextClueTurn();
      }
    });
  }

  submitClue(socketId, clueText) {
    if (this.state !== 'clues') return { error: 'Not in clue phase' };
    const activeId = this.getCurrentTurnPlayerId();
    if (activeId !== socketId) return { error: 'Not your turn to give a clue' };

    const player = this.players.find(p => p.id === socketId);
    if (!player || !player.alive) return { error: 'Player cannot act' };

    const cleanClue = String(clueText || '').trim().slice(0, 100);
    this.clues.push({
      round: this.roundNumber,
      clueRound: this.clueRound,
      playerId: player.id,
      playerName: player.name,
      text: cleanClue || '(No clue given)',
      timestamp: Date.now()
    });

    this.nextClueTurn();
    return { success: true };
  }

  nextClueTurn() {
    this.currentTurnIndex += 1;
    if (this.currentTurnIndex >= this.turnOrder.length) {
      // Completed 1 full round of clues for all alive players
      this.startDiscussionPhase();
    } else {
      this.startTurnTimer();
    }
  }

  startDiscussionPhase() {
    this.clearTimer();
    this.state = 'discussion';
    const duration = this.discussionTime > 0 ? this.discussionTime : 60;
    this.startTimer(duration, () => this.startVotingPhase());
  }

  startVotingPhase() {
    this.clearTimer();
    this.state = 'voting';
    this.votes = {};
    const duration = this.votingTime > 0 ? this.votingTime : 30;
    this.startTimer(duration, () => this.tallyVotes());
  }

  castVote(voterId, targetId) {
    if (this.state !== 'voting') return { error: 'Not currently voting' };
    const voter = this.players.find(p => p.id === voterId);
    if (!voter || !voter.alive) return { error: 'Only alive players can vote' };

    const target = this.players.find(p => p.id === targetId);
    if (!target || !target.alive) return { error: 'Vote target must be an alive player' };

    this.votes[voterId] = targetId;

    // If all alive and connected players have voted, tally immediately
    const alivePlayers = this.players.filter(p => p.alive && p.connected);
    const votesCount = Object.keys(this.votes).length;
    if (votesCount >= alivePlayers.length) {
      this.clearTimer();
      this.tallyVotes();
    }

    return { success: true };
  }

  tallyVotes() {
    this.clearTimer();
    this.state = 'vote_result';

    // Count votes per target
    const counts = {};
    for (const voterId of Object.keys(this.votes)) {
      const targetId = this.votes[voterId];
      counts[targetId] = (counts[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let candidates = [];
    for (const [targetId, cnt] of Object.entries(counts)) {
      if (cnt > maxVotes) {
        maxVotes = cnt;
        candidates = [targetId];
      } else if (cnt === maxVotes) {
        candidates.push(targetId);
      }
    }

    // Detailed vote log
    const breakdown = Object.entries(counts).map(([id, voteCount]) => {
      const p = this.players.find(pl => pl.id === id);
      const voters = Object.entries(this.votes)
        .filter(([, target]) => target === id)
        .map(([voter]) => this.players.find(pl => pl.id === voter)?.name || 'Unknown');
      return {
        id,
        name: p ? p.name : 'Unknown',
        voteCount,
        voters
      };
    }).sort((a, b) => b.voteCount - a.voteCount);

    let eliminatedPlayer = null;
    let isTie = false;

    if (candidates.length === 1 && maxVotes > 0) {
      eliminatedPlayer = this.players.find(p => p.id === candidates[0]);
      if (eliminatedPlayer) {
        eliminatedPlayer.alive = false;
      }
    } else {
      isTie = true; // Tie or 0 votes -> no elimination
    }

    this.lastVoteResult = {
      breakdown,
      eliminatedPlayer: eliminatedPlayer ? {
        id: eliminatedPlayer.id,
        name: eliminatedPlayer.name,
        isImposter: eliminatedPlayer.isImposter,
        word: eliminatedPlayer.word
      } : null,
      isTie
    };

    // If an imposter was caught, give them a chance to steal the win by guessing the Civilian word!
    if (eliminatedPlayer && eliminatedPlayer.isImposter) {
      this.startTimer(6, () => {
        this.state = 'imposter_guess';
        this.startTimer(25, () => {
          // Time expired for imposter guess
          this.resolveImposterGuess(eliminatedPlayer.id, null);
        });
        if (this.io) this.emitState();
      });
    } else {
      // Delay before next round or game over
      this.startTimer(7, () => {
        const gameEnded = this.checkWinCondition();
        if (!gameEnded) {
          // Next round of clues
          this.clueRound += 1;
          this.startCluePhase();
          if (this.io) this.emitState();
        }
      });
    }
  }

  submitImposterGuess(imposterId, guess) {
    if (this.state !== 'imposter_guess') return { error: 'Not in imposter guess phase' };
    const player = this.players.find(p => p.id === imposterId);
    if (!player || !player.isImposter) return { error: 'Only the eliminated imposter can guess' };

    this.clearTimer();
    this.resolveImposterGuess(imposterId, guess);
    return { success: true };
  }

  resolveImposterGuess(imposterId, guess) {
    const cleanGuess = String(guess || '').trim().toLowerCase();
    const targetWord = this.civilianWord.trim().toLowerCase();

    // Fuzzy check: matches target word or closely contains it
    const isCorrect = cleanGuess.length > 0 && (
      cleanGuess === targetWord ||
      targetWord.includes(cleanGuess) ||
      cleanGuess.includes(targetWord)
    );

    this.imposterGuessResult = {
      guess: guess || '(No guess)',
      correct: isCorrect,
      civilianWord: this.civilianWord
    };

    if (isCorrect) {
      // Imposter guessed the word and stole the win!
      this.winner = 'imposters';
      this.winReason = `🕵️ The Imposter guessed the Civilians' secret word ("${this.civilianWord}") and stole the victory!`;
      this.endGame();
    } else {
      // Failed guess - check if any other imposters survive
      const survivingImposters = this.players.filter(p => p.alive && p.isImposter);
      if (survivingImposters.length === 0) {
        this.winner = 'civilians';
        this.winReason = `🎉 Civilians unmasked the Imposter and successfully defended their secret word!`;
        this.endGame();
      } else {
        // Still other imposters alive, continue game
        this.clueRound += 1;
        this.startCluePhase();
      }
    }

    if (this.io) this.emitState();
  }

  checkWinCondition() {
    if (this.state === 'waiting' || this.state === 'game_over') return true;

    const aliveImposters = this.players.filter(p => p.alive && p.isImposter);
    const aliveCivilians = this.players.filter(p => p.alive && !p.isImposter);

    if (aliveImposters.length === 0) {
      this.winner = 'civilians';
      this.winReason = '🎉 All Imposters have been discovered! Civilians win!';
      this.endGame();
      return true;
    }

    if (aliveImposters.length >= aliveCivilians.length) {
      this.winner = 'imposters';
      this.winReason = '🕵️ The Imposters have equaled or outnumbered the Civilians! Imposters win!';
      this.endGame();
      return true;
    }

    return false;
  }

  endGame() {
    this.clearTimer();
    this.state = 'game_over';

    // Award scores
    for (const player of this.players) {
      if ((this.winner === 'civilians' && !player.isImposter) ||
          (this.winner === 'imposters' && player.isImposter)) {
        player.score += 10;
      }
    }
  }

  resetToLobby() {
    this.clearTimer();
    this.state = 'waiting';
    this.clues = [];
    this.votes = {};
    this.lastVoteResult = null;
    this.winner = null;
    this.winReason = '';
    this.imposterGuessResult = null;
    this.blankMode = !!customOptions.blankMode;
    for (const player of this.players) {
      player.alive = true;
      player.ready = false;
      player.isImposter = false;
      player.word = '';
    }
  }

  startTimer(durationSeconds, callback) {
    this.clearTimer();
    this.timerEndsAt = Date.now() + durationSeconds * 1000;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.timerEndsAt = null;
      if (typeof callback === 'function') {
        callback();
        if (this.io) this.emitState();
      }
    }, durationSeconds * 1000);
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timerEndsAt = null;
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
    const isGameOver = this.state === 'game_over';
    const player = this.players.find(p => p.id === socketId);
    const timeRemaining = this.timerEndsAt ? Math.max(0, Math.ceil((this.timerEndsAt - Date.now()) / 1000)) : 0;

    const activeTurnPlayerId = this.state === 'clues' ? this.getCurrentTurnPlayerId() : null;
    const activeTurnPlayer = activeTurnPlayerId ? this.players.find(p => p.id === activeTurnPlayerId) : null;

    return {
      gameType: 'imposter',
      roomId: this.roomId,
      state: this.state,
      roundNumber: this.roundNumber,
      clueRound: this.clueRound,
      category: this.currentPair ? this.currentPair.category : this.category,
      timeRemaining,
      activeTurnPlayer: activeTurnPlayer ? { id: activeTurnPlayer.id, name: activeTurnPlayer.name } : null,

      // Personalized secret information
      myPlayer: player ? {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        alive: player.alive,
        ready: player.ready,
        isImposter: player.isImposter,
        word: player.word, // In imposter, each player sees their own word
        score: player.score
      } : null,

      // Public player list (roles hidden until game over)
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        alive: p.alive,
        ready: p.ready,
        connected: p.connected,
        score: p.score,
        avatarIndex: p.avatarIndex,
        hasVoted: !!this.votes[p.id],
        // Reveal roles only when game is over
        isImposter: isGameOver ? p.isImposter : undefined,
        word: isGameOver ? p.word : undefined
      })),

      clues: this.clues,
      votesCount: Object.keys(this.votes).length,
      lastVoteResult: this.lastVoteResult,
      winner: this.winner,
      winReason: this.winReason,
      imposterGuessResult: this.imposterGuessResult,
      revealedWords: isGameOver ? {
        civilianWord: this.civilianWord,
        imposterWord: this.imposterWord
      } : null,

      canStart: this.canStart(),
      settings: {
        maxPlayers: this.maxPlayers,
        imposterCount: this.imposterCount,
        roundTime: this.roundTime,
        discussionTime: this.discussionTime,
        votingTime: this.votingTime,
        category: this.category
      }
    };
  }

  handleAction(socketId, action, data = {}) {
    switch (action) {
      case 'ready':
        this.playerReady(socketId);
        return { success: true };
      case 'submit-clue':
        return this.submitClue(socketId, data.clue);
      case 'cast-vote':
        return this.castVote(socketId, data.targetId);
      case 'skip-discussion': {
        const player = this.players.find(p => p.id === socketId);
        if (player && player.isHost && this.state === 'discussion') {
          this.clearTimer();
          this.startVotingPhase();
          return { success: true };
        }
        return { error: 'Only the host can skip discussion' };
      }
      case 'imposter-guess':
        return this.submitImposterGuess(socketId, data.guess);
      case 'play-again': {
        const player = this.players.find(p => p.id === socketId);
        if (player && player.isHost) {
          this.resetToLobby();
          return { success: true };
        }
        return { error: 'Only host can reset game' };
      }
      default:
        return { error: `Unknown action: ${action}` };
    }
  }
}

module.exports = ImposterGame;

