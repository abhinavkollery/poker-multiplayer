const { createDeck, shuffle } = require('./deck');
const { getBestHand, compareHands } = require('./evaluator');

const TURN_TIMEOUT = 30000; // 30 seconds

class PokerGame {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.gameType = 'poker';
    this.maxPlayers = options.maxPlayers || 6;
    this.startingChips = options.startingChips || 1000;
    this.smallBlind = options.smallBlind || 10;
    this.bigBlind = options.bigBlind || 20;
    this.players = []; // array of player objects
    this.state = 'waiting';
    this.communityCards = [];
    this.pot = 0;
    this.deck = [];
    this.dealerIndex = -1; // which player is dealer/button
    this.currentPlayerIndex = 0;
    this.currentBet = 0;
    this.toAct = new Set(); // player ids who still need to act this round
    this.turnTimer = null;
    this.nextHandTimer = null;
    this.turnStartTime = null;
    this.io = null;
    this.handNumber = 0;
    this.log = [];
    this.lastWinners = [];
    this.showingShowdown = false;
    this.smallBlindIndex = -1;
    this.bigBlindIndex = -1;
    this.showdownData = null;
  }

  addPlayer(socketId, name) {
    if (this.players.length >= this.maxPlayers) {
      return { error: 'Room is full' };
    }
    if (this.state !== 'waiting') {
      return { error: 'Game already in progress' };
    }
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return { error: 'Player name is required' };
    }
    const existing = this.players.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      existing.id = socketId;
      existing.connected = true;
      return { success: true, player: existing, reconnected: true };
    }

    const player = {
      id: socketId,
      name: trimmedName,
      chips: this.startingChips,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      connected: true,
      seatIndex: this.players.length,
      handResult: null
    };

    this.players.push(player);
    this.addLog(`${player.name} joined the room`);
    return { success: true, player };
  }

  addBot(name = null) {
    if (this.players.length >= this.maxPlayers) {
      return { error: 'Room is full' };
    }
    if (this.state !== 'waiting') {
      return { error: 'Cannot add bot during active hand' };
    }

    const botNames = ['PokerBot Alex', 'ChipMaster Sam', 'BluffQueen Mia', 'HighRoller Leo', 'CardShark Kai'];
    const botName = name || botNames[this.players.filter(p => p.isBot).length % botNames.length];
    const botId = 'bot_' + Math.random().toString(36).substring(2, 8);

    const player = {
      id: botId,
      name: botName,
      chips: this.startingChips,
      holeCards: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      connected: true,
      isBot: true,
      seatIndex: this.players.length,
      handResult: null
    };

    this.players.push(player);
    this.addLog(`${player.name} (CPU) joined the table`);
    return { success: true, player };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.id === socketId);
    if (idx === -1) return;

    const player = this.players[idx];

    if (this.state === 'waiting') {
      this.players.splice(idx, 1);
      this.players.forEach((p, i) => {
        p.seatIndex = i;
      });
      this.addLog(`${player.name} left the room`);
    } else {
      player.connected = false;
      this.addLog(`${player.name} disconnected`);

      // If it is their turn right now, trigger auto-action quickly
      if (
        this.state !== 'showdown' &&
        this.players[this.currentPlayerIndex]?.id === socketId
      ) {
        this.clearTurnTimer();
        this.startTurnTimer();
      }
    }
  }

  reconnectPlayer(newSocketId, name) {
    const trimmedName = (name || '').trim().toLowerCase();
    const player = this.players.find(p => p.name.toLowerCase() === trimmedName);
    if (!player) {
      return { success: false, error: 'Player not found in this room' };
    }

    const oldId = player.id;
    player.id = newSocketId;
    player.connected = true;

    if (this.toAct.has(oldId)) {
      this.toAct.delete(oldId);
      this.toAct.add(newSocketId);
    }

    this.addLog(`${player.name} reconnected`);
    return { success: true, player };
  }

  canStart() {
    return this.players.length >= 2 && this.state === 'waiting';
  }

  startGame() {
    if (!this.canStart()) return false;
    this.dealHand();
    return true;
  }

  dealHand() {
    this.clearTurnTimer();
    if (this.nextHandTimer) {
      clearTimeout(this.nextHandTimer);
      this.nextHandTimer = null;
    }

    this.showingShowdown = false;
    this.showdownData = null;
    this.lastWinners = [];

    // Remove players with 0 chips
    this.players = this.players.filter(p => p.chips > 0);
    this.players.forEach((p, idx) => {
      p.seatIndex = idx;
    });

    // Check minimum players
    if (this.players.length < 2) {
      this.state = 'waiting';
      this.addLog('Not enough players with chips to continue. Waiting for players.');
      this.emit('game-over', {
        message: 'Not enough players to continue',
        winner: this.players[0] ? this.players[0].name : null
      });
      this.emitToAllPersonalized();
      return;
    }

    this.handNumber++;
    this.state = 'pre-flop';
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;

    // Reset players for new hand
    for (const player of this.players) {
      player.holeCards = [];
      player.bet = 0;
      player.totalBet = 0;
      player.folded = false;
      player.allIn = false;
      player.handResult = null;
    }

    // Shuffle and deal 2 cards each
    this.deck = shuffle(createDeck());
    for (let r = 0; r < 2; r++) {
      for (const player of this.players) {
        player.holeCards.push(this.deck.pop());
      }
    }

    const n = this.players.length;

    // Advance dealerIndex
    if (this.dealerIndex === -1) {
      this.dealerIndex = 0;
    } else {
      this.dealerIndex = (this.dealerIndex + 1) % n;
    }

    // Small blind & Big blind indices
    let sbIdx, bbIdx;
    if (n === 2) {
      // Heads-up: dealer is SB, other is BB
      sbIdx = this.dealerIndex;
      bbIdx = (this.dealerIndex + 1) % n;
    } else {
      sbIdx = (this.dealerIndex + 1) % n;
      bbIdx = (this.dealerIndex + 2) % n;
    }

    this.smallBlindIndex = sbIdx;
    this.bigBlindIndex = bbIdx;

    // Post blinds
    this.postBlind(this.players[sbIdx], this.smallBlind, 'small blind');
    this.postBlind(this.players[bbIdx], this.bigBlind, 'big blind');
    this.currentBet = Math.max(this.players[sbIdx].bet, this.players[bbIdx].bet);

    // Pre-flop action starts left of BB
    const firstToAct = (bbIdx + 1) % n;
    this.currentPlayerIndex = firstToAct;

    // Initialize toAct = all non-all-in players
    this.toAct = new Set();
    for (const player of this.players) {
      if (!player.allIn) {
        this.toAct.add(player.id);
      }
    }

    this.skipToNextInToAct(false);

    this.addLog(`--- Hand #${this.handNumber} started ---`);
    this.emit('hand-started', this.getPublicState());
    this.emitToAllPersonalized();
    this.startTurnTimer();
  }

  postBlind(player, amount, blindName = 'blind') {
    const blindAmount = Math.min(amount, player.chips);
    player.chips -= blindAmount;
    player.bet += blindAmount;
    player.totalBet += blindAmount;
    this.pot += blindAmount;

    if (player.chips === 0) {
      player.allIn = true;
    }

    this.addLog(`${player.name} posts ${blindName} of $${blindAmount}`);
  }

  handleAction(socketId, action, amount) {
    if (this.state === 'waiting' || this.state === 'showdown') {
      return { error: 'No active betting round' };
    }

    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== socketId) {
      return { error: 'Not your turn' };
    }

    if (currentPlayer.folded || currentPlayer.allIn) {
      return { error: 'Player cannot take an action' };
    }

    this.clearTurnTimer();

    const act = (action || '').toLowerCase();
    let actResult = null;

    if (act === 'fold') {
      actResult = this.fold(currentPlayer);
    } else if (act === 'check') {
      if (currentPlayer.bet < this.currentBet) {
        this.startTurnTimer();
        return { error: `Cannot check, current bet is $${this.currentBet} (your bet is $${currentPlayer.bet})` };
      }
      actResult = this.check(currentPlayer);
    } else if (act === 'call') {
      actResult = this.call(currentPlayer);
    } else if (act === 'raise' || act === 'bet') {
      const totalAmount = Number(amount);
      if (isNaN(totalAmount) || totalAmount <= this.currentBet) {
        this.startTurnTimer();
        return { error: `Raise must be greater than current bet of $${this.currentBet}` };
      }
      actResult = this.doRaise(currentPlayer, totalAmount);
    } else if (act === 'allin' || act === 'all-in') {
      actResult = this.doAllIn(currentPlayer);
    } else {
      this.startTurnTimer();
      return { error: `Unknown action: ${action}` };
    }

    // Remove player from toAct
    this.toAct.delete(currentPlayer.id);

    // If action is raise or bet that raised the current bet:
    // re-add all non-folded, non-allIn players EXCEPT current player to toAct
    if (actResult && actResult.raised) {
      this.toAct.clear();
      for (const p of this.players) {
        if (p.id !== currentPlayer.id && !p.folded && !p.allIn) {
          this.toAct.add(p.id);
        }
      }
    }

    this.advanceAfterAction();
    return { success: true };
  }

  fold(player) {
    player.folded = true;
    this.addLog(`${player.name} folds`);
    this.emit('player-action', { playerId: player.id, action: 'fold' });
    return { success: true };
  }

  check(player) {
    this.addLog(`${player.name} checks`);
    this.emit('player-action', { playerId: player.id, action: 'check' });
    return { success: true };
  }

  call(player) {
    const toCall = Math.min(this.currentBet - player.bet, player.chips);
    player.chips -= toCall;
    player.bet += toCall;
    player.totalBet += toCall;
    this.pot += toCall;

    if (player.chips === 0) {
      player.allIn = true;
    }

    this.addLog(`${player.name} calls $${toCall}`);
    this.emit('player-action', { playerId: player.id, action: 'call', amount: toCall });
    return { success: true };
  }

  doRaise(player, totalAmount) {
    const raiseBy = totalAmount - player.bet;
    if (raiseBy >= player.chips) {
      return this.doAllIn(player);
    }

    player.chips -= raiseBy;
    player.bet += raiseBy;
    player.totalBet += raiseBy;
    this.pot += raiseBy;
    this.currentBet = player.bet;

    this.addLog(`${player.name} raises to $${player.bet}`);
    this.emit('player-action', { playerId: player.id, action: 'raise', total: player.bet });
    return { success: true, raised: true };
  }

  doAllIn(player) {
    const allInAmount = player.chips;
    player.chips = 0;
    player.bet += allInAmount;
    player.totalBet += allInAmount;
    this.pot += allInAmount;
    player.allIn = true;

    let raised = false;
    if (player.bet > this.currentBet) {
      this.currentBet = player.bet;
      raised = true;
    }

    this.addLog(`${player.name} is ALL-IN for $${player.bet}`);
    this.emit('player-action', { playerId: player.id, action: 'allin', total: player.bet });
    return { success: true, raised };
  }

  advanceAfterAction() {
    // Check if only 1 non-folded player remains
    const nonFolded = this.players.filter(p => !p.folded);
    if (nonFolded.length === 1) {
      this.awardPotToLastPlayer();
      return;
    }

    // Advance to next player in toAct
    this.skipToNextInToAct(true);

    if (this.toAct.size === 0) {
      this.advancePhase();
    } else {
      this.emitToAllPersonalized();
      this.startTurnTimer();
    }
  }

  skipToNextInToAct(advanceFirst = true) {
    if (this.toAct.size === 0) return;
    const n = this.players.length;
    let idx = this.currentPlayerIndex;
    if (advanceFirst) {
      idx = (idx + 1) % n;
    }
    for (let i = 0; i < n; i++) {
      const candidateIndex = (idx + i) % n;
      const candidate = this.players[candidateIndex];
      if (this.toAct.has(candidate.id)) {
        this.currentPlayerIndex = candidateIndex;
        return;
      }
    }
  }

  advancePhase() {
    // Reset round bets
    for (const player of this.players) {
      player.bet = 0;
    }
    this.currentBet = 0;

    // Handle phase transitions
    if (this.state === 'pre-flop') {
      this.deck.pop(); // Burn card
      this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.state = 'flop';
      this.addLog(`--- Flop: ${this.communityCards.map(c => c.rank + c.symbol).join(' ')} ---`);
    } else if (this.state === 'flop') {
      this.deck.pop(); // Burn card
      this.communityCards.push(this.deck.pop());
      this.state = 'turn';
      this.addLog(`--- Turn: ${this.communityCards.map(c => c.rank + c.symbol).join(' ')} ---`);
    } else if (this.state === 'turn') {
      this.deck.pop(); // Burn card
      this.communityCards.push(this.deck.pop());
      this.state = 'river';
      this.addLog(`--- River: ${this.communityCards.map(c => c.rank + c.symbol).join(' ')} ---`);
    } else if (this.state === 'river') {
      this.showdown();
      return;
    }

    // Re-initialize toAct for new phase
    this.toAct = new Set();
    for (const player of this.players) {
      if (!player.folded && !player.allIn) {
        this.toAct.add(player.id);
      }
    }

    // Set first to act from left of dealer
    const n = this.players.length;
    this.currentPlayerIndex = (this.dealerIndex + 1) % n;
    this.skipToNextInToAct(false);

    // If <= 1 player can still bet (all-in situation), run out remaining board cards
    const playersAbleToBet = this.players.filter(p => !p.folded && !p.allIn);
    if (playersAbleToBet.length <= 1) {
      while (this.communityCards.length < 5) {
        this.communityCards.push(this.deck.pop());
      }
      this.emitToAllPersonalized();
      this.nextHandTimer = setTimeout(() => {
        this.showdown();
      }, 1500);
      return;
    }

    this.emitToAllPersonalized();
    if (this.toAct.size > 0) {
      this.startTurnTimer();
    }
  }

  showdown() {
    this.state = 'showdown';
    this.showingShowdown = true;
    this.clearTurnTimer();

    // Evaluate hands for all non-folded players
    for (const player of this.players) {
      if (!player.folded) {
        player.handResult = getBestHand([...player.holeCards, ...this.communityCards]);
      } else {
        player.handResult = null;
      }
    }

    // Calculate and award pots
    const winners = this.awardPots();

    this.showdownData = {
      communityCards: this.communityCards,
      revealedPlayers: this.players.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.holeCards,
        folded: p.folded,
        allIn: p.allIn,
        handResult: p.handResult,
        chips: p.chips
      })),
      winners
    };

    this.emit('showdown', this.showdownData);
    this.emitToAllPersonalized();

    // After 7 seconds: advance dealer, remove busted players, dealHand or end game
    this.nextHandTimer = setTimeout(() => {
      if (this.state === 'showdown') {
        const remaining = this.players.filter(p => p.chips > 0);
        if (remaining.length >= 2) {
          this.dealHand();
        } else {
          this.state = 'waiting';
          const winnerName = remaining[0] ? remaining[0].name : null;
          this.addLog(`Game over! ${winnerName ? winnerName + ' won the game!' : ''}`);
          this.emit('game-over', {
            winner: winnerName,
            message: winnerName ? `${winnerName} won the game!` : 'Game over'
          });
          this.emitToAllPersonalized();
        }
      }
    }, 7000);
  }

  calculateSidePots() {
    const contributions = this.players
      .filter(p => p.totalBet > 0)
      .map(p => ({
        player: p,
        totalBet: p.totalBet,
        folded: p.folded
      }));

    if (contributions.length === 0) return [];

    const betLevels = Array.from(new Set(contributions.map(c => c.totalBet))).sort((a, b) => a - b);
    const pots = [];
    let prevLevel = 0;

    for (const level of betLevels) {
      const potChunk = level - prevLevel;
      if (potChunk <= 0) continue;

      let amount = 0;
      const eligible = [];

      for (const c of contributions) {
        if (c.totalBet > prevLevel) {
          const contributedAtThisLevel = Math.min(c.totalBet - prevLevel, potChunk);
          amount += contributedAtThisLevel;
          if (!c.folded) {
            eligible.push(c.player);
          }
        }
      }

      if (amount > 0) {
        if (eligible.length > 0) {
          pots.push({ amount, eligible });
        } else if (pots.length > 0) {
          // Dead money with no eligible players rolls into the previous pot
          pots[pots.length - 1].amount += amount;
        }
      }

      prevLevel = level;
    }

    return pots;
  }

  awardPots() {
    const pots = this.calculateSidePots();
    const winnersList = [];

    for (let i = 0; i < pots.length; i++) {
      const pot = pots[i];
      if (pot.amount <= 0 || pot.eligible.length === 0) continue;

      let bestHand = null;
      let winningContenders = [];

      for (const contender of pot.eligible) {
        if (!contender.handResult) continue;
        if (!bestHand) {
          bestHand = contender.handResult;
          winningContenders = [contender];
        } else {
          const cmp = compareHands(contender.handResult, bestHand);
          if (cmp > 0) {
            bestHand = contender.handResult;
            winningContenders = [contender];
          } else if (cmp === 0) {
            winningContenders.push(contender);
          }
        }
      }

      if (winningContenders.length > 0) {
        const splitAmount = Math.floor(pot.amount / winningContenders.length);
        let remainder = pot.amount % winningContenders.length;

        for (const winner of winningContenders) {
          const extra = remainder > 0 ? 1 : 0;
          if (remainder > 0) remainder--;
          const totalAward = splitAmount + extra;
          winner.chips += totalAward;

          winnersList.push({
            id: winner.id,
            name: winner.name,
            amount: totalAward,
            handName: winner.handResult ? winner.handResult.name : 'Best Hand',
            potIndex: i
          });

          this.addLog(
            `${winner.name} wins $${totalAward} with ${
              winner.handResult ? winner.handResult.name : 'hand'
            }`
          );
        }
      }
    }

    this.lastWinners = winnersList;
    return winnersList;
  }

  awardPotToLastPlayer() {
    const winner = this.players.find(p => !p.folded);
    if (!winner) return;

    this.clearTurnTimer();
    winner.chips += this.pot;

    this.addLog(`${winner.name} wins the pot of $${this.pot} (everyone else folded)`);
    this.emit('round-winner', {
      winner: { id: winner.id, name: winner.name, chips: winner.chips },
      pot: this.pot
    });

    this.state = 'showdown';
    this.showingShowdown = true;
    this.lastWinners = [
      {
        id: winner.id,
        name: winner.name,
        amount: this.pot,
        handName: 'Everyone folded'
      }
    ];

    this.showdownData = {
      winners: this.lastWinners,
      revealedPlayers: this.players.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.id === winner.id ? p.holeCards : [{ hidden: true }, { hidden: true }],
        folded: p.folded,
        allIn: p.allIn,
        handResult: null,
        chips: p.chips
      }))
    };

    this.emitToAllPersonalized();

    // After 3 seconds, advance and dealHand or end game
    this.nextHandTimer = setTimeout(() => {
      if (this.state === 'showdown') {
        const remaining = this.players.filter(p => p.chips > 0);
        if (remaining.length >= 2) {
          this.dealHand();
        } else {
          this.state = 'waiting';
          this.emit('game-over', {
            winner: remaining[0]?.name,
            message: remaining[0] ? `${remaining[0].name} won the game!` : 'Game over'
          });
          this.emitToAllPersonalized();
        }
      }
    }, 3000);
  }

  startTurnTimer() {
    this.clearTurnTimer();
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.folded || currentPlayer.allIn) return;

    this.turnStartTime = Date.now();
    this.emit('turn-timer', {
      playerId: currentPlayer.id,
      timeoutMs: TURN_TIMEOUT,
      startTime: this.turnStartTime
    });

    // If CPU Bot, take intelligent natural move after brief think time
    if (currentPlayer.isBot) {
      this.turnTimer = setTimeout(() => {
        this.makeBotMove(currentPlayer);
      }, 900 + Math.random() * 600);
      return;
    }

    // If disconnected player, auto-fold after 500ms
    if (!currentPlayer.connected) {
      this.turnTimer = setTimeout(() => {
        this.handleTimeout(currentPlayer.id);
      }, 500);
      return;
    }

    this.turnTimer = setTimeout(() => {
      this.handleTimeout(currentPlayer.id);
    }, TURN_TIMEOUT);
  }

  handleTimeout(playerId) {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId) return;

    if (currentPlayer.bet === this.currentBet) {
      this.handleAction(playerId, 'check', 0);
    } else {
      this.handleAction(playerId, 'fold', 0);
    }
  }

  makeBotMove(bot) {
    if (this.currentPlayerIndex === -1 || !this.players[this.currentPlayerIndex] || this.players[this.currentPlayerIndex].id !== bot.id) return;
    if (bot.folded || bot.allIn) return;

    const toCall = this.currentBet - bot.bet;
    if (toCall === 0) {
      // 80% check, 20% small raise
      if (Math.random() < 0.2 && bot.chips >= this.bigBlind * 2) {
        this.handleAction(bot.id, 'raise', this.bigBlind * 2);
      } else {
        this.handleAction(bot.id, 'check', 0);
      }
    } else {
      // Call or Fold based on pot odds
      const potRatio = toCall / Math.max(1, this.pot);
      if (potRatio < 0.35 || Math.random() < 0.75) {
        this.handleAction(bot.id, 'call', 0);
      } else {
        this.handleAction(bot.id, 'fold', 0);
      }
    }

    if (this.io) {
      for (const p of this.players) {
        const sock = this.io.sockets.sockets.get(p.id);
        if (sock) sock.emit('game-state', this.getStateForPlayer(p.id));
      }
    }
  }

  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnStartTime = null;
  }

  clearTimer() {
    this.clearTurnTimer();
    if (this.nextHandTimer) {
      clearTimeout(this.nextHandTimer);
      this.nextHandTimer = null;
    }
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      state: this.state,
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id || null,
      dealerIndex: this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      handNumber: this.handNumber,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        connected: p.connected,
        seatIndex: p.seatIndex,
        holeCards: p.holeCards.map(() => ({ hidden: true })),
        handResult: this.showingShowdown ? p.handResult : null
      })),
      log: this.log.slice(-15),
      maxPlayers: this.maxPlayers,
      startingChips: this.startingChips,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      turnStartTime: this.turnStartTime,
      turnTimeout: TURN_TIMEOUT,
      showdownData: this.showdownData
    };
  }

  getStateForPlayer(playerId) {
    const baseState = this.getPublicState();
    const hostPlayer = (this.hostName ? this.players.find(p => p.name && p.name.toLowerCase() === this.hostName.toLowerCase()) : null) || this.players[0];
    const hostId = hostPlayer ? hostPlayer.id : null;
    baseState.isHost = hostId ? (hostId === playerId) : false;
    baseState.hostId = hostId;
    baseState.hostName = hostPlayer ? hostPlayer.name : null;

    baseState.players = this.players.map(p => {
      const isMe = p.id === playerId;
      const isThisHost = hostPlayer ? (p.id === hostPlayer.id) : false;
      return {
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        connected: p.connected,
        isBot: p.isBot || false,
        seatIndex: p.seatIndex,
        isHost: isThisHost,
        holeCards:
          isMe || this.showingShowdown
            ? p.holeCards
            : p.holeCards.map(() => ({ hidden: true })),
        handResult: isMe || this.showingShowdown ? p.handResult : null
      };
    });
    return baseState;
  }

  emitToAllPersonalized() {
    if (!this.io) return;
    for (const player of this.players) {
      const sock = this.io.sockets.sockets.get(player.id);
      if (sock) {
        sock.emit('game-state', this.getStateForPlayer(player.id));
      }
    }
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 30) {
      this.log.shift();
    }
    this.emit('log-update', { log: this.log.slice(-15) });
  }

  emit(event, data) {
    if (this.io) {
      this.io.to(this.roomId).emit(event, data);
    }
  }
}

module.exports = PokerGame;
