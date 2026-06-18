// Blood & Bridle — kitchen table scenes.
//
// A scene is what fires at the moment of a critical decision. The
// player is at the kitchen table. Two or three hands are there.
// Each speaks in their own voice (src/hands-voice.js). The player
// then picks from 2-3 choices, each with reputation and morale
// effects.
//
// Scene anatomy:
//   {
//     id:           unique key
//     label:        short title for the modal
//     trigger:      'action:<type>' | 'event:<id>' | 'moral:<category>' | 'manual'
//     season:       'spring' | 'summer' | 'autumn' | 'winter' | 'any'
//     background:   path to scene composition (or null → CSS fallback)
//     speakers:     ordered list of { handId, topic, composition,
//                                  topicLines: { neutral, advocating } }
//     setup:        short line setting the scene (e.g. "It's late.")
//     choices:      list of { id, label, effects }
//   }
//
// Pure module. No DOM. The kitchen-table modal (src/app.js) renders
// the speakers into portrait frames, the setup as a stage direction,
// and the choices as buttons. After the player picks, the effects
// land on the game state via the existing moral/crew/economy hooks.

import { renderHandLine, HAND_VOICES } from './hands-voice.js';

// Twelve scenes. Each tied to a real choice the player can make.
export const KITCHEN_SCENES = Object.freeze([
  // ── Moral economy: skip-the-obligation scenes ─────────────────────
  {
    id: 'skip-farrier',
    label: 'Skip the farrier',
    trigger: 'moral:farrier',
    season: 'spring',
    background: '/assets/scenes/bunkhouse/bunkhouse_spring.png',
    setup: 'Coffee on the stove. Nobody is drinking it.',
    speakers: [
      {
        handId: 'mae',
        topic: 'farrier',
        composition: 'open-and-line',
        topicLines: {
          neutral: 'Foal feet don\'t forgive. You skip it now, you pay at the sale.',
          advocating: 'I\'m not letting this happen. The foals go lame, they\'re done. We are done.',
        },
      },
      {
        handId: 'elena',
        topic: 'farrier',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'Three hundred dollars. A foal with foot rot is two months out and a vet bill on top.',
          advocating: 'Three hundred. A foal down is a thousand. Your call, but it\'s in the column either way.',
        },
      },
      {
        handId: 'eli',
        topic: 'farrier',
        composition: 'singleton',
        topicLines: {
          neutral: 'It\'s just — ',
          advocating: 'It\'s just money. The feet aren\'t money.',
        },
      },
    ],
    choices: [
      { id: 'pay',   label: 'Pay the farrier. The foals are the ranch.', effects: { cash: -300, country: +1 } },
      { id: 'skip',  label: 'Skip it. We\'ll be careful.', effects: { cash: +0, country: -2, crew: -1, moralRisk: 'farrier' } },
      { id: 'half',  label: 'Pay for the foals only.', effects: { cash: -120, crew: -1 } },
    ],
  },
  {
    id: 'delay-wages',
    label: 'Delay hand wages',
    trigger: 'moral:wages',
    season: 'autumn',
    background: '/assets/scenes/bunkhouse/bunkhouse_fall.png',
    setup: 'End of the month. The envelope sits on the table, unstuffed.',
    speakers: [
      {
        handId: 'eli',
        topic: 'wages',
        composition: 'open-and-line',
        topicLines: {
          neutral: 'I don\'t — you probably already thought of this.',
          advocating: 'I got rent. I been patient. I can\'t be much more patient.',
        },
      },
      {
        handId: 'elena',
        topic: 'wages',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'Two weeks. The spreadsheet shows what happens if we slide another two weeks.',
          advocating: 'One more delay and I\'m putting it in the log. The hands\' morale is already a number.',
        },
      },
    ],
    choices: [
      { id: 'pay',  label: 'Pay them. The hands keep the ranch.', effects: { cash: -2400, crew: +3 } },
      { id: 'wait', label: 'Wait one more week.', effects: { cash: +0, crew: -3, moralRisk: 'wages' } },
    ],
  },
  {
    id: 'skip-tax',
    label: 'Skip the property tax',
    trigger: 'moral:property_tax',
    season: 'winter',
    background: '/assets/scenes/bunkhouse/bunkhouse_winter.png',
    setup: 'The county envelope. Unopened on the table for a week now.',
    speakers: [
      {
        handId: 'elena',
        topic: 'developerDeal',
        composition: 'full',
        topicLines: {
          neutral: 'Quarterly installment. If we skip, the bank corner drops twelve. The county is a different animal.',
          advocating: 'Don\'t do it. I\'ll find a way to move money around. Don\'t skip the tax.',
        },
      },
      {
        handId: 'mae',
        topic: 'developerDeal',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'This is the ranch. The tax is the ranch.',
          advocating: 'You skip the tax, you lose the land. I can\'t train horses on a foreclosed place.',
        },
      },
    ],
    choices: [
      { id: 'pay',  label: 'Pay the tax. The land is the land.', effects: { cash: -1200, bank: +1 } },
      { id: 'skip', label: 'Skip it. We\'ll deal with the county.', effects: { cash: +0, bank: -8, moralRisk: 'property_tax' } },
    ],
  },
  {
    id: 'skip-vet',
    label: 'Skip the vet for the sick one',
    trigger: 'moral:veterinary',
    season: 'any',
    background: '/assets/scenes/bunkhouse/kitchen_table_winter.png',
    setup: 'Voss on the radio. The horse is down in the north paddock.',
    speakers: [
      {
        handId: 'mae',
        topic: 'vetCare',
        composition: 'open-and-line',
        topicLines: {
          neutral: 'I\'ve seen this. It goes one of two ways. Voss can tell you which.',
          advocating: 'Don\'t ask me to watch a horse die to save a phone call.',
        },
      },
      {
        handId: 'reyes',
        topic: 'vetCare',
        composition: 'singleton',
        topicLines: {
          neutral: 'The horse is telling us. I don\'t know what else to say.',
          advocating: 'The horse is telling us. The horse is always telling us.',
        },
      },
    ],
    choices: [
      { id: 'call',  label: 'Call Voss. The horse pays its way.', effects: { cash: -2600, horsemen: +1, crew: +2 } },
      { id: 'wait',  label: 'Wait one more day.', effects: { cash: +0, horseRisk: 0.35, moralRisk: 'veterinary' } },
    ],
  },

  // ── Hands: people-scene decisions ────────────────────────────────
  {
    id: 'fire-tucker',
    label: 'Fire The Kid',
    trigger: 'event:fireDayWorker',
    season: 'any',
    background: '/assets/scenes/bunkhouse/kitchen_table_summer.png',
    setup: 'Tucker let the heifer out again. The gate was right there.',
    speakers: [
      {
        handId: 'mae',
        topic: 'newHand',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'He\'s young. He\'s also careless. There\'s a line and he\'s been on it.',
          advocating: 'I can\'t run a barn where the day-worker doesn\'t close gates. It\'s me or him.',
        },
      },
      {
        handId: 'eli',
        topic: 'newHand',
        composition: 'singleton',
        topicLines: {
          neutral: 'I was the kid once.',
          advocating: 'I was the kid once. I closed the gate.',
        },
      },
    ],
    choices: [
      { id: 'fire',   label: 'Fire him. The barn doesn\'t run on potential.', effects: { dayWorkerGone: 'tucker', crew: -2 } },
      { id: 'warn',   label: 'Warn him. One last time.', effects: { crew: -1 } },
      { id: 'keep',   label: 'Keep him. The kid\'s a kid.', effects: { country: -1, horsemen: -1 } },
    ],
  },
  {
    id: 'give-eli-winter-off',
    label: 'Give Eli the winter off',
    trigger: 'event:winterLayoff',
    season: 'winter',
    background: '/assets/scenes/bunkhouse/bunkhouse_winter.png',
    setup: 'There\'s not enough winter work. Either Eli goes home, or someone else does.',
    speakers: [
      {
        handId: 'eli',
        topic: 'wages',
        composition: 'singleton',
        topicLines: {
          neutral: 'I know how winter works.',
          advocating: 'I got a sister in town. I can go. Just — keep me on for spring.',
        },
      },
      {
        handId: 'mae',
        topic: 'wages',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'It\'s the right call, financially.',
          advocating: 'Don\'t lose Eli. He\'s the one who knows where the water line breaks.',
        },
      },
    ],
    choices: [
      { id: 'eli',     label: 'Send Eli home. He can come back in spring.', effects: { cash: +800, crew: -2 } },
      { id: 'tucker',  label: 'Lay off Tucker instead.', effects: { dayWorkerGone: 'tucker', cash: +400, country: -1 } },
      { id: 'keepAll', label: 'Keep everyone on. Eat the cost.', effects: { cash: -1200, crew: +4, bank: -2 } },
    ],
  },
  {
    id: 'promote-tucker',
    label: 'Make Tucker a hand',
    trigger: 'event:promoteDayWorker',
    season: 'any',
    background: '/assets/scenes/bunkhouse/kitchen_table_summer.png',
    setup: 'He\'s been closing the gates. He\'s been on time.',
    speakers: [
      {
        handId: 'mae',
        topic: 'newHand',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'He\'s grown up some. I\'ll give him that.',
          advocating: 'He can ride now. He can\'t start colts yet, but he can ride.',
        },
      },
      {
        handId: 'eli',
        topic: 'newHand',
        composition: 'singleton',
        topicLines: {
          neutral: 'I\'d take him as a partner.',
          advocating: 'I\'d take him as a partner. He listens.',
        },
      },
    ],
    choices: [
      { id: 'promote', label: 'Make him a hand. Wage goes up, but so does loyalty.', effects: { hireHand: 'tucker', wageCostPerSeason: 400, crew: +4, country: +1 } },
      { id: 'keep',    label: 'Keep him on day-rate. Don\'t commit yet.', effects: { crew: +1 } },
    ],
  },

  // ── Money: deals and contracts ───────────────────────────────────
  {
    id: 'take-loan',
    label: 'Take the bank loan',
    trigger: 'event:bankLoanOffer',
    season: 'winter',
    background: '/assets/scenes/bunkhouse/bunkhouse_winter.png',
    setup: 'The banker came by. There\'s money on the table.',
    speakers: [
      {
        handId: 'elena',
        topic: 'buyLand',
        composition: 'full',
        topicLines: {
          neutral: 'Six percent. Three years. I\'ll model the payments. They\'re not small.',
          advocating: 'Don\'t take it unless you know what it\'s for. Loans without a target are how ranches die.',
        },
      },
      {
        handId: 'mae',
        topic: 'buyLand',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'Money in the bank is one thing. Money owed is another.',
          advocating: 'If we\'re borrowing to feed horses, I don\'t want to be here in March.',
        },
      },
    ],
    choices: [
      { id: 'take',  label: 'Take the loan. The west meadow needs buying.', effects: { cash: +8000, loanDebt: +8000, bank: -3 } },
      { id: 'pass',  label: 'Pass. We\'ll make it through.', effects: { bank: +1 } },
    ],
  },
  {
    id: 'sell-mare',
    label: 'Sell the mare',
    trigger: 'event:privateOffer',
    season: 'any',
    background: '/assets/scenes/bunkhouse/kitchen_table_winter.png',
    setup: 'A buyer is in the driveway. The mare is in the barn.',
    speakers: [
      {
        handId: 'reyes',
        topic: 'sellHorse',
        composition: 'full',
        topicLines: {
          neutral: 'She\'s a good mare. She\'s not her best anymore.',
          advocating: 'She\'s a good mare. Don\'t let the price talk you out of that.',
        },
      },
      {
        handId: 'mae',
        topic: 'sellHorse',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'We can finish her on the show circuit, or we can sell. The number is the number.',
          advocating: 'If you sell her, sell her to someone who\'ll keep her in the barn at night.',
        },
      },
    ],
    choices: [
      { id: 'sell',  label: 'Sell her. The number covers the hay bill.', effects: { cash: +12000, horsemen: -2 } },
      { id: 'keep',  label: 'Keep her. We\'ll make the show circuit work.', effects: { horsemen: +2, crew: +1 } },
      { id: 'counter', label: 'Counter at fifteen. See if they bite.', effects: { cash: +8000, crew: +1 } },
    ],
  },
  {
    id: 'sell-stallion',
    label: 'Sell the stallion',
    trigger: 'event:stallionOffer',
    season: 'any',
    background: '/assets/scenes/bunkhouse/bunkhouse_fall.png',
    setup: 'Texas money. A number that makes the whole winter feel different.',
    speakers: [
      {
        handId: 'reyes',
        topic: 'sellHorse',
        composition: 'full',
        topicLines: {
          neutral: 'The stallion — I won\'t say. You know what he is.',
          advocating: 'Don\'t do it. The colts we haven\'t bred yet are the next ten years.',
        },
      },
      {
        handId: 'mae',
        topic: 'sellHorse',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'It\'s a one-time number for a ten-year asset.',
          advocating: 'Reyes is right. We don\'t recover from this in five years.',
        },
      },
    ],
    choices: [
      { id: 'sell',  label: 'Sell. The ranch needs the cash.', effects: { cash: +28000, horsemen: -5, crew: -3 } },
      { id: 'keep',  label: 'Keep him. The line continues.', effects: { horsemen: +3, crew: +2 } },
    ],
  },
  {
    id: 'sign-contract',
    label: 'Sign the developer\'s offer',
    trigger: 'event:developerOffer',
    season: 'any',
    background: '/assets/scenes/bunkhouse/bunkhouse_summer.png',
    setup: 'Their lawyer is in the kitchen. The check is in their briefcase.',
    speakers: [
      {
        handId: 'mae',
        topic: 'developerDeal',
        composition: 'full',
        topicLines: {
          neutral: 'I won\'t work a place that\'s being paved.',
          advocating: 'I won\'t work a place that\'s being paved. That\'s not a metaphor.',
        },
      },
      {
        handId: 'eli',
        topic: 'developerDeal',
        composition: 'singleton',
        topicLines: {
          neutral: 'The west meadow is ours.',
          advocating: 'My grandfather worked that meadow. The west meadow is ours.',
        },
      },
    ],
    choices: [
      { id: 'sign',   label: 'Sign. The west meadow goes for development.', effects: { cash: +42000, horsemen: -10, country: -5, loseParcel: 'west-meadow' } },
      { id: 'refuse', label: 'Refuse. The land stays.', effects: { horsemen: +2, country: +3 } },
    ],
  },

  // ── End-of-season: legacy moment ─────────────────────────────────
  {
    id: 'end-season-broke',
    label: 'End of season: broke',
    trigger: 'event:seasonEndBroke',
    season: 'any',
    background: '/assets/scenes/bunkhouse/bunkhouse_winter.png',
    setup: 'Coffee\'s cold. The ledger\'s open. The number doesn\'t work.',
    speakers: [
      {
        handId: 'elena',
        topic: 'wages',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'I can stretch one more season. After that, I can\'t.',
          advocating: 'I can stretch one more season. After that, the spreadsheet stops working.',
        },
      },
      {
        handId: 'mae',
        topic: 'wages',
        composition: 'singleton',
        topicLines: {
          neutral: 'I\'ll keep showing up.',
          advocating: 'I\'ll keep showing up. That\'s all I can promise.',
        },
      },
    ],
    choices: [
      { id: 'next-season', label: 'Try again next season.', effects: { season: 'continue', legacy: +1 } },
      { id: 'sell-out',    label: 'Sell out. Pass the brand to whoever buys.', effects: { gameOver: 'sellout' } },
    ],
  },
  {
    id: 'buy-west-meadow',
    label: 'Buy the west meadow',
    trigger: 'event:westMeadowOffer',
    season: 'any',
    background: '/assets/scenes/bunkhouse/bunkhouse_summer.png',
    setup: 'The paperwork is on the table. The number is the number.',
    speakers: [
      {
        handId: 'mae',
        topic: 'buyLand',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'More land is more horse. The math is the math.',
          advocating: 'Buy it. The west meadow is the ranch\'s whole west side.',
        },
      },
      {
        handId: 'elena',
        topic: 'buyLand',
        composition: 'singleton',
        topicLines: {
          neutral: 'The debt service is the question.',
          advocating: 'I\'ll make the debt service work. Don\'t pass on this one.',
        },
      },
    ],
    choices: [
      { id: 'buy',  label: 'Buy the meadow. The ranch grows.', effects: { cash: -16000, gainParcel: 'west-meadow', horsemen: +3, bank: -2 } },
      { id: 'pass', label: 'Pass. We can\'t afford the debt.', effects: { bank: +1 } },
    ],
  },
