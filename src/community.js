// Blood & Bridle — Community (Phase 5 deepening).
//
// The country corner made more tangible. The vet, the farrier, the
// chiropractor, the dentist, the feed store, the neighbors with
// their own brands and rivalries, the cattlemen's association,
// the county fair, the church.
//
// These are the people the country corner is *for*. They show up
// or they don't based on the country standing.
//
// Pure module. No DOM. No localStorage.

export const COMMUNITY_MEMBERS = Object.freeze([
  {
    id: 'vet-voss',
    name: 'Dr. Cordell Voss',
    role: 'Veterinarian',
    relationshipGate: 0,
    description: 'Honest. Expensive. Worth it when legs are at stake.',
    services: ['vet_care', 'preventive_care', 'emergency'],
    frequency: 'on_call',
  },
  {
    id: 'farrier-cooper',
    name: 'Jedediah Cooper',
    role: 'Farrier',
    relationshipGate: 15,
    description: 'Comes every six weeks. Knows every horse in the county.',
    services: ['farrier_visit', 'corrective_shoeing'],
    frequency: 'every_6_weeks',
  },
  {
    id: 'chiropractor',
    name: 'Mae Yin',
    role: 'Equine chiropractor',
    relationshipGate: 30,
    description: 'Reads a horse with her hands. Charges by the hour.',
    services: ['chiropractic', 'massage'],
    frequency: 'by_appointment',
  },
  {
    id: 'dentist',
    name: 'Dr. Ezra Bell',
    role: 'Equine dentist',
    relationshipGate: 25,
    description: 'Files the teeth. The old horse has to be sedated.',
    services: ['dental_floating', 'tooth_extraction'],
    frequency: 'annual',
  },
  {
    id: 'feed-store',
    name: 'Cora Mae Linley',
    role: 'Feed store proprietor',
    relationshipGate: 10,
    description: 'Cash terms when the bank closes the line.',
    services: ['feed_sales', 'tack_sales', 'equipment'],
    frequency: 'always_open',
  },
  {
    id: 'neighbor-granger',
    name: 'The Grangers',
    role: 'Neighboring ranch',
    relationshipGate: 20,
    description: 'Three sections south. Brand: the G-rake. Friendly rivals.',
    services: ['neighbor_help', 'shared_branding', 'dispersal_sale'],
    frequency: 'always',
    brand: 'g-rake',
  },
  {
    id: 'neighbor-calloway',
    name: 'The Calloways',
    role: 'Neighboring ranch',
    relationshipGate: 30,
    description: 'Five sections east. Brand: the broken stirrup. Quiet neighbors.',
    services: ['neighbor_help', 'shared_branding'],
    frequency: 'always',
    brand: 'broken-stirrup',
  },
  {
    id: 'cattlemen-assoc',
    name: 'County Cattlemen\'s Association',
    role: 'Industry association',
    relationshipGate: 40,
    description: 'Monthly meetings. The dues are steep. The connections are worth it.',
    services: ['dues_paid', 'auction_access', 'lobbying'],
    frequency: 'monthly',
    annualDues: 600,
  },
  {
    id: 'county-fair',
    name: 'County Fair Board',
    role: 'Local event',
    relationshipGate: 25,
    description: 'The fair is in late summer. The locals come. The judge remembers.',
    services: ['county_fair_entry', 'ribbon_award'],
    frequency: 'annual',
  },
  {
    id: 'church',
    name: 'First Methodist of Cedar Draw',
    role: 'Church',
    relationshipGate: 15,
    description: 'Sunday services. The pastor knows everyone.',
    services: ['community_gathering', 'funerals', 'weddings'],
    frequency: 'sunday',
  },
  {
    // Phase 10 — the uncle. Runs the show-grounds. Competes on the
    // circuit. Pays his own way. Not a rival in the antagonist sense.
    id: 'neighbor-william-blood',
    name: 'William Blood',
    role: 'Uncle (show-grounds)',
    relationshipGate: 0,
    description: 'The uncle. Keeps the show circuit going. You will see him at the shows.',
    services: ['show_circuit', 'family_connection'],
    frequency: 'always',
    family: true,
  },
  {
    // Phase 10 — the aunt. Married away to John Crane. The Cranes run
    // cattle on the ridge. They do not say much at the brandings.
    id: 'neighbor-edith-crane',
    name: 'Edith Crane',
    role: 'Aunt (ridge cattle)',
    relationshipGate: 0,
    description: 'The aunt. Married John Crane in 1981. The Cranes run cattle on the ridge.',
    services: ['family_connection', 'cattle_neighbor'],
    frequency: 'always',
    family: true,
  },
  {
    // Phase 10 — the Ash Coulee foreman. He shows up at the auction
    // and at the brandings. He is a real rancher with a real operation.
    id: 'neighbor-ash-coulee',
    name: 'Henry Whitehorse',
    role: 'Ash Coulee ranch foreman',
    relationshipGate: 10,
    description: 'Runs the cattle operation on the reservation. Buys at auction. Pays fair.',
    services: ['auction_buyer', 'cattle_neighbor', 'hay_trade'],
    frequency: 'seasonal',
  },
]);

// Get community members who are accessible at the current country corner.
export function availableCommunity(countryCorner) {
  return COMMUNITY_MEMBERS.filter((m) => m.relationshipGate <= countryCorner);
}

// Get community members who have dropped off (country collapse).
export function departedCommunity(countryCorner) {
  return COMMUNITY_MEMBERS.filter((m) => m.relationshipGate > countryCorner);
}

// Cost of a community service.
export const SERVICE_COSTS = Object.freeze({
  farrier_visit: 350,
  corrective_shoeing: 750,
  chiropractic: 400,
  massage: 250,
  dental_floating: 600,
  tooth_extraction: 1500,
  feed_sales: 0,           // varies
  emergency: 800,
});

// McCarthy-style community narrative. Lists who's around and who's gone.
export function communityNarrative(countryCorner) {
  const here = availableCommunity(countryCorner);
  const gone = departedCommunity(countryCorner);

  const hereNames = here.map((m) => m.name).join(', ');
  const goneNames = gone.map((m) => m.name).join(', ');

  let line = '';
  if (hereNames) {
    line += `Around the place: ${hereNames}.`;
  }
  if (goneNames) {
    line += ` ${goneNames} have stopped coming.`;
  }
  if (countryCorner < 15) {
    line += ' The community has shut its gate.';
  } else if (countryCorner > 70) {
    line += ' The community treats the place as one of its own.';
  }
  return line.trim();
}

// Get the cattlemen's association membership status.
export function cattlemenStatus(countryCorner, isMember) {
  if (countryCorner < 40) {
    return { eligible: false, reason: 'Country standing too low for membership.' };
  }
  if (!isMember) {
    return { eligible: true, reason: 'Eligible for membership. Annual dues: $600.' };
  }
  return { eligible: true, reason: 'Member in good standing.' };
}

// Schedule of community events through the year.
export const COMMUNITY_EVENTS = Object.freeze([
  { month: 3, name: 'Spring brandings', type: 'social' },
  { month: 5, name: 'Cattlemen\'s spring meeting', type: 'business' },
  { month: 7, name: 'County Fair', type: 'show' },
  { month: 9, name: 'Fall brandings', type: 'social' },
  { month: 10, name: 'Cattlemen\'s fall banquet', type: 'social' },
  { month: 11, name: 'Thanksgiving', type: 'social' },
  { month: 12, name: 'Christmas', type: 'social' },
]);

// Get events for the current month (1-12).
export function eventsForMonth(month) {
  return COMMUNITY_EVENTS.filter((e) => e.month === month);
}