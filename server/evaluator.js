/**
 * Poker hand evaluator
 */

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const head = arr[0];
  const tail = arr.slice(1);
  const withHead = getCombinations(tail, k - 1).map(combo => [head, ...combo]);
  const withoutHead = getCombinations(tail, k);
  return [...withHead, ...withoutHead];
}

/**
 * Evaluates a 5-card hand
 * @param {Array} cards - Array of 5 card objects {suit, rank, value}
 * @returns {Object} { rank: 0-8, name: string, tiebreakers: number[] }
 */
function evaluate5(cards) {
  if (!cards || cards.length !== 5) {
    throw new Error('evaluate5 requires exactly 5 cards');
  }

  // Sort descending by rank value
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const vals = sorted.map(c => c.value);

  // Check flush (all suits identical)
  const isFlush = cards.every(c => c.suit === cards[0].suit);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  if (
    vals[0] - 1 === vals[1] &&
    vals[1] - 1 === vals[2] &&
    vals[2] - 1 === vals[3] &&
    vals[3] - 1 === vals[4]
  ) {
    isStraight = true;
    straightHigh = vals[0];
  } else if (
    vals[0] === 14 &&
    vals[1] === 5 &&
    vals[2] === 4 &&
    vals[3] === 3 &&
    vals[4] === 2
  ) {
    // Ace-low straight (Wheel: A-2-3-4-5)
    isStraight = true;
    straightHigh = 5;
  }

  // Count rank frequencies
  const countsMap = {};
  for (const v of vals) {
    countsMap[v] = (countsMap[v] || 0) + 1;
  }

  // Group by count descending, then value descending
  const groups = Object.keys(countsMap)
    .map(valStr => ({
      value: Number(valStr),
      count: countsMap[valStr]
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  // 1. Straight Flush / Royal Flush (rank 8)
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        rank: 8,
        name: 'Royal Flush',
        tiebreakers: [14]
      };
    }
    return {
      rank: 8,
      name: 'Straight Flush',
      tiebreakers: [straightHigh]
    };
  }

  // 2. Four of a Kind (rank 7)
  if (groups[0].count === 4) {
    return {
      rank: 7,
      name: 'Four of a Kind',
      tiebreakers: [groups[0].value, groups[1].value]
    };
  }

  // 3. Full House (rank 6)
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      rank: 6,
      name: 'Full House',
      tiebreakers: [groups[0].value, groups[1].value]
    };
  }

  // 4. Flush (rank 5)
  if (isFlush) {
    return {
      rank: 5,
      name: 'Flush',
      tiebreakers: vals
    };
  }

  // 5. Straight (rank 4)
  if (isStraight) {
    return {
      rank: 4,
      name: 'Straight',
      tiebreakers: [straightHigh]
    };
  }

  // 6. Three of a Kind (rank 3)
  if (groups[0].count === 3) {
    return {
      rank: 3,
      name: 'Three of a Kind',
      tiebreakers: [groups[0].value, groups[1].value, groups[2].value]
    };
  }

  // 7. Two Pair (rank 2)
  if (groups[0].count === 2 && groups[1].count === 2) {
    return {
      rank: 2,
      name: 'Two Pair',
      tiebreakers: [groups[0].value, groups[1].value, groups[2].value]
    };
  }

  // 8. One Pair (rank 1)
  if (groups[0].count === 2) {
    return {
      rank: 1,
      name: 'One Pair',
      tiebreakers: [groups[0].value, groups[1].value, groups[2].value, groups[3].value]
    };
  }

  // 9. High Card (rank 0)
  return {
    rank: 0,
    name: 'High Card',
    tiebreakers: vals
  };
}

/**
 * Compares two evaluated hands
 * @returns {number} positive if a > b, negative if a < b, 0 if tie
 */
function compareHands(a, b) {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const valA = a.tiebreakers[i] !== undefined ? a.tiebreakers[i] : 0;
    const valB = b.tiebreakers[i] !== undefined ? b.tiebreakers[i] : 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

/**
 * Given 5-7 cards, finds and returns the best 5-card hand result
 * Result includes { rank, name, tiebreakers, cards }
 */
function getBestHand(cards) {
  if (!cards || cards.length < 5) return null;
  const combos = getCombinations(cards, 5);
  let best = null;

  for (const combo of combos) {
    const evaluation = evaluate5(combo);
    const candidate = {
      ...evaluation,
      cards: combo
    };
    if (!best || compareHands(candidate, best) > 0) {
      best = candidate;
    }
  }

  return best;
}

module.exports = {
  getBestHand,
  compareHands,
  evaluate5,
  getCombinations
};
