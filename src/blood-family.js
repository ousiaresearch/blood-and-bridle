// Blood & Bridle — the Blood family tree.
//
// The ranch is the Blood family land. Wade Blood held it whole. He died.
// The tax took the southern half. The estate was divided. The player
// is the grandchild who came back.
//
// This is data, not a quest. The dispersal shows up in:
//   - the intro (4 lines, first-person, voiced)
//   - the parcels (each has a previousOwner)
//   - the auction (Cobb Blood and Henry Whitehorse are bidders)
//   - the community (William Blood and Edith Crane are members)
//   - the slow-time fragments (one or two lines about the family)
//
// Sheridan, not McCarthy. The family has voices. They speak in the
// bunkhouse. They show up at the auction. They don't ask for help and
// they don't offer it. They exist.
//
// Pure module. No DOM. No localStorage.

export const FAMILY_NAME = 'Blood';

// The patriarch. Dead before the game begins.
export const PATRIARCH = Object.freeze({
  name: 'Wade Blood',
  born: 1932,
  died: 2022,
  epitaph: 'Held the land whole for forty years. Owed on it at the end.',
});

// The Blood children. The three of them inherited the ranch.
export const BLOOD_CHILDREN = Object.freeze([
  {
    id: 'bo-blood',
    name: 'Bo Blood',
    relation: 'father',
    status: 'estranged',
    detail: 'Lives in town. Does not visit. Does not call. The land was never his.',
  },
  {
    id: 'william-blood',
    name: 'William Blood',
    relation: 'uncle',
    status: 'show-grounds',
    detail: 'Runs the show-grounds. Competes on the circuit. Pays his own way.',
  },
  {
    id: 'edith-blood-crane',
    name: 'Edith Crane',
    maidenName: 'Blood',
    relation: 'aunt',
    status: 'married-away',
    detail: 'Married John Crane in 1981. The Cranes run cattle on the ridge.',
  },
]);

// The Blood grandchildren. The cousin is the only one who holds land.
export const BLOOD_GRANDCHILDREN = Object.freeze([
  {
    id: 'player',
    name: 'You',
    relation: 'heir',
    status: 'inherited',
    detail: 'Bo\'s child. Bought back home and back-forty with the inheritance.',
  },
  {
    id: 'cobb-blood',
    name: 'Cobb Blood',
    relation: 'cousin',
    status: 'owns-creek',
    detail: 'William\'s son. Runs a small dispersaler operation out of the creek.',
  },
]);

// The dispersal map. Each parcel of the original Blood & Bridle
// estate, with the buyer after Wade's death.
//
// The player has 2 (home, back-forty). The other 4 working parcels
// went to family, family, family, developer. West-meadow is the
// developer's pending offer.
export const PARCEL_DISPERSAL = Object.freeze({
  'home-place': {
    previousOwner: 'Blood & Bridle',
    previousOwnerNote: 'Original homestead. Held by the family since 1962.',
    currentOwner: 'You',
  },
  'back-forty': {
    previousOwner: 'Blood & Bridle',
    previousOwnerNote: 'Original working land. Bought back from the estate.',
    currentOwner: 'You',
  },
  'cedar-draw': {
    previousOwner: 'Cobb Blood',
    previousOwnerNote: 'Sold to the cousin in 2023. He runs a small dispersaler operation.',
    currentOwner: 'Cobb Blood',
  },
  'north-ridge': {
    previousOwner: 'Edith Crane',
    previousOwnerNote: 'Sold to the Cranes in 2023. They run cattle.',
    currentOwner: 'Edith Crane',
  },
  'show-grounds': {
    previousOwner: 'William Blood',
    previousOwnerNote: 'Sold to the uncle in 2023. He keeps the show circuit going.',
    currentOwner: 'William Blood',
  },
  'breeding-shed': {
    previousOwner: 'Blackwood Development',
    previousOwnerNote: 'Sold to the developer in 2024. He is parceling it.',
    currentOwner: 'Blackwood Development',
  },
  'west-meadow': {
    previousOwner: 'Blackwood Development (pending)',
    previousOwnerNote: 'The developer has an offer in escrow. He wants to flip it.',
    currentOwner: 'Blackwood Development (pending)',
  },
});

// The Ash Coulee Nation. The bordering tribal land to the west.
// Fictional. Real-feeling. They are not a symbol, not a token,
// not a plot. They are a neighbor with a ranch.
//
// We do not name a real tribe. We do not invoke treaties, grievances,
// or historical claims. We depict a working ranching operation
// and a person who shows up at the auction.
export const ASH_COULEE = Object.freeze({
  id: 'ash-coulee',
  nationName: 'Ash Coulee Nation',
  ranchName: 'Ash Coulee Cattle Co.',
  detail: 'The bordering tribal land to the west. They run a cattle and horse operation. Their foreman shows up at the auction sometimes.',
});

// The recurring Ash Coulee character. He is a buyer, a community
// member, and a name in the weather/market news.
export const HENRY_WHITEHORSE = Object.freeze({
  id: 'henry-whitehorse',
  name: 'Henry Whitehorse',
  role: 'Ash Coulee ranch foreman',
  detail: 'Runs the cattle operation on the reservation. Buys at auction. Pays fair.',
});

// The 4-line Sheridan intro. First-person, voiced. The player
// speaking. The grandfather's line is the one thing the player
// keeps from the family.
//
// The intro is shown on the title card for 4 seconds, then the
// game starts. The bowed-cello memorial tone plays at low volume.
export const SHERIDAN_INTRO = Object.freeze({
  lines: [
    'He used to say the land was older than any of us.',
    'He died owing on it.',
    'The tax took the southern half.',
    'I bought back the two pieces they didn\'t think I could afford.',
  ],
  speaker: 'You',
  durationMs: 4000,
});

// Family mention lines, in fragment form. Used in slow-time moments
// and weather/market news. Sheridan — these are voices, not data.
export const FAMILY_MENTION_LINES = Object.freeze([
  'Your cousin Cobb came by yesterday. Asked about you. I told him you were busy.',
  'William is showing a three-year-old at the county fair. The judge remembers him.',
  'The Cranes are rotating cattle early this year. Edith\'s husband John does the work.',
  'Your pa is in town. Saw him at the feed store. He asked how the ranch was doing. I told him fine.',
  'The Cranes came to the branding. Brought their own horses. Edith did not look at you.',
  'Cobb is selling a mare out of the creek. He will be at the auction.',
]);

// Rival list. The user asked for: family, developers, the tribe.
// This is the canonical list, used for reference and tests.
export const RIVALS = Object.freeze([
  { id: 'william-blood', type: 'family', name: 'William Blood', parcel: 'show-grounds' },
  { id: 'cobb-blood', type: 'family', name: 'Cobb Blood', parcel: 'cedar-draw' },
  { id: 'edith-crane', type: 'family', name: 'Edith Crane', parcel: 'north-ridge' },
  { id: 'blackwood', type: 'developer', name: 'Blackwood Development', parcel: 'breeding-shed' },
  { id: 'ash-coulee', type: 'tribe', name: 'Ash Coulee Nation', parcel: null },
]);
