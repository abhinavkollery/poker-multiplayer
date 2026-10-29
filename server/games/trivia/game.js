const { getRandomQuestions } = require('./questions');

class SpeedTriviaGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'trivia';
    this.maxPlayers = Math.min(24, Math.max(2, Number(options.maxPlayers) || 12));
    this.questionCount = Math.min(20, Math.max(3, Number(options.questionCount) || 8));
    this.timeLimit = Math.min(30, Math.max(10, Number(options.timeLimit) || 15));

    this.players = [];
    this.state = 'waiting'; // 'waiting' | 'question' | 'reveal' | 'podium'
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.timeLeft = 0;
    this.timer = null;
    this.playerAnswers = new Map(); // playerId -> { optionIndex, scoreGained, isCorrect }
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
    const cleanName = (name || '').trim().slice(0, 16) || `Trivia Buff ${this.players.length + 1}`;
    const player = {
      id,
      name: cleanName,
      score: 0,
      streak: 0,
      lastAnswer: null,
      lastPoints: 0,
      connected: true
    };
    this.players.push(player);
    return { player };
  }

  removePlayer(id) {
    const p = this.players.find(pl => pl.id === id);
    if (p) p.connected = false;
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
    return this.players.filter(p => p.connected).length >= 1; // Solo or multi-player trivia
  }

  startGame(options = {}) {
    if (!this.canStart()) return { error: 'Need players to start' };
    if (options.questionCount) this.questionCount = Math.min(20, Math.max(3, Number(options.questionCount)));
    if (options.timeLimit) this.timeLimit = Math.min(30, Math.max(10, Number(options.timeLimit)));

    this.questions = getRandomQuestions(this.questionCount);
    this.currentQuestionIndex = 0;
    this.players.forEach(p => {
      p.score = 0;
      p.streak = 0;
      p.lastAnswer = null;
      p.lastPoints = 0;
    });

    this.startQuestion();
    return { success: true };
  }

  startQuestion() {
    this.clearTimer();
    this.playerAnswers.clear();
    this.state = 'question';
    this.timeLeft = this.timeLimit;

    this.players.forEach(p => {
      p.lastAnswer = null;
      p.lastPoints = 0;
    });

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.revealAnswer();
      } else {
        this.emitPersonalized();
      }
    }, 1000);

    this.emitPersonalized();
  }

  submitAnswer(playerId, optionIndex) {
    if (this.state !== 'question') return { error: 'Not taking answers right now' };
    if (this.playerAnswers.has(playerId)) return { error: 'Already answered' };

    const cleanOption = Number(optionIndex);
    if (isNaN(cleanOption) || cleanOption < 0 || cleanOption > 3) {
      return { error: 'Invalid option' };
    }

    const currentQ = this.questions[this.currentQuestionIndex];
    const isCorrect = cleanOption === currentQ.answer;
    const player = this.players.find(p => p.id === playerId);

    let scoreGained = 0;
    if (isCorrect && player) {
      // 500 base + up to 500 speed bonus + streak bonus
      const speedBonus = Math.round(500 * (this.timeLeft / this.timeLimit));
      const streakBonus = Math.min(200, player.streak * 50);
      scoreGained = 500 + speedBonus + streakBonus;
      player.score += scoreGained;
      player.streak += 1;
    } else if (player) {
      player.streak = 0;
    }

    if (player) {
      player.lastAnswer = cleanOption;
      player.lastPoints = scoreGained;
    }

    this.playerAnswers.set(playerId, {
      optionIndex: cleanOption,
      scoreGained,
      isCorrect
    });

    // If all active players answered, reveal early!
    const activeConnected = this.players.filter(p => p.connected);
    if (this.playerAnswers.size >= activeConnected.length && activeConnected.length > 0) {
      this.revealAnswer();
    } else {
      this.emitPersonalized();
    }

    return { success: true, answered: true };
  }

  revealAnswer() {
    this.clearTimer();
    this.state = 'reveal';
    this.timeLeft = 5; // 5s to view correct answer and stats

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.advanceNextQuestion();
      } else {
        this.emitPersonalized();
      }
    }, 1000);

    this.emitPersonalized();
  }

  advanceNextQuestion() {
    this.clearTimer();
    this.currentQuestionIndex++;

    if (this.currentQuestionIndex >= this.questions.length) {
      this.state = 'podium';
      this.emitPersonalized();
      return;
    }

    this.startQuestion();
  }

  handleAction(playerId, action, payload = {}) {
    switch (action) {
      case 'submit-answer':
        return this.submitAnswer(playerId, payload.optionIndex);
      case 'next-question':
        if (this.state === 'reveal') {
          this.advanceNextQuestion();
          return { success: true };
        }
        return { error: 'Cannot skip right now' };
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
    const currentQ = this.questions[this.currentQuestionIndex];
    const isReveal = this.state === 'reveal' || this.state === 'podium';
    const playerAnswer = this.playerAnswers.get(playerId);

    // Option pick counts for statistics breakdown
    const optionCounts = [0, 0, 0, 0];
    for (const ans of this.playerAnswers.values()) {
      if (ans.optionIndex >= 0 && ans.optionIndex <= 3) {
        optionCounts[ans.optionIndex]++;
      }
    }

    return {
      roomId: this.roomId,
      gameType: this.gameType,
      state: this.state,
      questionIndex: this.currentQuestionIndex + 1,
      totalQuestions: this.questions.length,
      timeLeft: this.timeLeft,
      timeLimit: this.timeLimit,
      question: currentQ ? {
        question: currentQ.question,
        options: currentQ.options,
        category: currentQ.category,
        correctAnswer: isReveal ? currentQ.answer : null
      } : null,
      myAnswer: playerAnswer ? playerAnswer.optionIndex : null,
      hasAnswered: this.playerAnswers.has(playerId),
      optionCounts: isReveal ? optionCounts : null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        streak: p.streak,
        lastPoints: p.lastPoints,
        hasAnswered: this.playerAnswers.has(p.id),
        connected: p.connected
      }))
    };
  }
}

module.exports = SpeedTriviaGame;

