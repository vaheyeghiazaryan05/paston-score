const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const S = require('./store.js');

const memory = (initial) => {
  const m = new Map(initial ? [[S.KEY, initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), dump: () => m.get(S.KEY) };
};
const good = { declarer: 0, bid: 'H', defense: ['vist', 'vist'], tricks: [7, 2, 1] };

test('load: empty / null / throwing storage gives empty state', () => {
  assert.deepEqual(S.load(memory(), E), S.emptyState());
  assert.deepEqual(S.load(null, E), S.emptyState());
  const boom = { getItem() { throw new Error('denied'); } };
  assert.deepEqual(S.load(boom, E), S.emptyState());
});

test('load: garbage and wrong shapes give empty state, not a crash', () => {
  for (const raw of ['{not json', '42', 'null', '"x"', '[]', '{"games":"nope","players":5}']) {
    const s = S.load(memory(raw), E);
    assert.equal(s.games.length, 0, raw);
    assert.equal(s.players.length, 3, raw);
  }
});

test('load: keeps good games, drops invalid hands and malformed games', () => {
  const raw = JSON.stringify({
    lang: 'hy', players: ['A', 'B', 'C'], currentId: 'g1',
    games: [
      { id: 'g1', createdAt: 5, players: ['A', 'B', 'C'], dealerStart: 1, hands: [good, { declarer: 9 }, { ...good, tricks: [1, 1, 1] }] },
      { id: 7, players: [], hands: [] },
      null,
    ],
  });
  const s = S.load(memory(raw), E);
  assert.equal(s.lang, 'hy');
  assert.equal(s.games.length, 1);
  assert.deepEqual(s.games[0].hands, [good]);
  assert.equal(s.currentId, 'g1');
});

test('load: unknown currentId and lang fall back', () => {
  const raw = JSON.stringify({ lang: 'xx', currentId: 'zzz', games: [] });
  const s = S.load(memory(raw), E);
  assert.equal(s.lang, 'ru');
  assert.equal(s.currentId, null);
});

test('save then load round-trips; save never throws', () => {
  const st = memory();
  const state = S.emptyState();
  state.players = ['X', 'Y', 'Z'];
  S.newGame(state, ['X', 'Y', 'Z'], 2, 100, 'g1');
  S.save(st, state);
  assert.deepEqual(S.load(st, E), state);
  assert.doesNotThrow(() => S.save({ setItem() { throw new Error('quota'); } }, state));
  assert.doesNotThrow(() => S.save(null, state));
});

test('newGame: prepends, becomes current, keeps at most 30', () => {
  const state = S.emptyState();
  for (let i = 0; i < 35; i++) S.newGame(state, ['a', 'b', 'c'], 0, i, 'g' + i);
  assert.equal(state.games.length, 30);
  assert.equal(state.games[0].id, 'g34');
  assert.equal(state.currentId, 'g34');
});

test('addHand: rejects invalid hand without mutating, accepts valid', () => {
  const state = S.emptyState();
  const g = S.newGame(state, ['a', 'b', 'c'], 0, 1, 'g1');
  assert.equal(S.addHand(g, { ...good, tricks: [7, 2, 2] }, E), 'tricks_sum');
  assert.equal(g.hands.length, 0);
  assert.equal(S.addHand(g, good, E), null);
  assert.equal(g.hands.length, 1);
});

test('undoHand: removes last hand and clears "continued" once the game is no longer finished', () => {
  const state = S.emptyState();
  const g = S.newGame(state, ['a', 'b', 'c'], 0, 1, 'g1');
  const win = { declarer: 0, bid: 'H', defense: ['pass', 'pass'], tricks: [0, 0, 0] };
  for (let i = 0; i < 6; i++) S.addHand(g, win, E);
  assert.equal(E.deriveGame(g).finishedAt, 5);
  g.continued = true;
  S.undoHand(g, E);
  assert.equal(g.hands.length, 5);
  assert.equal(g.continued, false);
  assert.deepEqual(E.deriveGame(g).winners, []);
  assert.doesNotThrow(() => { S.undoHand(S.newGame(state, ['a', 'b', 'c'], 0, 2, 'g2'), E); });
});
