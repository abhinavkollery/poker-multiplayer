// Imposter Game - Curated Word Pairs Database
// In each pair, Word 1 is for Civilians, Word 2 is for the Imposter.
// They are closely related so clues can be subtle and deceptive!

const WORD_PAIRS = [
  // General & Everyday Objects
  { id: 1, category: 'Everyday', word1: 'Coffee', word2: 'Tea' },
  { id: 2, category: 'Everyday', word1: 'Pencil', word2: 'Pen' },
  { id: 3, category: 'Everyday', word1: 'Book', word2: 'Magazine' },
  { id: 4, category: 'Everyday', word1: 'Blanket', word2: 'Quilt' },
  { id: 5, category: 'Everyday', word1: 'Glasses', word2: 'Sunglasses' },
  { id: 6, category: 'Everyday', word1: 'Mirror', word2: 'Window' },
  { id: 7, category: 'Everyday', word1: 'Pillow', word2: 'Cushion' },
  { id: 8, category: 'Everyday', word1: 'Candle', word2: 'Flashlight' },
  { id: 9, category: 'Everyday', word1: 'Jacket', word2: 'Coat' },
  { id: 10, category: 'Everyday', word1: 'Shampoo', word2: 'Soap' },

  // Food & Drink
  { id: 11, category: 'Food & Drink', word1: 'Pizza', word2: 'Burger' },
  { id: 12, category: 'Food & Drink', word1: 'Chocolate', word2: 'Vanilla' },
  { id: 13, category: 'Food & Drink', word1: 'Apple', word2: 'Orange' },
  { id: 14, category: 'Food & Drink', word1: 'Butter', word2: 'Cheese' },
  { id: 15, category: 'Food & Drink', word1: 'Donut', word2: 'Bagel' },
  { id: 16, category: 'Food & Drink', word1: 'Sandwich', word2: 'Wrap' },
  { id: 17, category: 'Food & Drink', word1: 'Ice Cream', word2: 'Frozen Yogurt' },
  { id: 18, category: 'Food & Drink', word1: 'Strawberry', word2: 'Raspberry' },
  { id: 19, category: 'Food & Drink', word1: 'Cookie', word2: 'Brownie' },
  { id: 20, category: 'Food & Drink', word1: 'Honey', word2: 'Maple Syrup' },
  { id: 21, category: 'Food & Drink', word1: 'Whiskey', word2: 'Vodka' },
  { id: 22, category: 'Food & Drink', word1: 'Pancake', word2: 'Waffle' },

  // Animals & Nature
  { id: 23, category: 'Animals', word1: 'Cat', word2: 'Dog' },
  { id: 24, category: 'Animals', word1: 'Lion', word2: 'Tiger' },
  { id: 25, category: 'Animals', word1: 'Crocodile', word2: 'Alligator' },
  { id: 26, category: 'Animals', word1: 'Spider', word2: 'Scorpion' },
  { id: 27, category: 'Animals', word1: 'Whale', word2: 'Dolphin' },
  { id: 28, category: 'Animals', word1: 'Frog', word2: 'Toad' },
  { id: 29, category: 'Animals', word1: 'Rabbit', word2: 'Hare' },
  { id: 30, category: 'Animals', word1: 'Horse', word2: 'Donkey' },
  { id: 31, category: 'Animals', word1: 'Bee', word2: 'Wasp' },
  { id: 32, category: 'Animals', word1: 'Butterfly', word2: 'Moth' },

  // Geography & Nature
  { id: 33, category: 'Nature & Places', word1: 'Ocean', word2: 'Lake' },
  { id: 34, category: 'Nature & Places', word1: 'Sun', word2: 'Moon' },
  { id: 35, category: 'Nature & Places', word1: 'Rain', word2: 'Snow' },
  { id: 36, category: 'Nature & Places', word1: 'Forest', word2: 'Jungle' },
  { id: 37, category: 'Nature & Places', word1: 'Mountain', word2: 'Hill' },
  { id: 38, category: 'Nature & Places', word1: 'Desert', word2: 'Beach' },
  { id: 39, category: 'Nature & Places', word1: 'River', word2: 'Canal' },
  { id: 40, category: 'Nature & Places', word1: 'Volcano', word2: 'Earthquake' },
  { id: 41, category: 'Nature & Places', word1: 'Castle', word2: 'Palace' },
  { id: 42, category: 'Nature & Places', word1: 'City', word2: 'Village' },

  // Pop Culture & Entertainment
  { id: 43, category: 'Pop Culture', word1: 'Superman', word2: 'Batman' },
  { id: 44, category: 'Pop Culture', word1: 'Spider-Man', word2: 'Iron Man' },
  { id: 45, category: 'Pop Culture', word1: 'Cinema', word2: 'Netflix' },
  { id: 46, category: 'Pop Culture', word1: 'Star Wars', word2: 'Star Trek' },
  { id: 47, category: 'Pop Culture', word1: 'Marvel', word2: 'DC Comics' },
  { id: 48, category: 'Pop Culture', word1: 'Guitar', word2: 'Violin' },
  { id: 49, category: 'Pop Culture', word1: 'Piano', word2: 'Keyboard' },
  { id: 50, category: 'Pop Culture', word1: 'Vampire', word2: 'Zombie' },
  { id: 51, category: 'Pop Culture', word1: 'Ghost', word2: 'Monster' },
  { id: 52, category: 'Pop Culture', word1: 'Chess', word2: 'Checkers' },

  // Tech & Transport
  { id: 53, category: 'Tech & Transport', word1: 'Laptop', word2: 'Tablet' },
  { id: 54, category: 'Tech & Transport', word1: 'Smartphone', word2: 'Smartwatch' },
  { id: 55, category: 'Tech & Transport', word1: 'Airplane', word2: 'Helicopter' },
  { id: 56, category: 'Tech & Transport', word1: 'Bicycle', word2: 'Motorcycle' },
  { id: 57, category: 'Tech & Transport', word1: 'Train', word2: 'Subway' },
  { id: 58, category: 'Tech & Transport', word1: 'Ship', word2: 'Submarine' },
  { id: 59, category: 'Tech & Transport', word1: 'Microwave', word2: 'Oven' },
  { id: 60, category: 'Tech & Transport', word1: 'Painting', word2: 'Photograph' },

  // Roles & People
  { id: 61, category: 'People & Jobs', word1: 'Doctor', word2: 'Nurse' },
  { id: 62, category: 'People & Jobs', word1: 'Teacher', word2: 'Professor' },
  { id: 63, category: 'People & Jobs', word1: 'King', word2: 'Emperor' },
  { id: 64, category: 'People & Jobs', word1: 'Pilot', word2: 'Astronaut' },
  { id: 65, category: 'People & Jobs', word1: 'Chef', word2: 'Baker' }
];

function getRandomWordPair(category = 'all', excludeIds = []) {
  let pool = WORD_PAIRS;
  if (category && category !== 'all') {
    pool = WORD_PAIRS.filter(p => p.category.toLowerCase() === category.toLowerCase());
    if (pool.length === 0) pool = WORD_PAIRS;
  }
  const available = pool.filter(p => !excludeIds.includes(p.id));
  const candidates = available.length > 0 ? available : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  // 50% chance to swap word1 and word2 so word1 is not always the civilian word
  const swap = Math.random() < 0.5;
  return {
    id: picked.id,
    category: picked.category,
    civilianWord: swap ? picked.word2 : picked.word1,
    imposterWord: swap ? picked.word1 : picked.word2
  };
}

const CATEGORIES = ['all', 'Everyday', 'Food & Drink', 'Animals', 'Nature & Places', 'Pop Culture', 'Tech & Transport', 'People & Jobs'];

module.exports = {
  WORD_PAIRS,
  CATEGORIES,
  getRandomWordPair
};