// ── Heir transition scenes (Phase 13) ───────────────────────────
  {
    // The first heir to take over — when the player transitions, the
    // heir sits at the kitchen table. The hands are still there. The
    // heir has to speak.
    id: 'heir-arrival',
    label: 'The heir takes over',
    trigger: 'event:heirArrival',
    season: 'any',
    background: '/assets/scenes/heirs/heir_arrival.png',
    setup: 'The coffee is fresh. The table is set for one more than usual.',
    speakers: [
      {
        handId: 'mae',
        topic: 'newHand',
        composition: 'open-and-line',
        topicLines: {
          neutral: 'They\'ve been watching you for ten years. They know the operation.',
          advocating: 'They\'ve been watching you for ten years. They know the operation better than you did at their age.',
        },
      },
      {
        handId: 'eli',
        topic: 'newHand',
        composition: 'singleton',
        topicLines: {
          neutral: 'The bank is going to want to meet them.',
          advocating: 'The bank is going to want to meet them. Take the meeting yourself, the first time.',
        },
      },
    ],
    choices: [
      { id: 'pass-the-brand', label: 'Pass the brand.', effects: { transitionToHeir: true, legacy: +2 } },
      { id: 'decline',        label: 'Not yet. One more season.', effects: { legacy: -1 } },
    ],
  },
  {
    // The heir hands off the ranch to THEIR heir. Two generations in.
    // Used only after at least one heir transition has happened.
    id: 'heir-departure',
    label: 'The heir hands off',
    trigger: 'event:heirDeparture',
    season: 'any',
    background: '/assets/scenes/heirs/heir_departure.png',
    setup: 'Same table. New face across it. The brand is the same.',
    speakers: [
      {
        handId: 'elena',
        topic: 'developerDeal',
        composition: 'line-and-close',
        topicLines: {
          neutral: 'The next one will want the same things you wanted. The math is the math.',
          advocating: 'The next one will want the same things you wanted. The math is the math. Don\'t forget the math.',
        },
      },
      {
        handId: 'mae',
        topic: 'sellHorse',
        composition: 'singleton',
        topicLines: {
          neutral: 'The horses don\'t know the difference.',
          advocating: 'The horses don\'t know the difference. The hands will.',
        },
      },
    ],
    choices: [
      { id: 'hand-off', label: 'Hand it off.', effects: { transitionToHeir: true, legacy: +3 } },
      { id: 'stay',     label: 'One more year in the chair.', effects: { legacy: -1, country: -1 } },
    ],
  },
  {
    // The heir sits at the kitchen table with the hands. The brand
    // is the same but the chair is empty where the original owner
    // used to sit.
    id: 'heir-kitchen-table',
    label: 'At the kitchen table, again',
    trigger: 'event:heirKitchenTable',
    season: 'any',
    background: '/assets/scenes/heirs/heir_kitchen_table.png',
    setup: 'The brand is in the same place. The chair is empty. The hands are quiet.',
    speakers: [
      {
        handId: 'reyes',
        topic: 'skipTraining',
        composition: 'singleton',
        topicLines: {
          neutral: 'The stallions are the same. They don\'t care who\'s in the chair.',
          advocating: 'The stallions are the same. They don\'t care who\'s in the chair. That\'s the point.',
        },
      },
      {
        handId: 'mae',
        topic: 'newHand',
        composition: 'open-and-line',
        topicLines: {
          neutral: 'I\'ve been here longer than you. You\'ll be alright.',
          advocating: 'I\'ve been here longer than you. You\'ll be alright. Listen to the hands, listen to the horses.',
        },
      },
    ],
    choices: [
      { id: 'continue-the-work', label: 'Continue the work.', effects: { legacy: +1, country: +2 } },
      { id: 'sit-quiet',         label: 'Sit with it for a minute.', effects: { country: +1 } },
    ],
  },
]);

