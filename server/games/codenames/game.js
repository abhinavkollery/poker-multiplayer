const { getRandomGridWords } = require('./words');

class CodenamesGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'codenames';
    this.maxPlayers = Math.min(16, Math.max(2, Number(options.maxPlayers) || 12));

    this.players = [];
    this.state = 'waiting'; // 'waiting' | 'playing' | 'game_over'
    this.cards = []; // 25 cards
    this.startingTeam = 'red';
    this.currentTeam = 'red';
    this.phase = 'clue'; // 'clue' | 'guessing'
    this.currentClue = null;
    this.remainingGuesses = 0;
    this.winner = null;
    this.winReason = '';
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
    const cleanName = (name || '').trim().slice(0, 16) || `Agent ${this.players.length + 1}`;

    // Auto-balance teams Red and Blue
    const redCount = this.players.filter(p => p.team === 'red').length;
    const blueCount = this.players.filter(p => p.team === 'blue').length;
    const defaultTeam = redCount <= blueCount ? 'red' : 'blue';

    const player = {
      id,
      name: cleanName,
      team: defaultTeam,
      role: 'operative', // 'spymaster' | 'operative'
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
    return this.players.filter(p => p.connected).length >= 2;
  }

  startGame() {
    if (!this.canStart()) return { error: 'Need at least 2 players to start' };

    const words = getRandomGridWords(25);
    this.startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
    this.currentTeam = this.startingTeam;
    this.phase = 'clue';
    this.currentClue = null;
    this.remainingGuesses = 0;
    this.winner = null;
    this.winReason = '';
    this.state = 'playing';

    // 9 starting team, 8 second team, 7 neutral, 1 assassin
    const secondTeam = this.startingTeam === 'red' ? 'blue' : 'red';
    const cardTypes = [
      ...Array(9).fill(this.startingTeam),
      ...Array(8).fill(secondTeam),
      ...Array(7).fill('neutral'),
      'assassin'
    ];

    // Shuffle card colors
    for (let i = cardTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardTypes[i], cardTypes[j]] = [cardTypes[j], cardTypes[i]];
    }

    this.cards = words.map((word, idx) => ({
      id: idx,
      word,
      color: cardTypes[idx],
      revealed: false
    }));

    // Ensure at least one spymaster per team
    ['red', 'blue'].forEach(t => {
      const teamPlayers = this.players.filter(p => p.team === t && p.connected);
      if (teamPlayers.length > 0 && !teamPlayers.some(p => p.role === 'spymaster')) {
        teamPlayers[0].role = 'spymaster';
      }
    });

    return { success: true };
  }

  giveClue(playerId, word, count) {
    if (this.state !== 'playing' || this.phase !== 'clue') {
      return { error: 'Not the clue giving phase' };
    }
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.team !== this.currentTeam || player.role !== 'spymaster') {
      return { error: 'Only the current team spymaster can give a clue' };
    }

    const cleanWord = (word || '').trim().toUpperCase();
    const cleanCount = Number(count);
    if (!cleanWord || isNaN(cleanCount) || cleanCount < 0) {
      return { error: 'Invalid clue format' };
    }

    this.currentClue = { word: cleanWord, count: cleanCount };
    this.phase = 'guessing';
    // Operatives get count + 1 guesses
    this.remainingGuesses = cleanCount === 0 ? 99 : cleanCount + 1;

    return { success: true, clue: this.currentClue };
  }

  pickCard(playerId, cardId) {
    if (this.state !== 'playing' || this.phase !== 'guessing') {
      return { error: 'Not the guessing phase' };
    }
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.team !== this.currentTeam || player.role !== 'operative') {
      return { error: 'Only current team operatives can pick cards' };
    }

    const card = this.cards.find(c => c.id === cardId);
    if (!card) return { error: 'Card not found' };
    if (card.revealed) return { error: 'Card already revealed' };

    card.revealed = true;
    this.remainingGuesses--;

    // 1. Assassin picked -> Instant loss!
    if (card.color === 'assassin') {
      this.winner = this.currentTeam === 'red' ? 'blue' : 'red';
      this.winReason = `${this.currentTeam.toUpperCase()} touched the Assassin! 💀`;
      this.state = 'game_over';
      return { success: true, gameOver: true };
    }

    // 2. Check if either team has won
    const redRemaining = this.cards.filter(c => c.color === 'red' && !c.revealed).length;
    const blueRemaining = this.cards.filter(c => c.color === 'blue' && !c.revealed).length;

    if (redRemaining === 0) {
      this.winner = 'red';
      this.winReason = 'Red Team contacted all secret agents! 🎉';
      this.state = 'game_over';
      return { success: true, gameOver: true };
    }
    if (blueRemaining === 0) {
      this.winner = 'blue';
      this.winReason = 'Blue Team contacted all secret agents! 🎉';
      this.state = 'game_over';
      return { success: true, gameOver: true };
    }

    // 3. If correct team card, continue if guesses remain
    if (card.color === this.currentTeam) {
      if (this.remainingGuesses <= 0) {
        this.endTurn();
      }
      return { success: true, correct: true };
    }

    // 4. Opponent or neutral card -> Turn ends immediately!
    this.endTurn();
    return { success: true, correct: false };
  }

  endTurn() {
    this.currentTeam = this.currentTeam === 'red' ? 'blue' : 'red';
    this.phase = 'clue';
    this.currentClue = null;
    this.remainingGuesses = 0;
  }

  setRole(playerId, role) {
    const p = this.players.find(pl => pl.id === playerId);
    if (p && (role === 'spymaster' || role === 'operative')) {
      p.role = role;
      return { success: true };
    }
    return { error: 'Invalid role' };
  }

  switchTeam(playerId, team) {
    const p = this.players.find(pl => pl.id === playerId);
    if (p && (team === 'red' || team === 'blue')) {
      p.team = team;
      return { success: true };
    }
    return { error: 'Invalid team' };
  }

  handleAction(playerId, action, payload = {}) {
    switch (action) {
      case 'give-clue':
        return this.giveClue(playerId, payload.word, payload.count);
      case 'pick-card':
        return this.pickCard(playerId, payload.cardId);
      case 'end-turn':
        const p = this.players.find(pl => pl.id === playerId);
        if (p && p.team === this.currentTeam && this.phase === 'guessing') {
          this.endTurn();
          return { success: true };
        }
        return { error: 'Cannot end turn now' };
      case 'set-role':
        return this.setRole(playerId, payload.role);
      case 'switch-team':
        return this.switchTeam(playerId, payload.team);
      case 'restart':
        return this.startGame();
      default:
        return { error: 'Unknown action' };
    }
  }

  getStateForPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const isSpymaster = player?.role === 'spymaster';
    const isGameOver = this.state === 'game_over';

    const redRemaining = this.cards.filter(c => c.color === 'red' && !c.revealed).length;
    const blueRemaining = this.cards.filter(c => c.color === 'blue' && !c.revealed).length;

    // Mask card colors for operatives unless revealed or game is over
    const personalizedCards = this.cards.map(c => {
      const showColor = isSpymaster || isGameOver || c.revealed;
      return {
        id: c.id,
        word: c.word,
        revealed: c.revealed,
        color: showColor ? c.color : null
      };
    });

    return {
      roomId: this.roomId,
      gameType: this.gameType,
      state: this.state,
      currentTeam: this.currentTeam,
      phase: this.phase,
      currentClue: this.currentClue,
      remainingGuesses: this.remainingGuesses,
      winner: this.winner,
      winReason: this.winReason,
      redRemaining,
      blueRemaining,
      cards: personalizedCards,
      isSpymaster,
      myTeam: player?.team || 'red',
      myRole: player?.role || 'operative',
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        role: p.role,
        connected: p.connected
      }))
    };
  }
}

module.exports = CodenamesGame;

