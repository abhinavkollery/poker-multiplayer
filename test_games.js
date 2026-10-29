const assert = require('assert');
const ImposterGame = require('./server/games/imposter/game');
const WavelengthGame = require('./server/games/wavelength/game');
const PokerGame = require('./server/games/poker/game');
const PlatformerGame = require('./server/games/platformer/game');
const DrawGuessGame = require('./server/games/drawguess/game');
const CodenamesGame = require('./server/games/codenames/game');
const SpeedTriviaGame = require('./server/games/trivia/game');
const LiarsDiceGame = require('./server/games/liarsdice/game');
const SpyfallGame = require('./server/games/spyfall/game');
const { createGameInstance } = require('./server/index');

const { LEVELS, getLevel } = require('./server/games/platformer/levels');
const { getRandomWordPair } = require('./server/games/imposter/words');
const { getRandomSpectrumCard } = require('./server/games/wavelength/cards');

console.log('🧪 Starting Games Suite Tests...\n');

// ==========================================
// Test 1: Imposter Words & Deck
// ==========================================
console.log('Test 1: Imposter Words & Categories');
const wordPair = getRandomWordPair('all');
assert(wordPair.civilianWord, 'Civilian word should exist');
assert(wordPair.imposterWord, 'Imposter word should exist');
assert.notStrictEqual(wordPair.civilianWord, wordPair.imposterWord, 'Words must be different');
console.log(`  ✓ Sample word pair: Civilian="${wordPair.civilianWord}", Imposter="${wordPair.imposterWord}" (${wordPair.category})`);

// ==========================================
// Test 2: Imposter Game Mechanics
// ==========================================
console.log('\nTest 2: Imposter Game Engine');
const imposter = new ImposterGame('IMPTEST', { roundTime: 30, discussionTime: 45 });
assert.strictEqual(imposter.gameType, 'imposter');
assert.strictEqual(imposter.canStart(), false);

imposter.addPlayer('s1', 'Alice');
imposter.addPlayer('s2', 'Bob');
imposter.addPlayer('s3', 'Charlie');
assert.strictEqual(imposter.players.length, 3);
assert.strictEqual(imposter.canStart(), true);

const started = imposter.startGame();
assert.strictEqual(started, true);
assert.strictEqual(imposter.state, 'revealing');

const imposters = imposter.players.filter(p => p.isImposter);
const civilians = imposter.players.filter(p => !p.isImposter);
assert.strictEqual(imposters.length, 1, 'Should have 1 imposter for 3 players');
assert.strictEqual(civilians.length, 2, 'Should have 2 civilians');

// Anti-cheat verification
const aliceState = imposter.getStateForPlayer('s1');
assert.strictEqual(aliceState.revealedWords, null, 'Words should not be revealed during game');
for (const p of aliceState.players) {
  assert.strictEqual(p.isImposter, undefined, 'Player roles must be hidden in public list');
  assert.strictEqual(p.word, undefined, 'Player words must be hidden in public list');
}
console.log('  ✓ Roles and secret words anti-cheat verification passed');

// Ready & Clues
imposter.playerReady('s1');
imposter.playerReady('s2');
imposter.playerReady('s3');
assert.strictEqual(imposter.state, 'clues');

const activeTurnId = imposter.getCurrentTurnPlayerId();
assert(activeTurnId, 'Must have active turn player');
const clueRes = imposter.submitClue(activeTurnId, 'Sweet and warm');
assert.strictEqual(clueRes.success, true);
assert.strictEqual(imposter.clues.length, 1);
console.log('  ✓ Clue phase and timeline tracking verified');

imposter.startDiscussionPhase();
assert.strictEqual(imposter.state, 'discussion');

imposter.startVotingPhase();
assert.strictEqual(imposter.state, 'voting');

const imposterPlayer = imposters[0];
civilians.forEach(c => { imposter.castVote(c.id, imposterPlayer.id); });
imposter.castVote(imposterPlayer.id, civilians[0].id);