// Lookup.
export function sceneById(id) {
  return KITCHEN_SCENES.find((s) => s.id === id) ?? null;
}

// Find a scene for a given trigger. Returns the first matching scene.
// Use this when an action fires (e.g. moral:farrier) to find what
// scene should play.
export function sceneForTrigger(trigger) {
  return KITCHEN_SCENES.find((s) => s.trigger === trigger) ?? null;
}

// Resolve the dialogue for a scene, given current hand morale.
// Returns an ordered list of { handId, line, mood } for the modal to
// render. Hands below their speaksBelow threshold are skipped. Topic
// lines that aren't authored fall back to stance-driven defaults.
export function resolveSceneDialogue(scene, hands) {
  const lines = [];
  for (const speaker of scene.speakers ?? []) {
    const hand = hands.find((h) => h.id === speaker.handId);
    if (!hand) continue;
    const line = renderHandLine(speaker.handId, speaker.topic, {
      morale: hand.morale,
      topicLines: speaker.topicLines,
      composition: speaker.composition,
    });
    if (!line) continue;
    const advocate = hand.morale >= (voiceGatesFor(speaker.handId)?.advocatesAbove ?? 100);
    lines.push({
      handId: speaker.handId,
      handName: hand.name,
      line,
      mood: advocate ? 'advocating' : 'neutral',
    });
  }
  return lines;
}

function voiceGatesFor(handId) {
  // Tiny helper so resolveSceneDialogue doesn't need to repeat the
  // shape. Imported at the top of the module.
  return HAND_VOICES[handId]?.moraleGates;
}