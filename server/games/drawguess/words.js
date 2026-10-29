// Word bank for Draw & Guess with difficulty tiers and categories
const WORD_LIST = {
  easy: [
    'Apple', 'Banana', 'Cat', 'Dog', 'Sun', 'Moon', 'Star', 'Tree', 'Fish', 'Bird',
    'Car', 'Boat', 'Book', 'Door', 'House', 'Clock', 'Hat', 'Shoe', 'Cup', 'Ball',
    'Eye', 'Nose', 'Mouth', 'Hand', 'Foot', 'Smile', 'Heart', 'Cloud', 'Rain', 'Snow',
    'Fire', 'Ice', 'Egg', 'Bread', 'Cake', 'Pizza', 'Milk', 'Fork', 'Spoon', 'Knife',
    'Chair', 'Table', 'Bed', 'Lamp', 'Key', 'Ring', 'Flag', 'Bell', 'Box', 'Coin',
    'Duck', 'Frog', 'Pig', 'Cow', 'Horse', 'Bear', 'Lion', 'Mouse', 'Snake', 'Spider'
  ],
  medium: [
    'Bicycle', 'Helicopter', 'Submarine', 'Rocket', 'Telescope', 'Microscope', 'Compass',
    'Volcano', 'Waterfall', 'Rainbow', 'Lightning', 'Tornado', 'Island', 'Mountain', 'Desert',
    'Guitar', 'Piano', 'Drums', 'Violin', 'Trumpet', 'Microphone', 'Headphones', 'Camera',
    'Sandwich', 'Hamburger', 'Popcorn', 'Spaghetti', 'Pancake', 'Pineapple', 'Watermelon',
    'Elephant', 'Giraffe', 'Penguin', 'Dolphin', 'Octopus', 'Kangaroo', 'Chameleon', 'Flamingo',
    'Castle', 'Pyramid', 'Bridge', 'Lighthouse', 'Windmill', 'Skyscraper', 'Igloo', 'Tent',
    'Backpack', 'Umbrella', 'Glasses', 'Crown', 'Sword', 'Shield', 'Anchor', 'Treasure',
    'Robot', 'Alien', 'Ghost', 'Wizard', 'Ninja', 'Pirate', 'Super', 'Vampire', 'Zombie'
  ],
  hard: [
    'Black Hole', 'Constellation', 'Solar Eclipse', 'Photosynthesis', 'DNA', 'Time Machine',
    'Gravity', 'Evolution', 'Archaeology', 'Metamorphosis', 'Hypnosis', 'Teleportation',
    'Roller Coaster', 'Hot Air Balloon', 'Ferris Wheel', 'Scarecrow', 'Boomerang', 'Hourglass',
    'Chandelier', 'Parachute', 'Hoverboard', 'Labyrinth', 'Shipwreck', 'Colosseum',
    'Statue of Liberty', 'Eiffel Tower', 'Great Wall', 'Stonehenge', 'Taj Mahal',
    'Espresso Machine', 'Popcorn Maker', 'Metal Detector', 'Night Vision', 'Vending Machine',
    'Traffic Jam', 'Thunderstorm', 'Solar Panel', 'Wind Turbine', 'Electric Car',
    'Nightmare', 'Daydream', 'Mirage', 'Déjà vu', 'Sleepwalking', 'Brainstorm'
  ]
};

function getRandomWords(count = 3, customWords = []) {
  const pool = [];
  if (Array.isArray(customWords) && customWords.length > 0) {
    pool.push(...customWords.filter(w => typeof w === 'string' && w.trim().length > 1));
  }
  pool.push(...WORD_LIST.easy, ...WORD_LIST.medium, ...WORD_LIST.hard);

  const selected = [];
  const used = new Set();
  let attempts = 0;
  while (selected.length < count && attempts < 100) {
    attempts++;
    const idx = Math.floor(Math.random() * pool.length);
    const word = pool[idx].trim();
    const key = word.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      selected.push(word);
    }
  }
  return selected;
}

module.exports = { WORD_LIST, getRandomWords };

