// Blood & Bridle — the hands' stories (Phase 7).
//
// The hands remember. They are not tropes. They have histories,
// and the histories surface in silences. Eli remembers the horse
// that died. Mae remembers the colt she couldn't save. Reyes
// remembers the stallion that put him in the hospital. Elena
// remembers why she left the city.
//
// Pure module. No DOM. No localStorage.

export const HAND_BACKSTORIES = Object.freeze({
  mae: {
    origin: 'A reining barn in Texas. Her trainer was her father.',
    wound: 'Lost a colt to colic at sixteen. Never rode a horse the same way again.',
    quietTruth: 'She could have had her own place. She chose to stay and be the one who stays.',
    fragment: 'Mae remembers the colt. Every colt. The ones that die are the ones she remembers longest.',
  },
  eli: {
    origin: 'Born on the next ranch over. Knows every fence line.',
    wound: 'His father sold the place to a developer when Eli was twenty-two. He stayed on as a hand.',
    quietTruth: 'He wanted the place. He never said it out loud.',
    fragment: 'Eli knows what a sold place looks like. He does not want to see another one.',
  },
  reyes: {
    origin: 'Came up from the reservation. Reads stallions like sentences.',
    wound: 'A stallion put him in the hospital for six months. He went back to the stallions.',
    quietTruth: 'He carries the horse that hurt him. He has not named it.',
    fragment: 'Reyes does not talk about the hospital. He talks about the horse that put him there.',
  },
  elena: {
    origin: 'Came out from the city two winters ago. Brought the spreadsheet.',
    wound: 'She left a marriage. She does not say which kind.',
    quietTruth: 'She came to the place to learn what work feels like when it matters.',
    fragment: 'Elena counts the hay bales. She has not counted anything that mattered in a long time.',
  },
  'cordell-voss': {
    origin: 'A ranch kid who went to vet school. Came back.',
    wound: 'Lost his daughter to a car accident at seven. The horses are how he carries it.',
    quietTruth: 'He charges what he charges so the place can afford to call him.',
    fragment: 'Dr. Voss looks at the horses the way other men look at children. He does not explain.',
  },
});

// Generate a "silence" — a McCarthy-style log line that surfaces
// a hand's backstory in a quiet moment. Used by the season tick.
export function handSilence(handId, season, randomFn = Math.random) {
  const story = HAND_BACKSTORIES[handId];
  if (!story) return null;
  const fragments = [
    story.fragment,
    story.wound,
    story.quietTruth,
  ];
  return fragments[Math.floor(randomFn() * fragments.length)];
}

// Generate a silence for the season tick. Picks one of the working
// hands at random and returns their fragment.
export function seasonSilence(workingHands, season, randomFn = Math.random) {
  if (!workingHands || workingHands.length === 0) return null;
  const hand = workingHands[Math.floor(randomFn() * workingHands.length)];
  const silence = handSilence(hand.id, season, randomFn);
  if (!silence) return null;
  return {
    handId: hand.id,
    handName: hand.name,
    silence,
  };
}

// Test whether a hand has shared their story with the player yet.
// Used to prevent the same fragment from repeating.
export function hasSharedStory(hand, storyKey) {
  return (hand.sharedStories ?? []).includes(storyKey);
}

// Mark a story as shared.
export function markStoryShared(hand, storyKey) {
  return {
    ...hand,
    sharedStories: [...(hand.sharedStories ?? []), storyKey].slice(-10),
  };
}