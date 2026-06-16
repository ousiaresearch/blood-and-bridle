import test from 'node:test';
import assert from 'node:assert/strict';

import { TUTORIAL_STEPS, getCurrentTutorialStep, markStepComplete, dismissTutorial } from '../src/tutorial.js';
import { makeGame } from './helpers.js';
import { applyAction, createNewGame } from '../src/game.js';

test('TUTORIAL_STEPS has 5 entries, one per phase', () => {
  assert.equal(TUTORIAL_STEPS.length, 5);
  assert.equal(TUTORIAL_STEPS[0].id, 'train');
  assert.equal(TUTORIAL_STEPS[4].id, 'free');
});

test('getCurrentTutorialStep returns the train step on day 1', () => {
  const game = makeGame({ day: 1 });
  const step = getCurrentTutorialStep(game);
  assert.equal(step.id, 'train');
});

test('getCurrentTutorialStep advances to rotate on day 3', () => {
  const game = makeGame({ day: 3, tutorial: { day: 1, currentStep: 'train', completedSteps: ['train'] } });
  const step = getCurrentTutorialStep(game);
  assert.equal(step.id, 'rotate');
});

test('markStepComplete appends to the completed list', () => {
  const game = makeGame({ tutorial: { day: 1, currentStep: 'train', completedSteps: [] } });
  const after = markStepComplete(game, 'train');
  assert.deepEqual(after.tutorial.completedSteps, ['train']);
});

test('markStepComplete is idempotent', () => {
  const game = makeGame({ tutorial: { day: 1, currentStep: 'train', completedSteps: ['train'] } });
  const after = markStepComplete(game, 'train');
  assert.deepEqual(after.tutorial.completedSteps, ['train']);
});

test('dismissTutorial marks the tutorial dismissed', () => {
  const game = makeGame({ tutorial: { day: 5, currentStep: 'breed', completedSteps: ['train', 'rotate', 'breed'] } });
  const after = dismissTutorial(game);
  assert.equal(after.tutorial.dismissed, true);
  assert.equal(getCurrentTutorialStep(after), null);
});

test('getCurrentTutorialStep returns null after all steps are complete', () => {
  const game = makeGame({
    day: 12,
    tutorial: { day: 1, currentStep: 'free', completedSteps: ['train', 'rotate', 'breed', 'show', 'free'] },
  });
  assert.equal(getCurrentTutorialStep(game), null);
});

test('applyAction dismisses the tutorial when called with dismissTutorial', () => {
  const fresh = createNewGame();
  const after = applyAction(fresh, { type: 'dismissTutorial' });
  assert.equal(after.tutorial.dismissed, true);
  assert.equal(getCurrentTutorialStep(after), null);
});

test('applyAction dismissTutorial does not advance the day', () => {
  const fresh = createNewGame();
  const after = applyAction(fresh, { type: 'dismissTutorial' });
  assert.equal(after.day, fresh.day);
});