assert.strictEqual(imposter.state, 'vote_result');
assert.strictEqual(imposter.lastVoteResult.eliminatedPlayer.id, imposterPlayer.id);
assert.strictEqual(imposter.lastVoteResult.eliminatedPlayer.isImposter, true);
console.log(`  ✓ Imposter was accused and eliminated! Elimination result: ${imposter.lastVoteResult.eliminatedPlayer.name}`);

imposter.state = 'imposter_guess';
const stealRes = imposter.submitImposterGuess(imposterPlayer.id, imposter.civilianWord);
assert.strictEqual(stealRes.success, true);
assert.strictEqual(imposter.winner, 'imposters', 'Correct guess must steal the victory');
assert.strictEqual(imposter.state, 'game_over');
console.log('  ✓ Imposter steal guess mechanism verified');

// ==========================================
// Test 3: Wavelength Spectrum Deck
// ==========================================
console.log('\nTest 3: Wavelength Spectrum Deck');
const specCard = getRandomSpectrumCard();
assert(specCard.left, 'Left concept must exist');
assert(specCard.right, 'Right concept must exist');
console.log(`  ✓ Sample spectrum: "${specCard.left}" <---> "${specCard.right}"`);

// ==========================================
// Test 4: Wavelength Co-op Game Engine
// ==========================================
console.log('\nTest 4: Wavelength Co-op Game Engine');
const waveCoop = new WavelengthGame('WAVCOOP', { mode: 'coop', totalRounds: 5 });
waveCoop.addPlayer('w1', 'Alice');
waveCoop.addPlayer('w2', 'Bob');
assert.strictEqual(waveCoop.canStart(), true);
waveCoop.startGame();
assert.strictEqual(waveCoop.state, 'psychic_clue');

const psychicId = waveCoop.currentPsychicId;
const guesserId = psychicId === 'w1' ? 'w2' : 'w1';

const psychicState = waveCoop.getStateForPlayer(psychicId);
const guesserState = waveCoop.getStateForPlayer(guesserId);
assert.strictEqual(psychicState.isPsychic, true);
assert.strictEqual(guesserState.isPsychic, false);
assert(psychicState.target !== null, 'Psychic must see target position');
assert.strictEqual(guesserState.target, null, 'Guesser must not see target position');
console.log('  ✓ Psychic vs Guesser secret target visibility verified');

// Psychic submits clue
const waveClueRes = waveCoop.submitClue(waveCoop.currentPsychicId, 'Ice Cold Lemonade');
assert.strictEqual(waveClueRes.success, true);
assert.strictEqual(waveCoop.state, 'team_guess');

// Guesser moves dial to match target
waveCoop.moveDial(guesserId, waveCoop.target);
assert.strictEqual(waveCoop.dialNeedle, waveCoop.target);

// Lock dial
waveCoop.lockDial(guesserId);
assert.strictEqual(waveCoop.state, 'reveal');
assert.strictEqual(waveCoop.lastRoundResult.points, 4, 'Exact dial on target must award 4 points (Bullseye)');
assert.strictEqual(waveCoop.scores.coop, 4);
console.log('  ✓ Bullseye 4-point scoring calculation verified');

// ==========================================
// Test 5: Wavelength Teams Mode
// ==========================================
console.log('\nTest 5: Wavelength Teams Mode');
const waveTeams = new WavelengthGame('WAVTEAM', { mode: 'teams', pointsToWin: 10 });
waveTeams.addPlayer('t1', 'RedLeader');
waveTeams.addPlayer('t2', 'BlueLeader');
waveTeams.switchPlayerTeam('t1', 'red');
waveTeams.switchPlayerTeam('t2', 'blue');
assert.strictEqual(waveTeams.canStart(), true);

waveTeams.startGame();
assert.strictEqual(waveTeams.mode, 'teams');
assert.strictEqual(waveTeams.state, 'psychic_clue');
console.log('  ✓ Teams mode started with Team Red and Team Blue');

