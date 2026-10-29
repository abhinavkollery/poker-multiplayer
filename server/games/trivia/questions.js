// Curated Speed Trivia Question Bank
const TRIVIA_QUESTIONS = [
  {
    question: "What is the capital city of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    answer: 2, // Canberra
    category: "Geography"
  },
  {
    question: "Which chemical element has the symbol 'Fe'?",
    options: ["Lead", "Iron", "Gold", "Silver"],
    answer: 1, // Iron
    category: "Science"
  },
  {
    question: "What was the first commercially successful video game?",
    options: ["Pong", "Space Invaders", "Pac-Man", "Asteroids"],
    answer: 0, // Pong
    category: "Gaming"
  },
  {
    question: "In what year did the Titanic sink in the North Atlantic?",
    options: ["1905", "1912", "1918", "1923"],
    answer: 1, // 1912
    category: "History"
  },
  {
    question: "Which planet is known as the 'Red Planet'?",
    options: ["Venus", "Jupiter", "Mars", "Saturn"],
    answer: 2, // Mars
    category: "Science"
  },
  {
    question: "How many hearts does an octopus have?",
    options: ["One", "Two", "Three", "Four"],
    answer: 2, // Three
    category: "Nature"
  },
  {
    question: "What programming language was created by Brendan Eich in just 10 days?",
    options: ["Python", "JavaScript", "Ruby", "Java"],
    answer: 1, // JavaScript
    category: "Tech"
  },
  {
    question: "Which artist painted the 'Mona Lisa'?",
    options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
    answer: 2, // Leonardo da Vinci
    category: "Art"
  },
  {
    question: "What is the tallest mountain in the solar system?",
    options: ["Mount Everest", "Olympus Mons", "Mauna Kea", "Kilimanjaro"],
    answer: 1, // Olympus Mons (on Mars)
    category: "Science"
  },
  {
    question: "Which company developed the Nintendo Switch?",
    options: ["Sony", "Sega", "Nintendo", "Microsoft"],
    answer: 2, // Nintendo
    category: "Gaming"
  },
  {
    question: "What is the rarest blood type among humans?",
    options: ["O-negative", "AB-negative", "B-positive", "A-negative"],
    answer: 1, // AB-negative
    category: "Science"
  },
  {
    question: "In computing, what does 'SSD' stand for?",
    options: ["Super Speed Disk", "Solid State Drive", "System Storage Device", "Serial Synchronous Drive"],
    answer: 1, // Solid State Drive
    category: "Tech"
  },
  {
    question: "How many players are on the field for one team in baseball?",
    options: ["7", "8", "9", "11"],
    answer: 2, // 9
    category: "Sports"
  },
  {
    question: "Which country is home to the ancient ruins of Machu Picchu?",
    options: ["Chile", "Peru", "Colombia", "Brazil"],
    answer: 1, // Peru
    category: "Geography"
  },
  {
    question: "What is the speed of light in a vacuum (approx)?",
    options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"],
    answer: 0, // 300,000 km/s
    category: "Physics"
  },
  {
    question: "Who was the first person to step on the Moon?",
    options: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin", "Michael Collins"],
    answer: 1, // Neil Armstrong
    category: "History"
  },
  {
    question: "Which animal is known to have the most powerful bite force relative to its size?",
    options: ["Saltwater Crocodile", "Tasmanian Devil", "Hyena", "Grizzly Bear"],
    answer: 1, // Tasmanian Devil
    category: "Nature"
  },
  {
    question: "Which is the smallest country in the world by land area?",
    options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"],
    answer: 2, // Vatican City
    category: "Geography"
  },
  {
    question: "In Greek mythology, who was the god of the sea?",
    options: ["Zeus", "Hades", "Poseidon", "Apollo"],
    answer: 2, // Poseidon
    category: "Mythology"
  },
  {
    question: "What is the hardest natural substance known on Earth?",
    options: ["Titanium", "Diamond", "Graphene", "Quartz"],
    answer: 1, // Diamond
    category: "Science"
  }
];

function getRandomQuestions(count = 10) {
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

module.exports = { TRIVIA_QUESTIONS, getRandomQuestions };

