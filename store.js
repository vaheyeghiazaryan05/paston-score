(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PastonStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'paston.v1';
  const LANGS = ['ru', 'en', 'hy'];
  const MAX_GAMES = 30;
  const NAME_MAX = 20;

  const emptyState = () => ({ lang: 'ru', players: ['', '', ''], games: [], currentId: null });
  const clean = (s) => String(s == null ? '' : s).slice(0, NAME_MAX);

  function sanitize(raw, engine) {
    const s = emptyState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
    if (LANGS.includes(raw.lang)) s.lang = raw.lang;
    if (Array.isArray(raw.players) && raw.players.length === 3) s.players = raw.players.map(clean);
    if (Array.isArray(raw.games)) {
      s.games = raw.games
        .filter((g) => g && typeof g.id === 'string' && Array.isArray(g.players) && g.players.length === 3 &&
          [0, 1, 2].includes(g.dealerStart) && Array.isArray(g.hands))
        .slice(0, MAX_GAMES)
        .map((g) => ({
          id: g.id,
          createdAt: Number(g.createdAt) || 0,
          players: g.players.map(clean),
          dealerStart: g.dealerStart,
          continued: !!g.continued,
          hands: g.hands.filter((h) => engine.validateHand(h) === null),
        }));
    }
    s.currentId = s.games.some((g) => g.id === raw.currentId) ? raw.currentId : null;
    return s;
  }

  function load(storage, engine) {
    try {
      return sanitize(JSON.parse(storage.getItem(KEY)), engine);
    } catch (e) {
      return emptyState();
    }
  }

  function save(storage, state) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable or full: the app keeps working in memory */ }
  }

  function newGame(state, players, dealerStart, now, id) {
    const game = { id, createdAt: now, players: players.map(clean), dealerStart, continued: false, hands: [] };
    state.games.unshift(game);
    state.games.length = Math.min(state.games.length, MAX_GAMES);
    state.currentId = id;
    return game;
  }

  function addHand(game, hand, engine) {
    const err = engine.validateHand(hand);
    if (err) return err;
    game.hands.push(hand);
    return null;
  }

  function undoHand(game, engine) {
    game.hands.pop();
    if (engine.deriveGame(game).finishedAt < 0) game.continued = false;
  }

  return { KEY, emptyState, load, save, newGame, addHand, undoHand };
});