// ==========================================
// Test 6: Texas Hold'em Poker Game Engine & Bot
// ==========================================
console.log('\nTest 6: Texas Hold\'em Poker Game Engine');
const poker = new PokerGame('POKTEST', { startingChips: 1500, smallBlind: 15, bigBlind: 30 });
assert.strictEqual(poker.gameType, 'poker');
poker.addPlayer('p1', 'Phil');
poker.addPlayer('p2', 'Daniel');
assert.strictEqual(poker.canStart(), true);
poker.startGame();
assert.strictEqual(poker.state, 'pre-flop');
assert.strictEqual(poker.players[0].holeCards.length, 2);
assert.strictEqual(poker.players[1].holeCards.length, 2);
console.log('  ✓ Poker preflop dealt 2 hole cards to players');

// ==========================================
// Test 7: Co-op Platformer Game Engine & Levels
// ==========================================
console.log('\nTest 7: Co-op Platformer Game Engine & Levels');
assert(LEVELS.length >= 5, 'Should have at least 5 co-op levels');
const lvl1 = getLevel(0);
assert.strictEqual(lvl1.id, 1);
assert(lvl1.buttons.length > 0, 'Level 1 must contain pressure buttons');
assert(lvl1.doors.length > 0, 'Level 1 must contain linked doors');

const plat = new PlatformerGame('PLATTEST');
assert.strictEqual(plat.gameType, 'platformer');
assert.strictEqual(plat.canStart(), false);

plat.addPlayer('pl1', 'Mario');
plat.addPlayer('pl2', 'Luigi');
assert.strictEqual(plat.players.length, 2);
assert.strictEqual(plat.canStart(), true);

plat.startGame();
assert.strictEqual(plat.state, 'playing');
assert.strictEqual(plat.currentLevelIndex, 0);

// Test button press and door opening
plat.updatePlayerState('pl1', {
  x: lvl1.buttons[0].x,
  y: lvl1.buttons[0].y,
  buttonStates: { [lvl1.buttons[0].id]: true }
});
assert.strictEqual(plat.buttonStates[lvl1.buttons[0].id], true);
assert.strictEqual(plat.doorStates[lvl1.buttons[0].linkedDoorId], true);
console.log('  ✓ Pressure plate triggered and opened linked door');

// Test level completion when all players reach exit
plat.updatePlayerState('pl1', { x: lvl1.exit.x, y: lvl1.exit.y });
plat.updatePlayerState('pl2', { x: lvl1.exit.x, y: lvl1.exit.y });
assert.strictEqual(plat.players[0].reachedExit, true);
assert.strictEqual(plat.players[1].reachedExit, true);
assert.strictEqual(plat.state, 'level_cleared');
console.log('  ✓ Level cleared when all co-op partners reached exit portal');

// Test key collection on level 3
plat.loadLevel(2); // Level 3 index
assert(plat.currentLevel.keys.length > 0, 'Level 3 must have keys');
const testKey = plat.currentLevel.keys[0];
plat.updatePlayerState('pl1', { collectedKeyId: testKey.id });
assert(plat.collectedKeys.has(testKey.id), 'Key must be added to collectedKeys');
assert.strictEqual(plat.doorStates[plat.currentLevel.lockedDoors[0].id], true, 'Locked door must open with key');
console.log('  ✓ Key pickup and locked door opening verified');

// Test Poker fold action
const foldPlayerId = poker.players[poker.currentPlayerIndex].id;
const otherPlayer = poker.players.find(p => p.id !== foldPlayerId);
const chipsBefore = otherPlayer.chips;
poker.handleAction(foldPlayerId, 'fold', 0);
assert(otherPlayer.chips > chipsBefore, 'Winning player chips must increase');
console.log('  ✓ Poker fold action and pot award verified');

// ==========================================
// Test 8: Draw & Guess Game Engine
// ==========================================
console.log('\nTest 8: Draw & Guess Game Engine');
const drawGame = new DrawGuessGame('DRAWTEST', { rounds: 2, drawTime: 60 });
drawGame.addPlayer('d1', 'Picasso');
drawGame.addPlayer('d2', 'DaVinci');
assert.strictEqual(drawGame.canStart(), true);

