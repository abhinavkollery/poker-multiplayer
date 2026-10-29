// Co-op Platformer Levels Design
// Tile legend:
// ' ' : Empty air
// '#' : Solid wall / platform
// 'S' : Player spawn zone
// 'E' : Exit Portal (All players must reach here to clear level)
// 'B' : Pressure Plate Button (activates linked door while stepped on or crate on it)
// 'D' : Linked Door (solid when closed, passable when open)
// 'C' : Pushable Crate (can be pushed by players and hold down buttons)
// 'K' : Key (must be collected to unlock key door)
// 'L' : Locked Key Door (requires Key 'K')
// 'X' : Spike hazard (respawns player at spawn)

const LEVELS = [
  // Level 1: Buddy System (Buttons & Linked Doors)
  {
    id: 1,
    name: "Level 1: Buddy System",
    hint: "One player holds the pressure plate while the other crosses to open the second door!",
    width: 20,
    height: 12,
    spawns: [
      { x: 2, y: 9 },
      { x: 3, y: 9 },
      { x: 2, y: 8 },
      { x: 3, y: 8 }
    ],
    crates: [],
    keys: [],
    buttons: [
      { id: 'b1', x: 6, y: 9, linkedDoorId: 'd1', type: 'hold' },
      { id: 'b2', x: 13, y: 9, linkedDoorId: 'd2', type: 'hold' }
    ],
    doors: [
      { id: 'd1', x: 9, y: 7, height: 3, open: false },
      { id: 'd2', x: 15, y: 7, height: 3, open: false }
    ],
    exit: { x: 17, y: 9, width: 1.5, height: 2 },
    map: [
      "####################",
      "#                  #",
      "#                  #",
      "#                  #",
      "#                  #",
      "#                  #",
      "#                  #",
      "#        #         #",
      "#        #         #",
      "#                  #",
      "####################",
      "####################"
    ]
  },

  // Level 2: The Heavy Crate (Pushing blocks & High Ledges)
  {
    id: 2,
    name: "Level 2: Heavy Lifting",
    hint: "Push the crate onto the button to keep the door open permanently, or jump on top of it!",
    width: 20,
    height: 12,
    spawns: [
      { x: 2, y: 9 },
      { x: 3, y: 9 },
      { x: 2, y: 8 },
      { x: 3, y: 8 }
    ],
    crates: [
      { id: 'c1', x: 5, y: 9, width: 1, height: 1 }
    ],
    keys: [],
    buttons: [
      { id: 'b1', x: 9, y: 9, linkedDoorId: 'd1', type: 'hold' }
    ],
    bouncePads: [
      { x: 10, y: 9, power: -16.5 }
    ],
    doors: [
      { id: 'd1', x: 13, y: 6, height: 4, open: false }
    ],
    exit: { x: 17, y: 5, width: 1.5, height: 2 },
    map: [
      "####################",
      "#                  #",
      "#                  #",
      "#                  #",
      "#               ####",
      "#               ####",
      "#            #######",
      "#            #######",
      "#                  #",
      "#                  #",
      "####################",
      "####################"
    ]
  },

  // Level 3: The Golden Key & Hazards
  {
    id: 3,
    name: "Level 3: The Golden Key",
    hint: "Press the button to raise the safety bridge over spikes, then retrieve the key to unlock the exit door!",
    width: 22,
    height: 12,
    spawns: [
      { x: 2, y: 9 },
      { x: 3, y: 9 },
      { x: 2, y: 8 },
      { x: 3, y: 8 }
    ],
    crates: [],
    keys: [
      { id: 'k1', x: 15, y: 5, collected: false }
    ],
    buttons: [
      { id: 'b1', x: 5, y: 9, linkedDoorId: 'd1', type: 'hold' }
    ],
    doors: [
      { id: 'd1', x: 8, y: 7, height: 1, width: 5, open: false, isBridge: true }
    ],
    lockedDoors: [
      { id: 'l1', x: 18, y: 7, height: 3, open: false, keyId: 'k1' }
    ],
    exit: { x: 20, y: 8, width: 1.5, height: 2 },
    hazards: [
      { x: 8, y: 9, width: 5, height: 1 } // Spikes below bridge
    ],
    map: [
      "######################",
      "#                    #",
      "#                    #",
      "#                    #",
      "#              ###   #",
      "#              ###   #",
      "#                    #",
      "#                    #",
      "#       XXXXX    #####",
      "#       XXXXX    #####",
      "######################",
      "######################"
    ]
  },

  // Level 4: Synchronized Ascent
  {
    id: 4,
    name: "Level 4: Dual Towers",
    hint: "Work up the two towers together. Alternate stepping on buttons to let each other climb higher!",
    width: 22,
    height: 14,
    spawns: [
      { x: 2, y: 11 },
      { x: 3, y: 11 },
      { x: 2, y: 10 },
      { x: 3, y: 10 }
    ],
    crates: [],
    keys: [
      { id: 'k1', x: 2, y: 2, collected: false }
    ],
    buttons: [
      { id: 'b1', x: 4, y: 11, linkedDoorId: 'd1', type: 'toggle' },
      { id: 'b2', x: 18, y: 8, linkedDoorId: 'd2', type: 'toggle' },
      { id: 'b3', x: 4, y: 5, linkedDoorId: 'd3', type: 'toggle' }
    ],
    bouncePads: [
      { x: 11, y: 11, power: -17.5 }
    ],
    doors: [
      { id: 'd1', x: 15, y: 9, height: 3, open: false },
      { id: 'd2', x: 8, y: 6, height: 3, open: false },
      { id: 'd3', x: 15, y: 3, height: 3, open: false }
    ],
    lockedDoors: [
      { id: 'l1', x: 18, y: 2, height: 2, open: false, keyId: 'k1' }
    ],
    exit: { x: 20, y: 2, width: 1.5, height: 2 },
    hazards: [],
    map: [
      "######################",
      "#                    #",
      "#                    #",
      "#    ####    ####    #",
      "#                    #",
      "#                    #",
      "#    ####    ####    #",
      "#                    #",
      "#                    #",
      "#    ####    ####    #",
      "#                    #",
      "#                    #",
      "######################",
      "######################"
    ]
  },

  // Level 5: The Grand Finale Vault
  {
    id: 5,
    name: "Level 5: Master Vault",
    hint: "The ultimate team challenge! Combine crates, moving bridges, keys, and precision jumps to escape together!",
    width: 24,
    height: 14,
    spawns: [
      { x: 2, y: 11 },
      { x: 3, y: 11 },
      { x: 2, y: 10 },
      { x: 3, y: 10 }
    ],
    crates: [
      { id: 'c1', x: 6, y: 11, width: 1, height: 1 }
    ],
    keys: [
      { id: 'k1', x: 12, y: 4, collected: false }
    ],
    buttons: [
      { id: 'b1', x: 9, y: 11, linkedDoorId: 'd1', type: 'hold' },
      { id: 'b2', x: 2, y: 5, linkedDoorId: 'd2', type: 'toggle' }
    ],
    doors: [
      { id: 'd1', x: 13, y: 9, height: 3, open: false },
      { id: 'd2', x: 17, y: 5, height: 3, open: false }
    ],
    lockedDoors: [
      { id: 'l1', x: 20, y: 10, height: 2, open: false, keyId: 'k1' }
    ],
    exit: { x: 22, y: 10, width: 1.5, height: 2 },
    hazards: [
      { x: 14, y: 11, width: 4, height: 1 }
    ],
    map: [
      "########################",
      "#                      #",
      "#                      #",
      "#                      #",
      "#  #####    ######     #",
      "#                      #",
      "#                      #",
      "#       ####           #",
      "#                      #",
      "#                      #",
      "#              XXXX  ###",
      "#              XXXX  ###",
      "########################",
      "########################"
    ]
  }
];

function getLevel(levelIndex = 0) {
  const index = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  // Deep clone level data so modifications in a game session don't affect original
  return JSON.parse(JSON.stringify(LEVELS[index]));
}

module.exports = {
  LEVELS,
  getLevel
};

