import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_TEMPLATES,
  SALE_TEMPLATES,
  generateContractOffer,
  acceptContract,
  declineContract,
  tickContracts,
} from '../src/contracts.js';
import { createNewGame } from '../src/game.js';
import { makeGame } from './helpers.js';

test('BOARD_TEMPLATES has at least 3 entries', () => {
  assert.ok(BOARD_TEMPLATES.length >= 3);
});

test('SALE_TEMPLATES has at least 3 entries', () => {
  assert.ok(SALE_TEMPLATES.length >= 3);
});

test('generateContractOffer returns null on non-multiple-of-30 days', () => {
  const game = makeGame({ day: 5 });
  assert.equal(generateContractOffer(game), null);
});

test('generateContractOffer returns a board or sale offer on day 30', () => {
  const game = makeGame({ day: 30 });
  // Force a deterministic choice: rng returns 0.1 → board (60% threshold is 0.6, so 0.1 < 0.6 = board)
  const offer = generateContractOffer(game, () => 0.1);
  assert.ok(offer);
  assert.equal(offer.type, 'board');
});

test('generateContractOffer returns a sale offer when rng is high', () => {
  const game = makeGame({ day: 30 });
  const offer = generateContractOffer(game, () => 0.99);
  assert.ok(offer);
  assert.equal(offer.type, 'sale');
});

test('generateContractOffer returns null if 3+ contracts are active', () => {
  const game = makeGame({ day: 30, contracts: [{}, {}, {}] });
  assert.equal(generateContractOffer(game), null);
});

test('acceptContract marks the contract as active', () => {
  const game = makeGame({ contracts: [{ id: 'c1', type: 'board', template: 'X' }] });
  const after = acceptContract(game, 'c1');
  assert.equal(after.contracts[0].status, 'active');
});

test('acceptContract throws on unknown id', () => {
  const game = makeGame({ contracts: [] });
  assert.throws(() => acceptContract(game, 'ghost'));
});

test('acceptContract on a sale contract checks the horse is still in the herd', () => {
  const game = makeGame({ contracts: [{ id: 'c1', type: 'sale', horseId: 'ghost', horseName: 'Ghost' }] });
  assert.throws(() => acceptContract(game, 'c1'));
});

test('declineContract removes the contract from the list', () => {
  const game = makeGame({ contracts: [{ id: 'c1', type: 'board' }, { id: 'c2', type: 'sale' }] });
  const after = declineContract(game, 'c1');
  assert.equal(after.contracts.length, 1);
  assert.equal(after.contracts[0].id, 'c2');
});

test('tickContracts pays out the monthly board fee at day 30 mark', () => {
  const game = makeGame({
    contracts: [{
      id: 'c1',
      type: 'board',
      template: 'Pleasure horse board',
      duration: 60,
      monthlyFee: 1100,
      daysRemaining: 30,
      status: 'active',
    }],
  });
  const { game: after, payouts } = tickContracts(game);
  assert.equal(payouts, 1100);
  assert.equal(after.cash, game.cash + 1100);
  assert.equal(after.contracts[0].daysRemaining, 29);
});

test('tickContracts completes a sale contract when daysRemaining hits 0', () => {
  const game = makeGame({
    horses: [{ id: 'h1', name: 'SaleHorse', value: 10000, age: 6 }],
    contracts: [{
      id: 'c1',
      type: 'sale',
      template: 'Standard',
      horseId: 'h1',
      horseName: 'SaleHorse',
      price: 12000,
      daysRemaining: 1,
      status: 'active',
    }],
  });
  const { game: after, payouts } = tickContracts(game);
  assert.equal(payouts, 12000);
  assert.equal(after.horses.length, 0);
  assert.equal(after.contracts.length, 0);
});

test('tickContracts cancels a sale contract if the horse is gone', () => {
  const game = makeGame({
    contracts: [{
      id: 'c1',
      type: 'sale',
      template: 'Standard',
      horseId: 'gone',
      horseName: 'Gone',
      price: 5000,
      daysRemaining: 1,
      status: 'active',
    }],
  });
  const { game: after } = tickContracts(game);
  assert.equal(after.contracts.length, 0);
  assert.equal(after.cash, game.cash);
});
