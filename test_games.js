const assert = require('assert');
const ImposterGame = require('./server/games/imposter/game');
const WavelengthGame = require('./server/games/wavelength/game');
const PokerGame = require('./server/games/poker/game');
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

// Add 3 players
imposter.addPlayer('s1', 'Alice');
imposter.addPlayer('s2', 'Bob');
imposter.addPlayer('s3', 'Charlie');
assert.strictEqual(imposter.players.length, 3);
assert.strictEqual(imposter.canStart(), true);

// Start game
const started = imposter.startGame();
assert.strictEqual(started, true);
assert.strictEqual(imposter.state, 'revealing');

// Check roles: exactly 1 imposter and 2 civilians
const imposters = imposter.players.filter(p => p.isImposter);
const civilians = imposter.players.filter(p => !p.isImposter);
assert.strictEqual(imposters.length, 1, 'Should have 1 imposter for 3 players');
assert.strictEqual(civilians.length, 2, 'Should have 2 civilians');

// Anti-cheat verification: getStateForPlayer must NOT reveal role of other players
const aliceState = imposter.getStateForPlayer('s1');
assert.strictEqual(aliceState.revealedWords, null, 'Words should not be revealed during game');
for (const p of aliceState.players) {
  assert.strictEqual(p.isImposter, undefined, 'Player roles must be hidden in public list');
  assert.strictEqual(p.word, undefined, 'Player words must be hidden in public list');
}
console.log('  ✓ Roles and secret words anti-cheat verification passed');

// Players ready
imposter.playerReady('s1');
imposter.playerReady('s2');
imposter.playerReady('s3');
assert.strictEqual(imposter.state, 'clues', 'Should transition to clues after all players ready');

// Clues phase
const activeTurnId = imposter.getCurrentTurnPlayerId();
assert(activeTurnId, 'Must have active turn player');
const clueRes = imposter.submitClue(activeTurnId, 'Sweet and warm');
assert.strictEqual(clueRes.success, true);
assert.strictEqual(imposter.clues.length, 1);
console.log('  ✓ Clue phase and timeline tracking verified');

// Discussion phase
imposter.startDiscussionPhase();
assert.strictEqual(imposter.state, 'discussion');

// Voting phase
imposter.startVotingPhase();
assert.strictEqual(imposter.state, 'voting');

const imposterPlayer = imposters[0];
// Both civilians vote for the imposter
civilians.forEach(c => {
  imposter.castVote(c.id, imposterPlayer.id);
});
// Imposter votes for a civilian
imposter.castVote(imposterPlayer.id, civilians[0].id);

// Should auto-tally since all players voted
assert.strictEqual(imposter.state, 'vote_result');
assert(imposter.lastVoteResult.eliminatedPlayer, 'An elimination must have occurred');
assert.strictEqual(imposter.lastVoteResult.eliminatedPlayer.id, imposterPlayer.id);
assert.strictEqual(imposter.lastVoteResult.eliminatedPlayer.isImposter, true);
console.log(`  ✓ Imposter was accused and eliminated! Elimination result: ${imposter.lastVoteResult.eliminatedPlayer.name}`);

// Imposter Steal Guess check
imposter.state = 'imposter_guess';
const stealRes = imposter.submitImposterGuess(imposterPlayer.id, imposter.civilianWord);
assert.strictEqual(stealRes.success, true);
assert.strictEqual(imposter.winner, 'imposters', 'Correct guess must steal the victory');
assert.strictEqual(imposter.state, 'game_over');
console.log('  ✓ Imposter steal guess mechanism verified');

// ==========================================
// Test 3: Wavelength Cards & Deck
// ==========================================
console.log('\nTest 3: Wavelength Spectrum Deck');
const specCard = getRandomSpectrumCard();
assert(specCard.left, 'Left concept must exist');
assert(specCard.right, 'Right concept must exist');
console.log(`  ✓ Sample spectrum: "${specCard.left}" <---> "${specCard.right}"`);

// ==========================================
// Test 4: Wavelength Game Mechanics (Co-op)
// ==========================================
console.log('\nTest 4: Wavelength Co-op Game Engine');
const waveCoop = new WavelengthGame('WAVCOOP', { mode: 'coop', totalRounds: 5 });
assert.strictEqual(waveCoop.gameType, 'wavelength');
waveCoop.addPlayer('w1', 'Alex');
waveCoop.addPlayer('w2', 'Taylor');
assert.strictEqual(waveCoop.canStart(), true);

waveCoop.startGame();
assert.strictEqual(waveCoop.state, 'psychic_clue');
assert(waveCoop.currentPsychicId, 'Must assign psychic');

// Target anti-cheat test
const psychicState = waveCoop.getStateForPlayer(waveCoop.currentPsychicId);
assert.strictEqual(typeof psychicState.target, 'number', 'Psychic must see the target');
const guesserId = waveCoop.currentPsychicId === 'w1' ? 'w2' : 'w1';
const guesserState = waveCoop.getStateForPlayer(guesserId);
assert.strictEqual(guesserState.target, null, 'Guesser must NOT see target');
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
// Test 6: Poker Compatibility Check
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

console.log('\n🎉 ALL 6 TEST SUITES PASSED FLAWLESSLY!');
imposter.clearTimer();
waveCoop.clearTimer();
waveTeams.clearTimer();
poker.clearTurnTimer();
process.exit(0);
