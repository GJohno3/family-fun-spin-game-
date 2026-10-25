// The starter list. The family's own activities are switched on. Entries marked
// `suggested` are extra ideas near Exeter: most start switched off, ready to be
// switched on in grown-up mode.
//
// cost: 0 = free, 1 = £, 2 = ££, 3 = £££
// outdoor: needs good weather (hidden when the wheel is set to rainy)
// home: can be done at home
// kind: 'normal', 'jackpot' (rare big treat) or 'secret' (Mystery Envelope)
// since: the DATA_VERSION an entry was added in. Bump DATA_VERSION when adding
// entries so phones that already have a saved list pick them up.

export const DATA_VERSION = 2;

const base = { cost: 1, outdoor: false, home: false, kind: 'normal', active: true, suggested: false, notes: '' };
const activity = (fields) => ({ ...base, ...fields });
const suggestion = (fields) => activity({ active: false, suggested: true, ...fields });

export const STARTER_ACTIVITIES = [
  // After school & evening: the family's list
  activity({ id: 'swimming', category: 'afterschool', name: 'Swimming at David Lloyd', label: 'Swimming', emoji: '🏊', cost: 1 }),
  activity({ id: 'park-football', category: 'afterschool', name: 'Football at the park', label: 'Park Football', emoji: '⚽', cost: 0, outdoor: true }),
  activity({ id: 'bike-scooter', category: 'afterschool', name: 'Bike or scooter ride', label: 'Bike / Scooter', emoji: '🚲', cost: 0, outdoor: true }),
  activity({ id: 'bowling', category: 'afterschool', name: 'Bowling', label: 'Bowling', emoji: '🎳', cost: 2 }),
  activity({ id: 'arcade', category: 'afterschool', name: 'Arcade', label: 'Arcade', emoji: '🕹️', cost: 2 }),
  activity({ id: 'laser-tag', category: 'afterschool', name: 'Home laser tag', label: 'Laser Tag', emoji: '🎯', cost: 0, home: true }),
  activity({ id: 'ikea', category: 'afterschool', name: 'IKEA meatballs and cake', label: 'IKEA Meatballs', emoji: '🧆', cost: 1 }),
  activity({ id: 'movie-night', category: 'afterschool', name: 'Home movie night with popcorn and sweets', label: 'Movie Night', emoji: '🍿', cost: 1, home: true }),
  activity({ id: 'cinema', category: 'afterschool', name: 'Cinema', label: 'Cinema', emoji: '🎬', cost: 2 }),
  activity({ id: 'friends-over', category: 'afterschool', name: 'Invite friends over to play', label: 'Friends Over', emoji: '👫', cost: 0, home: true }),

  // Day out: the family's list
  activity({ id: 'crealy', category: 'dayout', name: 'Crealy theme park', label: 'Crealy', emoji: '🎢', cost: 3, outdoor: true }),
  activity({ id: 'woodlands', category: 'dayout', name: 'Woodlands adventure park', label: 'Woodlands', emoji: '🌳', cost: 3, outdoor: true }),
  activity({ id: 'ibounce', category: 'dayout', name: "iBounce and McDonald's", label: "iBounce + McD's", emoji: '🤸', cost: 2 }),
  activity({ id: 'street-soccer', category: 'dayout', name: "Street Soccer and McDonald's", label: 'Street Soccer', emoji: '🥅', cost: 2 }),
  activity({ id: 'go-ape', category: 'dayout', name: "Go Ape and McDonald's", label: 'Go Ape', emoji: '🦍', cost: 3, outdoor: true }),
  activity({ id: 'beach', category: 'dayout', name: 'Beach and bodyboarding', label: 'Beach', emoji: '🏄', cost: 0, outdoor: true }),
  activity({ id: 'flip-out', category: 'dayout', name: 'Flip Out', label: 'Flip Out', emoji: '🦘', cost: 2, since: 2 }),

  // Jackpots: switched on so the Jackpot pocket shows up from the start
  suggestion({ id: 's-jackpot-evening', category: 'afterschool', kind: 'jackpot', active: true, name: "Dinner out, then the cinema with pick 'n' mix", label: 'Dinner + Film', emoji: '🍽️', cost: 3 }),
  suggestion({ id: 's-jackpot-day', category: 'dayout', kind: 'jackpot', active: true, name: 'The Milky Way Adventure Park in North Devon', label: 'Milky Way', emoji: '🚀', cost: 3, outdoor: true, notes: 'About 1 hour 30 minutes from Exeter, near Clovelly.' }),

  // After school & evening: suggestions
  suggestion({ id: 's-climbing', category: 'afterschool', name: 'Climbing at the Quay Climbing Centre', label: 'Climbing', emoji: '🧗', cost: 2, notes: 'Indoor climbing on Exeter Quay.' }),
  suggestion({ id: 's-crazy-golf', category: 'afterschool', name: 'Crazy golf on Exmouth seafront', label: 'Crazy Golf', emoji: '⛳', cost: 1, outdoor: true }),
  suggestion({ id: 's-escape-room', category: 'afterschool', name: 'Escape room in Exeter', label: 'Escape Room', emoji: '🔐', cost: 3 }),
  suggestion({ id: 's-pottery', category: 'afterschool', name: 'Pottery painting café', label: 'Pottery Paint', emoji: '🎨', cost: 2 }),
  suggestion({ id: 's-exeter-city', category: 'afterschool', name: "Exeter City match at St James' Park", label: 'Exeter City', emoji: '🏟️', cost: 2, notes: 'Look for an evening kick-off in the fixtures.' }),
  suggestion({ id: 's-pizza-night', category: 'afterschool', name: 'Make-your-own pizza night', label: 'Pizza Night', emoji: '🍕', cost: 1, home: true }),
  suggestion({ id: 's-bake-off', category: 'afterschool', name: 'Family bake-off', label: 'Bake Off', emoji: '🧁', cost: 1, home: true }),
  suggestion({ id: 's-board-games', category: 'afterschool', name: 'Board game tournament', label: 'Board Games', emoji: '🎲', cost: 0, home: true }),
  suggestion({ id: 's-blanket-fort', category: 'afterschool', name: 'Build a blanket fort and eat dinner in it', label: 'Blanket Fort', emoji: '🛋️', cost: 0, home: true }),
  suggestion({ id: 's-quiz', category: 'afterschool', name: 'Family quiz night', label: 'Quiz Night', emoji: '❓', cost: 0, home: true }),
  suggestion({ id: 's-torch-hunt', category: 'afterschool', name: 'Torch-lit treasure hunt', label: 'Torch Hunt', emoji: '🔦', cost: 0, home: true }),
  suggestion({ id: 's-gaming', category: 'afterschool', name: 'Video game tournament', label: 'Game Tourney', emoji: '🎮', cost: 0, home: true }),
  suggestion({ id: 's-garden-camp', category: 'afterschool', name: 'Camp out in the garden', label: 'Garden Camp', emoji: '🏕️', cost: 0, home: true, outdoor: true }),

  // Day out: suggestions
  suggestion({ id: 's-exe-trail', category: 'dayout', name: 'Cycle the Exe Estuary Trail to Exmouth for fish and chips', label: 'Exe Trail Ride', emoji: '🚴', cost: 1, outdoor: true }),
  suggestion({ id: 's-canoe', category: 'dayout', name: 'Canoe the Exeter Canal from the Quay', label: 'Canal Canoe', emoji: '🛶', cost: 2, outdoor: true, notes: 'Canoes can be hired on Exeter Quay.' }),
  suggestion({ id: 's-haldon', category: 'dayout', name: 'Haldon Forest bike trails and the Belvedere', label: 'Haldon Forest', emoji: '🌲', cost: 0, outdoor: true }),
  suggestion({ id: 's-dartmoor', category: 'dayout', name: 'Tor scramble and letterboxing on Dartmoor', label: 'Dartmoor Tors', emoji: '⛰️', cost: 0, outdoor: true, notes: 'Haytor is an easy one to start with.' }),
  suggestion({ id: 's-fossils', category: 'dayout', name: 'Fossil hunting at Charmouth', label: 'Fossil Hunt', emoji: '🦕', cost: 0, outdoor: true, notes: 'About an hour away on the Jurassic Coast. Check the tide times.' }),
  suggestion({ id: 's-rock-pools', category: 'dayout', name: 'Rock pooling at Ladram Bay', label: 'Rock Pools', emoji: '🦀', cost: 0, outdoor: true, notes: 'Best at low tide.' }),
  suggestion({ id: 's-paignton-zoo', category: 'dayout', name: 'Paignton Zoo', label: 'Paignton Zoo', emoji: '🦒', cost: 3, outdoor: true }),
  suggestion({ id: 's-dartmoor-zoo', category: 'dayout', name: 'Dartmoor Zoo', label: 'Dartmoor Zoo', emoji: '🐅', cost: 3, outdoor: true }),
  suggestion({ id: 's-underground', category: 'dayout', name: 'Exeter Underground Passages and the RAMM museum', label: 'Underground', emoji: '🕯️', cost: 1, notes: 'A good rainy-day pick. The RAMM is free.' }),
  suggestion({ id: 's-aquarium', category: 'dayout', name: 'National Marine Aquarium in Plymouth', label: 'Aquarium', emoji: '🦈', cost: 3 }),
  suggestion({ id: 's-chiefs', category: 'dayout', name: 'Exeter Chiefs rugby at Sandy Park', label: 'Exeter Chiefs', emoji: '🏉', cost: 3 }),
];