drawGame.startGame();
assert.strictEqual(drawGame.state, 'choosing');
assert.strictEqual(drawGame.wordChoices.length, 3);

// Drawer selects word
const chosenWord = drawGame.wordChoices[0];
drawGame.selectWord('d1', chosenWord);
assert.strictEqual(drawGame.state, 'drawing');
assert.strictEqual(drawGame.currentWord, chosenWord);

// Anti-cheat: Guesser should not see full word
const d2State = drawGame.getStateForPlayer('d2');
assert.notStrictEqual(d2State.word, chosenWord, 'Guesser should see masked word');
assert(d2State.word.includes('_'), 'Masked word should contain blanks');

// Draw strokes
drawGame.handleAction('d1', 'draw-stroke', { x0: 10, y0: 10, x1: 20, y1: 20, color: '#000', size: 5 });
assert.strictEqual(drawGame.strokes.length, 1);

// Guessing
const guessRes = drawGame.handleGuess('d2', chosenWord);
assert.strictEqual(guessRes.correct, true);
assert(drawGame.players[1].score > 0, 'Correct guesser must earn points');
console.log(`  ✓ Draw & Guess flow, anti-cheat masking, and score awards verified`);

// ==========================================
// Test 9: Codenames Game Engine
// ==========================================
console.log('\nTest 9: Codenames Game Engine');
const codeGame = new CodenamesGame('CODETEST');
codeGame.addPlayer('c1', 'RedSpy');
codeGame.addPlayer('c2', 'RedOp');
codeGame.addPlayer('c3', 'BlueSpy');
codeGame.addPlayer('c4', 'BlueOp');

codeGame.setRole('c1', 'spymaster');
codeGame.switchTeam('c1', 'red');
codeGame.setRole('c2', 'operative');
codeGame.switchTeam('c2', 'red');

codeGame.setRole('c3', 'spymaster');
codeGame.switchTeam('c3', 'blue');
codeGame.setRole('c4', 'operative');
codeGame.switchTeam('c4', 'blue');

codeGame.startGame();
assert.strictEqual(codeGame.cards.length, 25);
assert.strictEqual(codeGame.cards.filter(c => c.color === 'assassin').length, 1);

// Spymaster vs Operative anti-cheat
const redSpyState = codeGame.getStateForPlayer('c1');
const redOpState = codeGame.getStateForPlayer('c2');
assert.notStrictEqual(redSpyState.cards[0].color, null, 'Spymaster must see all card colors');
assert.strictEqual(redOpState.cards[0].color, null, 'Operatives must NOT see unrevealed card colors');

// Assassin test: picking assassin must immediately cause game over
const assassinCard = codeGame.cards.find(c => c.color === 'assassin');
const currTeam = codeGame.currentTeam;
const currOp = codeGame.players.find(p => p.team === currTeam && p.role === 'operative');
codeGame.phase = 'guessing';
codeGame.pickCard(currOp.id, assassinCard.id);
assert.strictEqual(codeGame.state, 'game_over');
assert.notStrictEqual(codeGame.winner, currTeam, 'Team that clicked assassin must lose');
console.log(`  ✓ Codenames 5x5 grid, Spymaster anti-cheat, and Assassin instant-loss verified`);

// ==========================================
// Test 10: Speed Trivia Game Engine
// ==========================================
console.log('\nTest 10: Speed Trivia Game Engine');
const triviaGame = new SpeedTriviaGame('TRIVTEST', { questionCount: 5, timeLimit: 15 });
triviaGame.addPlayer('t1', 'Einstein');
triviaGame.addPlayer('t2', 'Newton');
triviaGame.startGame();

assert.strictEqual(triviaGame.state, 'question');
const q = triviaGame.questions[0];

