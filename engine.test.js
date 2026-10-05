const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');

// declarer = 0 => defenders are players 1 and 2
const hand = (bid, defense, tricks, declarer = 0) => ({ declarer, bid, defense, tricks });

test('declarer success: +tricks*K, both defenders vist', () => {
  const r = E.scoreHand(hand('H', ['vist', 'vist'], [7, 2, 1]));
  assert.deepEqual(r.deltas, [28, 8, -40]); // 7*4, 2*4, -10*4
  assert.deepEqual(r.passAdd, [0, 0, 0]);
});

test('declarer fails with 5 tricks: -10*K; defenders 3 and 2 succeed', () => {
  assert.deepEqual(E.scoreHand(hand('C', ['vist', 'vist'], [5, 3, 2])).deltas, [-20, 6, 4]);
});

test('declarer exactly 6 tricks succeeds', () => {
  assert.equal(E.scoreHand(hand('S', ['vist', 'vist'], [6, 2, 2])).deltas[0], 6);
});

test('declarer with 0 tricks: -10*K for every suit', () => {
  assert.equal(E.scoreHand(hand('S', ['vist', 'vist'], [0, 5, 5])).deltas[0], -10);
  assert.equal(E.scoreHand(hand('H', ['vist', 'vist'], [0, 5, 5])).deltas[0], -40);
});

test('single vist: vistor with 2 tricks succeeds, passer gets 0 and +1 pass', () => {
  const r = E.scoreHand(hand('D', ['vist', 'pass'], [8, 2, 0]));
  assert.deepEqual(r.deltas, [24, 6, 0]);
  assert.deepEqual(r.passAdd, [0, 0, 1]);
});

test('single vist: vistor with 1 trick fails -10*K (threshold is 2)', () => {
  assert.deepEqual(E.scoreHand(hand('D', ['pass', 'vist'], [9, 0, 1])).deltas, [27, 0, -30]);
});

test('Grkha success: +tricks, defenders use K=1', () => {
  assert.deepEqual(E.scoreHand(hand('G', ['vist', 'vist'], [7, 2, 1])).deltas, [7, 2, -10]);
});

test('Grkha failure: -40', () => {
  assert.deepEqual(E.scoreHand(hand('G', ['vist', 'vist'], [5, 3, 2])).deltas, [-40, 3, 2]);
});

test('both pass: declarer +6*K, no trick play, both defenders +1 pass', () => {
  const r = E.scoreHand(hand('H', ['pass', 'pass'], [0, 0, 0]));
  assert.deepEqual(r.deltas, [24, 0, 0]);
  assert.deepEqual(r.passAdd, [0, 1, 1]);
  assert.deepEqual(E.scoreHand(hand('G', ['pass', 'pass'], [0, 0, 0])).deltas, [6, 0, 0]);
});

test('declarer can be any seat', () => {
  const r = E.scoreHand(hand('C', ['vist', 'vist'], [4, 3, 3], 1)); // declarer 1 -> defenders 0 and 2
  assert.deepEqual(r.deltas, [8, -20, 6]);
});

test('validateHand accepts good hands and names every problem', () => {
  assert.equal(E.validateHand(hand('H', ['vist', 'vist'], [7, 2, 1])), null);
  assert.equal(E.validateHand(hand('H', ['pass', 'pass'], [0, 0, 0])), null);
  assert.equal(E.validateHand(null), 'declarer');
  assert.equal(E.validateHand(hand('X', ['vist', 'vist'], [7, 2, 1])), 'bid');
  assert.equal(E.validateHand(hand('H', ['vist', 'maybe'], [7, 2, 1])), 'defense');
  assert.equal(E.validateHand(hand('H', ['vist', 'vist'], [7, 2, 2])), 'tricks_sum');
  assert.equal(E.validateHand(hand('H', ['vist', 'vist'], [11, -1, 0])), 'tricks_range');
  assert.equal(E.validateHand(hand('H', ['vist', 'vist'], [7.5, 1.5, 1])), 'tricks_range');
  assert.equal(E.validateHand(hand('H', ['vist', 'pass'], [7, 2, 1])), 'passer_tricks');
});

test('buildHand: incomplete draft gives null', () => {
  assert.equal(E.buildHand({ declarer: null, bid: 'H', defense: [null, null], td: 0, t1: 0 }), null);
  assert.equal(E.buildHand({ declarer: 0, bid: 'H', defense: ['vist', null], td: 0, t1: 0 }), null);
});

test('buildHand: both pass ignores tricks', () => {
  assert.deepEqual(E.buildHand({ declarer: 2, bid: 'S', defense: ['pass', 'pass'], td: 7, t1: 3 }),
    { declarer: 2, bid: 'S', defense: ['pass', 'pass'], tricks: [0, 0, 0] });
});

test('buildHand: single vist gives the rest to the vistor', () => {
  // declarer 1, defenders [0,2]; second defender vists
  const h = E.buildHand({ declarer: 1, bid: 'D', defense: ['pass', 'vist'], td: 7, t1: 0 });
  assert.deepEqual(h.tricks, [0, 7, 3]);
  assert.equal(E.validateHand(h), null);
});

test('buildHand: both vist uses t1 and the remainder; negative remainder is rejected by validateHand', () => {
  const ok = E.buildHand({ declarer: 0, bid: 'H', defense: ['vist', 'vist'], td: 6, t1: 3 });
  assert.deepEqual(ok.tricks, [6, 3, 1]);
  assert.equal(E.validateHand(ok), null);
  const bad = E.buildHand({ declarer: 0, bid: 'H', defense: ['vist', 'vist'], td: 8, t1: 5 });
  assert.deepEqual(bad.tricks, [8, 5, -3]);
  assert.equal(E.validateHand(bad), 'tricks_range');
});

test('deriveGame: third pass costs -10 and resets the counter (same hand as +6*K)', () => {
  const passHand = hand('S', ['pass', 'pass'], [0, 0, 0]);
  const g = E.deriveGame({ dealerStart: 1, hands: [passHand, passHand, passHand] });
  assert.deepEqual(g.rows[0].passes, [0, 1, 1]);
  assert.deepEqual(g.rows[2].penalty, [0, -10, -10]);
  assert.deepEqual(g.rows[2].total, [6, -10, -10]);
  assert.deepEqual(g.scores, [18, -10, -10]);
  assert.deepEqual(g.passes, [0, 0, 0]);
});

test('deriveGame: dealer rotates from dealerStart', () => {
  const h = hand('S', ['vist', 'vist'], [6, 2, 2]);
  const g = E.deriveGame({ dealerStart: 1, hands: [h, h] });
  assert.deepEqual(g.rows.map((r) => r.dealer), [1, 2]);
  assert.equal(g.dealer, 0);
});

test('deriveGame: finishes at the first hand reaching 121; later hands do not change winners', () => {
  const win = hand('H', ['pass', 'pass'], [0, 0, 0]); // +24 for player 0
  const hands = Array(6).fill(win);
  const g = E.deriveGame({ dealerStart: 0, hands });
  assert.equal(g.finishedAt, 5); // 5*24=120, 6th hand reaches 144
  assert.deepEqual(g.winners, [0]);
  const g2 = E.deriveGame({ dealerStart: 0, hands: hands.slice(0, 5) });
  assert.equal(g2.finishedAt, -1);
  assert.deepEqual(g2.winners, []);
});

test('deriveGame: empty game', () => {
  const g = E.deriveGame({ dealerStart: 2, hands: [] });
  assert.deepEqual(g.scores, [0, 0, 0]);
  assert.equal(g.dealer, 2);
});
