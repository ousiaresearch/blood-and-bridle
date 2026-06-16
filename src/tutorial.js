// Onboarding tutorial. First 10 in-game days, the ranch has a step-by-step
// guide. Each step has a goal action and a hint. Once all steps complete,
// the tutorial is dismissed and the player has full agency.

export const TUTORIAL_STEPS = [
  {
    id: 'train',
    day: 1,
    title: 'Train a horse',
    body: 'You have a horse, you have a trainer, you have a show to win. Train any horse today.',
    goal: { type: 'train' },
    hint: 'Click "Train a horse" in the right panel. Mae or Eli will work with the selected horse.',
  },
  {
    id: 'rotate',
    day: 3,
    title: 'Rotate the pasture',
    body: 'Land needs rest. Rotate the herd through fresh pasture to lower stress and restore forage.',
    goal: { type: 'rotatePasture' },
    hint: 'Click "Rotate pasture". Every horse drops 13 stress. Every parcel gains 9 forage.',
  },
  {
    id: 'breed',
    day: 5,
    title: 'Breed your first foal',
    body: 'This is the loop. A foal you breed today is a campaigner in four years. Pick a stallion and a mare.',
    goal: { type: 'breed' },
    hint: 'Use the breeding panel below the horses. The foal arrives 11 in-game days later with both parents recorded.',
  },
  {
    id: 'show',
    day: 7,
    title: 'Read the show circuit',
    body: 'Twenty shows across five years. Four per year, one per season. The next one is on the calendar.',
    goal: { type: 'viewShow' },
    hint: 'Look at the "Show circuit" panel. Shows are how training turns into reputation, cash, and legacy.',
  },
  {
    id: 'free',
    day: 10,
    title: 'You are free',
    body: 'Five years. Twenty shows. Six horses that age and die. One legacy. Use it well.',
    goal: { type: 'tutorialComplete' },
    hint: 'No more hints. The ranch is yours.',
  },
];

export function getCurrentTutorialStep(game) {
  if (!game.tutorial || game.tutorial.dismissed) return null;
  for (const step of TUTORIAL_STEPS) {
    if (game.day >= step.day && !game.tutorial.completedSteps.includes(step.id)) {
      return step;
    }
  }
  return null;
}

export function isStepComplete(step, lastAction) {
  if (!step || !lastAction) return false;
  if (step.goal.type === 'viewShow') {
    return game_log_mentions_show(lastAction);
  }
  if (step.goal.type === 'tutorialComplete') {
    return true; // day 10 step is automatically satisfied
  }
  return lastAction.type === step.goal.type;
}

function game_log_mentions_show(lastAction) {
  return lastAction.type === 'viewShow';
}

export function markStepComplete(game, stepId) {
  if (!game.tutorial) return game;
  if (game.tutorial.completedSteps.includes(stepId)) return game;
  return {
    ...game,
    tutorial: { ...game.tutorial, completedSteps: [...game.tutorial.completedSteps, stepId] },
  };
}

export function dismissTutorial(game) {
  return { ...game, tutorial: { ...game.tutorial, dismissed: true } };
}