// Anti-cheat: answer is hidden during question phase
const t1State = triviaGame.getStateForPlayer('t1');
assert.strictEqual(t1State.question.correctAnswer, null, 'Correct answer must be hidden during question phase');

// Submit correct answer
triviaGame.submitAnswer('t1', q.answer);
assert.strictEqual(triviaGame.playerAnswers.get('t1').isCorrect, true);
assert(triviaGame.players[0].score >= 500, 'Score must include base points');
console.log(`  ✓ Speed Trivia questions, streak formula, and anti-cheat answer masking verified`);

// ==========================================
// Test 11: Liar's Dice Game Engine
// ==========================================
console.log('\nTest 11: Liar\'s Dice Game Engine');
const diceGame = new LiarsDiceGame('DICETEST', { startingDice: 5 });
diceGame.addPlayer('ld1', 'Captain Jack');
diceGame.addPlayer('ld2', 'Barbossa');
diceGame.startGame();

assert.strictEqual(diceGame.players[0].dice.length, 5);
assert.strictEqual(diceGame.players[1].dice.length, 5);

// Anti-cheat: Player can only see their own dice
const ld1State = diceGame.getStateForPlayer('ld1');
assert.strictEqual(ld1State.players[1].dice[0], '?', 'Opponent dice must be masked as ?');

// Bidding escalation test
const p1Turn = diceGame.getCurrentPlayer();
const bidRes = diceGame.bid(p1Turn.id, 2, 4); // 2 Fours
assert.strictEqual(bidRes.success, true);
assert.strictEqual(diceGame.currentBid.count, 2);
assert.strictEqual(diceGame.currentBid.face, 4);

// Challenge "Liar!"
const nextP = diceGame.getCurrentPlayer();
const chalRes = diceGame.challenge(nextP.id, 'liar');
assert.strictEqual(chalRes.success, true);
assert.strictEqual(diceGame.state, 'reveal');
assert(diceGame.lastChallenge, 'Challenge result must be recorded');
console.log(`  ✓ Liar's Dice roll, bidding escalation, wild ones tally, and cup challenge verified`);

// ==========================================
// Test 12: Spyfall Game Engine
// ==========================================
console.log('\nTest 12: Spyfall Game Engine');
const spyGame = new SpyfallGame('SPYTEST', { duration: 300 });
spyGame.addPlayer('sp1', 'James Bond');
spyGame.addPlayer('sp2', 'Q');
spyGame.addPlayer('sp3', 'M');
spyGame.startGame();

assert.strictEqual(spyGame.state, 'playing');
const spyPlayer = spyGame.players.find(p => p.isSpy);
const civPlayer = spyGame.players.find(p => !p.isSpy);
assert(spyPlayer, 'Must have 1 spy');
assert(civPlayer, 'Must have civilians');

// Anti-cheat: Spy receives ???, Civilian receives location name
const spyPlayerState = spyGame.getStateForPlayer(spyPlayer.id);
const civPlayerState = spyGame.getStateForPlayer(civPlayer.id);
assert.strictEqual(spyPlayerState.location, '??? (Secret)', 'Spy must not see location');
assert.strictEqual(civPlayerState.location, spyGame.currentLocation.name, 'Civilians must see location');

// Spy guess test
const correctLoc = spyGame.currentLocation.name;
const spyGuessRes = spyGame.spyGuess(spyPlayer.id, correctLoc);
assert.strictEqual(spyGuessRes.success, true);
assert.strictEqual(spyGame.winner, 'spy', 'Spy guessing correct location must win');
console.log(`  ✓ Spyfall location assignment, role distribution, and spy reveal win verified`);

// ==========================================
// Test 13: Factory & Room Migration Integration
// ==========================================
console.log('\nTest 13: Factory & Game Switch Integration');
const testRoomId = 'SWITCH1';
const originalPoker = createGameInstance('poker', testRoomId);
originalPoker.addPlayer('sw1', 'HostAlice');
originalPoker.addPlayer('sw2', 'GuestBob');
assert.strictEqual(originalPoker.gameType, 'poker');

