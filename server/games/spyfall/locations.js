// 30 Diverse Spyfall Locations with Roles
const SPYFALL_LOCATIONS = [
  {
    name: "Airplane",
    roles: ["First Class Passenger", "Flight Attendant", "Pilot", "Air Marshal", "Copilot", "Economy Passenger"]
  },
  {
    name: "Submarine",
    roles: ["Captain", "Sonar Operator", "Cook", "Torpedo Technician", "Navigator", "Sailor"]
  },
  {
    name: "Casino",
    roles: ["Card Dealer", "High Roller", "Bouncer", "Bartender", "Security Guard", "Pit Boss"]
  },
  {
    name: "Space Station",
    roles: ["Commander", "Flight Engineer", "Scientist", "Space Tourist", "Spacewalker", "Doctor"]
  },
  {
    name: "Hospital",
    roles: ["Surgeon", "Nurse", "Patient", "Paramedic", "Anesthesiologist", "Visitor"]
  },
  {
    name: "Pirate Ship",
    roles: ["Captain", "First Mate", "Lookout", "Cannoneer", "Cabin Boy", "Prisoner"]
  },
  {
    name: "Bank",
    roles: ["Bank Teller", "Manager", "Security Guard", "Robber", "Customer", "Armored Truck Driver"]
  },
  {
    name: "Restaurant",
    roles: ["Head Chef", "Waiter", "Food Critic", "Dishwasher", "Host", "Diner"]
  },
  {
    name: "Movie Studio",
    roles: ["Director", "Lead Actor", "Cameraman", "Stunt Double", "Makeup Artist", "Producer"]
  },
  {
    name: "School",
    roles: ["Teacher", "Principal", "Janitor", "Student", "Librarian", "Cafeteria Worker"]
  },
  {
    name: "Cruise Ship",
    roles: ["Captain", "Entertainer", "Lifeguard", "Bartender", "Tourist", "Chef"]
  },
  {
    name: "Amusement Park",
    roles: ["Ride Operator", "Mascot", "Teenager", "Ticket Seller", "Parent", "Food Vendor"]
  },
  {
    name: "Police Station",
    roles: ["Detective", "Police Chief", "Patrol Officer", "Suspect", "Lawyer", "Dispatcher"]
  },
  {
    name: "Art Museum",
    roles: ["Curator", "Security Guard", "Tourist", "Art Thief", "Painter", "Docent"]
  },
  {
    name: "Supermarket",
    roles: ["Cashier", "Store Manager", "Shopper", "Butcher", "Stock Clerk", "Security Guard"]
  },
  {
    name: "Military Base",
    roles: ["General", "Soldier", "Medic", "Drill Sergeant", "Sniper", "Mechanic"]
  },
  {
    name: "Circus",
    roles: ["Ringmaster", "Acrobat", "Clown", "Lion Tamer", "Magician", "Spectator"]
  },
  {
    name: "Hotel",
    roles: ["Concierge", "Bellhop", "Housekeeper", "Guest", "Manager", "Valet"]
  },
  {
    name: "Cathedral",
    roles: ["Priest", "Choir Singer", "Tourist", "Organist", "Bride", "Parishioner"]
  },
  {
    name: "Subway Station",
    roles: ["Train Operator", "Commuter", "Street Musician", "Ticket Agent", "Police Officer", "Cleaner"]
  }
];

function getRandomLocation() {
  const idx = Math.floor(Math.random() * SPYFALL_LOCATIONS.length);
  return SPYFALL_LOCATIONS[idx];
}

module.exports = { SPYFALL_LOCATIONS, getRandomLocation };

