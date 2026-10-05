(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PastonEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RULES = {
    DECLARER_MIN: 6,
    BOTH_VIST_MIN: 2,
    SINGLE_VIST_MIN: 2,
    PASS_LIMIT: 3,
    PASS_PENALTY: -10,
    GRKHA_FAIL: -40,
    TARGET: 121,
    TRICKS: 10,
  };
  const K = { S: 1, C: 2, D: 3, H: 4, G: 1 };
  const BIDS = Object.keys(K);
  const SEATS = [0, 1, 2];
  const isInt = (n) => Number.isInteger(n);

  function defendersOf(declarer) {
    return SEATS.filter((i) => i !== declarer);
  }

  function validateHand(h) {
    if (!h || !SEATS.includes(h.declarer)) return 'declarer';
    if (!BIDS.includes(h.bid)) return 'bid';
    if (!Array.isArray(h.defense) || h.defense.length !== 2 ||
        !h.defense.every((d) => d === 'vist' || d === 'pass')) return 'defense';
    if (h.defense[0] === 'pass' && h.defense[1] === 'pass') return null;
    if (!Array.isArray(h.tricks) || h.tricks.length !== 3 ||
        !h.tricks.every((t) => isInt(t) && t >= 0 && t <= RULES.TRICKS)) return 'tricks_range';
    if (h.tricks[0] + h.tricks[1] + h.tricks[2] !== RULES.TRICKS) return 'tricks_sum';
    const ds = defendersOf(h.declarer);
    for (let k = 0; k < 2; k++) {
      if (h.defense[k] === 'pass' && h.tricks[ds[k]] !== 0) return 'passer_tricks';
    }
    return null;
  }

  function scoreHand(h) {
    const k = K[h.bid];
    const ds = defendersOf(h.declarer);
    const deltas = [0, 0, 0];
    const passAdd = [0, 0, 0];
    h.defense.forEach((d, i) => { if (d === 'pass') passAdd[ds[i]] = 1; });

    if (h.defense[0] === 'pass' && h.defense[1] === 'pass') {
      deltas[h.declarer] = 6 * k;
      return { deltas, passAdd };
    }

    const dt = h.tricks[h.declarer];
    if (dt >= RULES.DECLARER_MIN) deltas[h.declarer] = dt * k;
    else deltas[h.declarer] = h.bid === 'G' ? RULES.GRKHA_FAIL : -10 * k;

    const both = h.defense[0] === 'vist' && h.defense[1] === 'vist';
    const min = both ? RULES.BOTH_VIST_MIN : RULES.SINGLE_VIST_MIN;
    h.defense.forEach((d, i) => {
      if (d !== 'vist') return;
      const t = h.tricks[ds[i]];
      deltas[ds[i]] = t >= min ? t * k : -10 * k;
    });
    return { deltas, passAdd };
  }

  function buildHand(d) {
    if (!SEATS.includes(d.declarer) || !d.bid || !d.defense || !d.defense[0] || !d.defense[1]) return null;
    const [a, b] = d.defense;
    const base = { declarer: d.declarer, bid: d.bid, defense: [a, b] };
    if (a === 'pass' && b === 'pass') return { ...base, tricks: [0, 0, 0] };
    if (!isInt(d.td)) return null;
    const ds = defendersOf(d.declarer);
    const tricks = [0, 0, 0];
    tricks[d.declarer] = d.td;
    if (a === 'vist' && b === 'vist') {
      if (!isInt(d.t1)) return null;
      tricks[ds[0]] = d.t1;
      tricks[ds[1]] = RULES.TRICKS - d.td - d.t1;
    } else {
      tricks[a === 'vist' ? ds[0] : ds[1]] = RULES.TRICKS - d.td;
    }
    return { ...base, tricks };
  }

  function deriveGame(g) {
    const scores = [0, 0, 0];
    const passes = [0, 0, 0];
    const rows = [];
    let finishedAt = -1;
    let winners = [];
    g.hands.forEach((h, idx) => {
      const { deltas, passAdd } = scoreHand(h);
      const penalty = [0, 0, 0];
      SEATS.forEach((i) => {
        if (!passAdd[i]) return;
        passes[i] += 1;
        if (passes[i] >= RULES.PASS_LIMIT) {
          penalty[i] = RULES.PASS_PENALTY;
          passes[i] = 0;
        }
      });
      const total = SEATS.map((i) => deltas[i] + penalty[i]);
      SEATS.forEach((i) => { scores[i] += total[i]; });
      rows.push({
        deltas, penalty, total,
        scores: scores.slice(), passes: passes.slice(),
        dealer: (g.dealerStart + idx) % 3,
      });
      if (finishedAt < 0 && Math.max(...scores) >= RULES.TARGET) {
        finishedAt = idx;
        const top = Math.max(...scores);
        winners = SEATS.filter((i) => scores[i] === top);
      }
    });
    return { scores, passes, rows, dealer: (g.dealerStart + g.hands.length) % 3, finishedAt, winners };
  }

  return { RULES, K, BIDS, defendersOf, validateHand, scoreHand, buildHand, deriveGame };
});