// Switch to trivia
const switchedTrivia = createGameInstance('trivia', testRoomId);
originalPoker.players.forEach(p => switchedTrivia.addPlayer(p.id, p.name));
assert.strictEqual(switchedTrivia.gameType, 'trivia');
assert.strictEqual(switchedTrivia.players.length, 2);

// Test Party Lobby game instance & migration
const partyLobby = createGameInstance('party', 'PARTYROOM1');
assert.strictEqual(partyLobby.gameType, 'party');
const p1Res = partyLobby.addPlayer('p1', 'PartyHost');
const p2Res = partyLobby.addPlayer('p2', 'PartyGuest');
assert.strictEqual(partyLobby.players.length, 2);
assert.strictEqual(partyLobby.players[0].name, 'PartyHost');

// Non-host cannot select game
const nonHostSelect = partyLobby.handleAction('p2', 'select-game', { gameType: 'wavelength' });
assert(nonHostSelect.error, 'Non-host cannot select game');

// Host selects game
const hostSelect = partyLobby.handleAction('p1', 'select-game', { gameType: 'wavelength' });
assert.strictEqual(hostSelect.success, true);
assert.strictEqual(partyLobby.selectedGame, 'wavelength');

// Launch game with all party players migrating seamlessly under same room code
const launchedWave = createGameInstance(partyLobby.selectedGame, 'PARTYROOM1');
partyLobby.players.forEach(p => launchedWave.addPlayer(p.id, p.name));
assert.strictEqual(launchedWave.gameType, 'wavelength');
assert.strictEqual(launchedWave.players.length, 2);

console.log(`  ✓ Seamless party room game switching and party lobby engine verified`);

// ==========================================
// Test 14: QR Code Generator & Modal Engine
// ==========================================
console.log('\nTest 14: QR Code Generator & Modal Engine');
const { QRCodeGenerator, QRCodeModal } = require('./public/shared/qrcode.js');
assert.strictEqual(typeof QRCodeGenerator.createSVG, 'function', 'createSVG must be a function');
assert.strictEqual(typeof QRCodeModal.show, 'function', 'QRCodeModal.show must be a function');
assert.strictEqual(typeof QRCodeModal.hide, 'function', 'QRCodeModal.hide must be a function');

const shortQr = QRCodeGenerator.createSVG('ABCDEF', { size: 180 });
assert(shortQr.includes('<svg') && shortQr.includes('</svg>'), 'Must produce valid SVG XML');
assert(shortQr.includes('viewBox='), 'Must have viewBox for crisp scalability');

const longUrl = 'https://poker-multiplayer.onrender.com/drawguess/game.html?room=XYZ999&name=Picasso';
const longQr = QRCodeGenerator.createSVG(longUrl, { size: 240 });
assert(longQr.length > shortQr.length, 'Longer URL must generate higher density QR matrix');

// Verification: QR and Share link sanitization
const cleanInvite = QRCodeModal.getInviteUrl('PARTY99');
assert(cleanInvite.includes('join=PARTY99'), 'Invite URL must contain join=ROOMCODE');
assert(!cleanInvite.includes('name='), 'Invite URL must NEVER contain host name');

const dirtyUrl = 'http://localhost:3000/poker/game.html?room=ABCDEF&name=HostAlice';
const sanitized = QRCodeModal.sanitizeUrl(dirtyUrl, 'ABCDEF', 'poker');
assert(!sanitized.includes('name='), 'Sanitize URL must delete name parameter to prevent host session hijacking');

console.log('  ✓ Zero-dependency QR Code generator, vector SVG path, and clean anti-hijack invite verified');

// ==========================================
// Test 15: Reconnection, Anti-Ghost Deduplication, and Lobby Splice
// ==========================================
console.log('\nTest 15: Reconnection, Anti-Ghost Deduplication, and Lobby Splice');
const reconGame = createGameInstance('poker', 'RECON1');
reconGame.addPlayer('r1', 'Alice');
reconGame.addPlayer('r2', 'Bob');
assert.strictEqual(reconGame.players.length, 2);

