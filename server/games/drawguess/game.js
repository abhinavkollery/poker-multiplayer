const { getRandomWords } = require('./words');

class DrawGuessGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'drawguess';
    this.maxPlayers = Math.min(16, Math.max(2, Number(options.maxPlayers) || 10));
    this.drawTime = Math.min(120, Math.max(30, Number(options.drawTime) || 75));
    this.maxRounds = Math.min(10, Math.max(1, Number(options.rounds) || 3));
    this.customWords = Array.isArray(options.customWords) ? options.customWords : [];

    this.players = [];
    this.state = 'waiting'; // 'waiting' | 'choosing' | 'drawing' | 'revealing' | 'game_over'
    this.currentRound = 1;
    this.currentDrawerIndex = 0;
    this.wordChoices = [];
    this.currentWord = '';
    this.strokes = []; // Stores canvas history
    this.timeLeft = 0;
    this.timer = null;
    this.guessedPlayerIds = new Set();
    this.chatLog = [];
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
    const cleanName = (name || '').trim().slice(0, 16) || `Artist ${this.players.length + 1}`;
    const player = {
      id,
      name: cleanName,
      score: 0,
      roundScore: 0,
      streak: 0,
      guessedCurrentRound: false,
      connected: true
    };
    this.players.push(player);
    return { player };
  }

  removePlayer(id) {
    const p = this.players.find(pl => pl.id === id);
    if (p) p.connected = false;

    // If current drawer left during drawing, advance turn
    if (this.state === 'drawing' && this.getCurrentDrawer()?.id === id) {
      this.chatLog.push({ type: 'system', text: `${p.name} disconnected. Skipping turn!` });
      this.endTurn(false);
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

  getCurrentDrawer() {
    if (!this.players.length) return null;
    return this.players[this.currentDrawerIndex % this.players.length];
  }

  startGame(options = {}) {
    if (!this.canStart()) return { error: 'Need at least 2 players to start' };
    if (options.rounds) this.maxRounds = Math.min(10, Math.max(1, Number(options.rounds)));
    if (options.drawTime) this.drawTime = Math.min(120, Math.max(30, Number(options.drawTime)));
    if (Array.isArray(options.customWords)) this.customWords = options.customWords;

    this.players.forEach(p => {
      p.score = 0;
      p.roundScore = 0;
      p.streak = 0;
      p.guessedCurrentRound = false;
    });

    this.currentRound = 1;
    this.currentDrawerIndex = 0;
    this.startTurn();
    return { success: true };
  }

  startTurn() {
    this.clearTimer();
    this.strokes = [];
    this.guessedPlayerIds.clear();
    this.currentWord = '';
    this.players.forEach(p => {
      p.guessedCurrentRound = false;
      p.roundScore = 0;
    });

    // Pick active connected drawer
    const connectedPlayers = this.players.filter(p => p.connected);
    if (!connectedPlayers.length) {
      this.state = 'game_over';
      return;
    }

    const drawer = this.getCurrentDrawer();
    if (!drawer || !drawer.connected) {
      this.currentDrawerIndex = (this.currentDrawerIndex + 1) % this.players.length;
      return this.startTurn();
    }

    this.wordChoices = getRandomWords(3, this.customWords);
    this.state = 'choosing';
    this.timeLeft = 15; // 15s to choose a word

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        // Auto-select first word if drawer didn't choose in time
        this.selectWord(drawer.id, this.wordChoices[0]);
      } else {
        this.emitPersonalized();
      }
    }, 1000);

    this.emitPersonalized();
  }

  selectWord(playerId, word) {
    const drawer = this.getCurrentDrawer();
    if (!drawer || drawer.id !== playerId) return { error: 'Not your turn to choose' };
    if (!word) word = this.wordChoices[0];

    this.clearTimer();
    this.currentWord = word.trim();
    this.state = 'drawing';
    this.timeLeft = this.drawTime;

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.endTurn(true);
      } else {
        this.emitPersonalized();
      }
    }, 1000);

    this.emitPersonalized();
    return { success: true, word: this.currentWord };
  }

  getMaskedWord() {
    if (!this.currentWord) return '';
    const len = this.currentWord.length;
    const chars = this.currentWord.split('');

    // Progressive letter hints
    const revealFirst = this.timeLeft <= Math.floor(this.drawTime * 0.55);
    const revealSecond = this.timeLeft <= Math.floor(this.drawTime * 0.25) && len > 4;

    return chars.map((ch, idx) => {
      if (ch === ' ' || ch === '-' || ch === "'") return ch;
      if (revealFirst && idx === 0) return ch;
      if (revealSecond && idx === Math.floor(len / 2)) return ch;
      return '_';
    }).join(' ');
  }

  handleGuess(playerId, text) {
    if (this.state !== 'drawing') return { chat: true };
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };

    const drawer = this.getCurrentDrawer();
    if (drawer && drawer.id === playerId) {
      return { error: 'Drawers cannot guess in their own turn' };
    }

    if (player.guessedCurrentRound) {
      // Already guessed: message only goes to other guessed players
      return { alreadyGuessed: true, text };
    }

    const cleanGuess = (text || '').trim().toLowerCase();
    const cleanWord = this.currentWord.trim().toLowerCase();

    if (cleanGuess === cleanWord) {
      // Correct guess!
      player.guessedCurrentRound = true;
      this.guessedPlayerIds.add(playerId);

      // Scoring formula: faster = more points
      const timeBonus = Math.max(50, Math.round(500 * (this.timeLeft / this.drawTime)));
      const streakBonus = Math.min(100, player.streak * 20);
      const points = timeBonus + streakBonus;
      player.score += points;
      player.roundScore = points;
      player.streak += 1;

      // Drawer gets bonus for each guesser
      if (drawer) {
        const drawerBonus = Math.round(250 / Math.max(1, this.players.length - 1));
        drawer.score += drawerBonus;
        drawer.roundScore += drawerBonus;
      }

      this.chatLog.push({
        type: 'success',
        text: `🎉 ${player.name} guessed the word! (+${points} pts)`
      });

      // Check if all non-drawers have guessed
      const guessersCount = this.players.filter(p => p.connected && p.id !== drawer?.id).length;
      if (this.guessedPlayerIds.size >= guessersCount && guessersCount > 0) {
        // Everyone guessed! End turn early
        this.chatLog.push({ type: 'system', text: '🌟 Everyone guessed the word!' });
        this.endTurn(true);
      } else {
        this.emitPersonalized();
      }

      return { correct: true, points };
    }

    // Check if close (Levenshtein distance = 1)
    if (this.isClose(cleanGuess, cleanWord)) {
      return { close: true, text };
    }

    return { chat: true, text };
  }

  isClose(a, b) {
    if (Math.abs(a.length - b.length) > 1 || a.length < 3) return false;
    let edits = 0;
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] !== b[j]) {
        edits++;
        if (edits > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else { i++; j++; }
      } else {
        i++; j++;
      }
    }
    return true;
  }

  endTurn(showReveal = true) {
    this.clearTimer();
    this.state = 'revealing';
    this.timeLeft = 5; // 5s reveal countdown

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.clearTimer();
        this.advanceToNextTurn();
      } else {
        this.emitPersonalized();
      }
    }, 1000);

    this.emitPersonalized();
  }

  advanceToNextTurn() {
    this.currentDrawerIndex++;

    // If completed a full cycle across all players
    if (this.currentDrawerIndex >= this.players.length) {
      this.currentDrawerIndex = 0;
      this.currentRound++;

      if (this.currentRound > this.maxRounds) {
        this.state = 'game_over';
        this.clearTimer();
        this.emitPersonalized();
        return;
      }
    }

    this.startTurn();
  }

  handleAction(playerId, action, payload = {}) {
    switch (action) {
      case 'select-word':
        return this.selectWord(playerId, payload.word);
      case 'draw-stroke':
        if (this.state !== 'drawing' || this.getCurrentDrawer()?.id !== playerId) return;
        this.strokes.push(payload);
        return { success: true };
      case 'clear-canvas':
        if (this.state !== 'drawing' || this.getCurrentDrawer()?.id !== playerId) return;
        this.strokes = [];
        return { cleared: true };
      case 'undo-stroke':
        if (this.state !== 'drawing' || this.getCurrentDrawer()?.id !== playerId) return;
        this.strokes.pop();
        return { undone: true };
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
    const drawer = this.getCurrentDrawer();
    const isDrawer = drawer?.id === playerId;
    const player = this.players.find(p => p.id === playerId);
    const hasGuessed = player?.guessedCurrentRound || false;
    const isRevealing = this.state === 'revealing' || this.state === 'game_over';

    return {
      roomId: this.roomId,
      gameType: this.gameType,
      state: this.state,
      currentRound: this.currentRound,
      maxRounds: this.maxRounds,
      timeLeft: this.timeLeft,
      drawTime: this.drawTime,
      drawer: drawer ? { id: drawer.id, name: drawer.name } : null,
      isDrawer,
      wordChoices: isDrawer && this.state === 'choosing' ? this.wordChoices : [],
      word: (isDrawer || hasGuessed || isRevealing) ? this.currentWord : this.getMaskedWord(),
      hasGuessed,
      strokes: this.strokes,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        roundScore: p.roundScore,
        streak: p.streak,
        isDrawer: p.id === drawer?.id,
        hasGuessed: p.guessedCurrentRound,
        connected: p.connected
      })),
      chatLog: this.chatLog.slice(-25)
    };
  }
}

module.exports = DrawGuessGame;

