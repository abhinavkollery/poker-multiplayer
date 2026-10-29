// Wavelength Game - Curated Spectrum Deck
// Each spectrum has a left (0%) concept and a right (100%) concept.

const SPECTRUM_CARDS = [
  { id: 1, left: 'Cold', right: 'Hot' },
  { id: 2, left: 'Underrated', right: 'Overrated' },
  { id: 3, left: 'Guilty Pleasure', right: 'Masterpiece' },
  { id: 4, left: 'Useless Superpower', right: 'God-Tier Superpower' },
  { id: 5, left: 'Safe', right: 'Dangerous' },
  { id: 6, left: 'Cheap', right: 'Expensive' },
  { id: 7, left: 'Normal to own 1', right: 'Normal to own 100' },
  { id: 8, left: 'Terrible Pet', right: 'Amazing Pet' },
  { id: 9, left: 'Sad Song', right: 'Happy / Uplifting Song' },
  { id: 10, left: 'Temporary', right: 'Permanent' },
  { id: 11, left: 'Pure Luck', right: 'Pure Skill' },
  { id: 12, left: 'Boring Hobby', right: 'Exciting Hobby' },
  { id: 13, left: 'Villain', right: 'Hero' },
  { id: 14, left: 'Fragile', right: 'Indestructible' },
  { id: 15, left: 'Casual', right: 'Formal' },
  { id: 16, left: 'Quiet', right: 'Extremely Loud' },
  { id: 17, left: 'Tastes Bad', right: 'Tastes Incredible' },
  { id: 18, left: 'Hard to Learn', right: 'Easy to Learn' },
  { id: 19, left: 'Introverted', right: 'Extroverted' },
  { id: 20, left: 'Good Habit', right: 'Bad Habit' },
  { id: 21, left: 'Childish', right: 'Mature' },
  { id: 22, left: 'Dystopian', right: 'Utopian' },
  { id: 23, left: 'Low Stress', right: 'High Stress' },
  { id: 24, left: 'Trash Food', right: 'Gourmet Cuisine' },
  { id: 25, left: 'Unpopular Opinion', right: 'Universally Agreed' },
  { id: 26, left: 'Worthless', right: 'Priceless' },
  { id: 27, left: 'Soft', right: 'Hard' },
  { id: 28, left: 'Ethical', right: 'Unethical' },
  { id: 29, left: 'Ancient', right: 'Futuristic' },
  { id: 30, left: 'Weak', right: 'Powerful' },
  { id: 31, left: 'Unhealthy', right: 'Healthy' },
  { id: 32, left: 'Low-brow Humor', right: 'High-brow Humor' },
  { id: 33, left: 'Overpriced', right: 'Total Bargain' },
  { id: 34, left: 'Nightmare Fuel', right: 'Heartwarming' },
  { id: 35, left: 'Selfish', right: 'Selfless' },
  { id: 36, left: 'Geeky / Nerdy', right: 'Cool / Trendy' },
  { id: 37, left: 'Socially Awkward', right: 'Smooth & Charismatic' },
  { id: 38, left: 'Strictly for Kids', right: 'Strictly for Adults' },
  { id: 39, left: 'Easy to Forgive', right: 'Unforgivable' },
  { id: 40, left: 'Waste of Money', right: 'Great Investment' },
  { id: 41, left: 'Common Knowledge', right: 'Obscure Trivia' },
  { id: 42, left: 'Painful', right: 'Pleasurable' },
  { id: 43, left: 'Rude', right: 'Polite' },
  { id: 44, left: 'Overhyped', right: 'Hidden Gem' },
  { id: 45, left: 'Pure Chaos', right: 'Total Order' },
  { id: 46, left: 'Boring Job', right: 'Dream Job' },
  { id: 47, left: 'Low Calorie', right: 'Calorie Bomb' },
  { id: 48, left: 'Cute / Adorable', right: 'Terrifying / Monstrous' },
  { id: 49, left: 'Simple to Explain', right: 'Impossible to Explain' },
  { id: 50, left: 'Slow', right: 'Fast' },
  { id: 51, left: 'Solo Activity', right: 'Group Activity' },
  { id: 52, left: 'Dark / Gritty', right: 'Bright / Whimsical' },
  { id: 53, left: 'Bad Smell', right: 'Good Smell' },
  { id: 54, left: 'Needs Talent', right: 'Needs Practice' },
  { id: 55, left: 'Overrated Movie', right: 'Underrated Movie' },
  { id: 56, left: 'Short-Lived Trend', right: 'Timeless Classic' },
  { id: 57, left: 'Relaxing', right: 'Exhausting' },
  { id: 58, left: 'Ugly Animal', right: 'Beautiful Animal' },
  { id: 59, left: 'Forbidden', right: 'Mandatory' },
  { id: 60, left: 'Trashy TV Show', right: 'Prestige TV' },
  { id: 61, left: 'Terrible superpower to have in real life', right: 'Awesome superpower in real life' },
  { id: 62, left: 'Unforgivable fashion mistake', right: 'Timeless style' },
  { id: 63, left: 'Worst chore', right: 'Most satisfying chore' },
  { id: 64, left: 'Scary when big', right: 'Scary when small' },
  { id: 65, left: 'Best cold', right: 'Best warm' },
  { id: 66, left: 'Introvert hobby', right: 'Extrovert hobby' },
  { id: 67, left: 'Overrated tourist spot', right: 'Must-visit wonder' },
  { id: 68, left: 'Hard to start', right: 'Hard to stop' },
  { id: 69, left: 'Uncool car', right: 'Dream car' },
  { id: 70, left: 'Trash pizza topping', right: 'Elite pizza topping' }
];

function getRandomSpectrumCard(excludeIds = []) {
  const available = SPECTRUM_CARDS.filter(c => !excludeIds.includes(c.id));
  const pool = available.length > 0 ? available : SPECTRUM_CARDS;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  // 50% chance to flip left/right
  const flip = Math.random() < 0.5;
  return {
    id: picked.id,
    left: flip ? picked.right : picked.left,
    right: flip ? picked.left : picked.right
  };
}

module.exports = {
  SPECTRUM_CARDS,
  getRandomSpectrumCard
};