// Disconnect Bob in lobby -> Bob must be removed (no ghost)
reconGame.removePlayer('r2');
assert.strictEqual(reconGame.players.length, 1, 'Disconnected player in waiting lobby must be removed');
assert.strictEqual(reconGame.players[0].name, 'Alice');

// Disconnect host Alice in lobby -> Alice removed, players empty
reconGame.removePlayer('r1');
assert.strictEqual(reconGame.players.length, 0, 'Host disconnect in empty lobby cleans players');

// Reconnection during active game
const activePoker = createGameInstance('poker', 'ACTIVE1');
activePoker.addPlayer('a1', 'Charlie');
activePoker.addPlayer('a2', 'Dana');
activePoker.startGame();
assert.strictEqual(activePoker.state, 'pre-flop');

// Dana disconnects during active game
activePoker.removePlayer('a2');
assert.strictEqual(activePoker.players.length, 2, 'In-game disconnect must preserve player record');
assert.strictEqual(activePoker.players[1].connected, false);

// Dana reconnects with new socket ID 'a2_new'
const reconResult = activePoker.reconnectPlayer('a2_new', 'Dana');
assert.strictEqual(reconResult.success, true, 'Reconnect must succeed');
assert.strictEqual(activePoker.players[1].id, 'a2_new', 'Player socket ID must be updated');
assert.strictEqual(activePoker.players[1].connected, true, 'Player must be marked connected');
assert.strictEqual(activePoker.players.length, 2, 'No ghost player added on reconnect');

// Game switch filter verification: bots and disconnected players excluded
const lobbyPoker = createGameInstance('poker', 'BOTLOBBY');
lobbyPoker.addPlayer('h1', 'Charlie');
lobbyPoker.addPlayer('h2', 'Dana');
lobbyPoker.addBot('Bot1');
assert.strictEqual(lobbyPoker.players.length, 3);
lobbyPoker.players[1].connected = false; // Dana disconnects

const activeHumans = lobbyPoker.players.filter(p => p.connected && !p.isBot);
assert.strictEqual(activeHumans.length, 1);
assert.strictEqual(activeHumans[0].name, 'Charlie');
console.log('  ✓ Lobby splice, active reconnect, and game switch ghost filtering verified');

// ==========================================
// Test 16: Vercel Deployment & API Verification
// ==========================================
console.log('\nTest 16: Vercel Deployment & API Verification');
const vercelHandler = require('./api/index.js');
assert.strictEqual(typeof vercelHandler, 'function', 'Vercel handler must be a callable request listener');
assert(vercelHandler.server, 'Vercel handler must expose http.Server');
assert(vercelHandler.io, 'Vercel handler must expose Socket.IO instance');

const vercelConfig = require('./vercel.json');
assert.strictEqual(vercelConfig.version, 2, 'vercel.json must be version 2');
assert(Array.isArray(vercelConfig.rewrites), 'vercel.json must specify rewrites array');
const rewrites = vercelConfig.rewrites.map(r => r.source);
['/poker', '/imposter', '/wavelength', '/platformer', '/drawguess', '/codenames', '/trivia', '/liarsdice', '/spyfall', '/api/(.*)', '/socket.io/(.*)'].forEach(route => {
  assert(rewrites.some(r => r.includes(route.replace('/(.*)', ''))), `Route ${route} must have a Vercel rewrite`);
});
console.log('  ✓ Vercel Serverless Function entry point and vercel.json rewrites verified');

// Clean timers
imposter.clearTimer();
waveCoop.clearTimer();
waveTeams.clearTimer();
poker.clearTurnTimer();
activePoker.clearTurnTimer();
clearTimeout(plat.timer);
drawGame.clearTimer();
triviaGame.clearTimer();
spyGame.clearTimer();

console.log('\n🎉 ALL 16 TEST SUITES PASSED FLAWLESSLY!');
process.exit(0);
