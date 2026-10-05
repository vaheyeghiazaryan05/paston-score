# Пастон — счёт: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мобильное PWA для ведения счёта карточной игры «Пастон» (3 игрока, цель 121).

**Architecture:** Чистый движок подсчёта (`engine.js`, без DOM, тестируется в Node) + слой хранения (`store.js`) + словари (`i18n.js`) + тонкий UI (`app.js`, `sheet.js`), отрисовка через `innerHTML` и делегирование событий. Очки и пасы всегда пересчитываются из списка раздач. Без сборки и зависимостей.

**Tech Stack:** HTML/CSS/vanilla JS, `node:test` (Node ≥ 18), service worker, `localStorage`.

**Spec:** `docs/superpowers/specs/2026-10-05-paston-score-design.md`

## Global Constraints

- Папка проекта: `C:\Users\Vahe Yeghiazaryan\Desktop\Paston Score` (git уже инициализирован). Все пути в плане относительны к ней.
- Нет сборки, нет npm-зависимостей. Модули — UMD: `module.exports` в Node, глобальный объект в браузере (`PastonEngine`, `PastonStore`, `PastonI18n`, `PastonSheet`).
- Провал всегда −10 × K. Для одного вистующего порог успеха **2** взятки (не 4). Пороги — константы `RULES` в `engine.js`.
- K: ♠=1, ♣=2, ♦=3, ♥=4; Grkha («Ղռխա») — козырь ♠, K=1, провал −40, успех +взятки.
- Язык по умолчанию RU, переключатель RU / EN / HY. Тёмная тема. Цели нажатия ≥ 48 px, вёрстка 360–430 px.
- `localStorage` ключ `paston.v1`; любые чтения/записи в try/catch; приложение должно работать без хранилища.
- Имена игроков никогда не вставляются в `innerHTML` без экранирования.
- Каждый коммит оканчивается строкой `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Сообщения коммитов на русском, как в соседних репозиториях.

## Review Focus

1. Третий «пас» защитника в раздаче «оба пас»: разыгрывающий получает +6 × K, а защитник −10 за пасы и счётчик обнуляется (оба эффекта в одной раздаче). → тест в Task 1.
2. Grkha с вистующими защитниками: защитники считаются с K=1, а провал разыгрывающего −40. → тест в Task 1.
3. Взятки, не дающие в сумме 10, или отрицательный остаток при двух вистах: раздача не записывается. → тесты в Task 1 (`validateHand`, `buildHand`) и ручная проверка в Task 5.
4. Битый, чужой или старый формат `localStorage` и недоступное хранилище: приложение стартует с пустым состоянием, не падая; невалидные раздачи отбрасываются. → тесты в Task 2.
5. Пустые имена и имена с HTML (`<b>x</b>`): подставляется «Игрок N», разметка не ломается. Отмена раздачи, которая закончила партию, снимает победителя. → тест отмены в Task 2, проверка имён в Task 5.

---

### Task 1: Движок подсчёта

**Files:**
- Create: `package.json`, `.gitignore`, `engine.js`
- Test: `engine.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces (экспорт `PastonEngine`):
  - `RULES` — объект констант `{DECLARER_MIN:6, BOTH_VIST_MIN:2, SINGLE_VIST_MIN:2, PASS_LIMIT:3, PASS_PENALTY:-10, GRKHA_FAIL:-40, TARGET:121, TRICKS:10}`
  - `K` — `{S:1,C:2,D:3,H:4,G:1}`; `BIDS` — `['S','C','D','H','G']`
  - `defendersOf(declarer:number) → [number,number]` — индексы защитников по возрастанию.
  - Тип `Hand = {declarer:0|1|2, bid:'S'|'C'|'D'|'H'|'G', defense:['vist'|'pass','vist'|'pass'], tricks:[n,n,n]}`; `defense[k]` относится к `defendersOf(declarer)[k]`; `tricks` индексированы по игрокам.
  - `validateHand(hand) → null | 'declarer'|'bid'|'defense'|'tricks_range'|'tricks_sum'|'passer_tricks'`
  - `scoreHand(hand) → {deltas:[n,n,n], passAdd:[0|1,0|1,0|1]}`
  - `buildHand(draft) → Hand|null`, `draft = {declarer, bid, defense:[a,b], td, t1}` (`td` — взятки разыгрывающего, `t1` — взятки первого защитника при двух вистах); `null`, если форма не заполнена.
  - `deriveGame({dealerStart, hands}) → {scores:[n,n,n], passes:[n,n,n], rows:[{deltas,penalty,total,scores,passes,dealer}], dealer, finishedAt:number(-1 если нет), winners:number[]}`

- [ ] **Step 1: Scaffold**

`package.json`:
```json
{
  "name": "paston-score",
  "version": "1.0.0",
  "private": true,
  "description": "Пастон — счёт: мобильное PWA для ведения счёта игры",
  "scripts": { "start": "node dev-server.js", "test": "node --test" },
  "engines": { "node": ">=18" }
}
```
`.gitignore`:
```
node_modules
```

- [ ] **Step 2: Write the failing tests**

`engine.test.js`:
```js
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
```
- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL (`Cannot find module './engine.js'`).

- [ ] **Step 4: Write the implementation**

`engine.js`:
```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: PASS, все тесты `engine.test.js` зелёные. Если тест `single vist ... threshold is 2` падает, проверь, что `SINGLE_VIST_MIN` равен 2.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore engine.js engine.test.js
git commit -m "Движок подсчёта: очки, пасы, победа, сборка раздачи из формы"
```

---

### Task 2: Хранилище и словари

**Files:**
- Create: `store.js`, `i18n.js`
- Test: `store.test.js`, `i18n.test.js`

**Interfaces:**
- Consumes: `PastonEngine.validateHand`, `PastonEngine.deriveGame` (Task 1).
- Produces:
  - `PastonStore.KEY` = `'paston.v1'`
  - `emptyState() → {lang:'ru', players:['','',''], games:[], currentId:null}`
  - `load(storage|null, engine) → state` (никогда не бросает), `save(storage|null, state) → void` (никогда не бросает)
  - `newGame(state, players:string[3], dealerStart:0|1|2, now:number, id:string) → game`; игра `{id, createdAt, players, dealerStart, continued:false, hands:[]}`; добавляется в начало `state.games` (хранится не более 30), `state.currentId = id`
  - `addHand(game, hand, engine) → null | errorCode` (ошибка из `validateHand`, раздача не добавляется)
  - `undoHand(game, engine) → void` (снимает последнюю раздачу; если игра после этого не закончена, `game.continued=false`)
  - `PastonI18n.LANGS` = `['ru','en','hy']`, `PastonI18n.t(lang, key) → string` (если ключа нет, возвращает ключ)

- [ ] **Step 1: Write the failing tests**

`store.test.js`:
```js
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
```

`i18n.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('./i18n.js');

test('every language has exactly the same non-empty keys', () => {
  const base = Object.keys(I.DICT.ru).sort();
  assert.ok(base.length > 20);
  for (const lang of I.LANGS) {
    assert.deepEqual(Object.keys(I.DICT[lang]).sort(), base, lang);
    for (const k of base) assert.ok(String(I.DICT[lang][k]).trim().length > 0, `${lang}.${k}`);
  }
});

test('t falls back to the key for unknown keys and to ru for unknown language', () => {
  assert.equal(I.t('ru', 'nope'), 'nope');
  assert.equal(I.t('xx', 'newGame'), I.DICT.ru.newGame);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL (`Cannot find module './store.js'`, `./i18n.js`).

- [ ] **Step 3: Write `store.js`**

```js
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
```

- [ ] **Step 4: Write `i18n.js`**

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PastonI18n = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LANGS = ['ru', 'en', 'hy'];
  const DICT = {
    ru: {
      title: 'Пастон', subtitle: 'Счёт игры', players: 'Игроки', player: 'Игрок',
      firstDealer: 'Первый сдающий', newGame: 'Новая партия', resume: 'Продолжить партию',
      recent: 'Последние партии', dealer: 'сдаёт', addHand: '+ Раздача', undo: 'Отменить последнюю',
      undoConfirm: 'Отменить последнюю раздачу?', history: 'Раздачи', noHands: 'Раздач пока нет',
      hand: 'Раздача', declarer: 'Разыгрывающий', bid: 'Заявка', defense: 'Защита',
      vist: 'Вист', pass: 'Пас', tricks: 'Взятки', remainder: 'остаток', preview: 'Запишется',
      save: 'Записать', cancel: 'Отмена', back: 'Назад', winner: 'Победа', continue: 'Продолжить',
      redealHint: 'Пересдача — раздача не записывается.',
      errTricksSum: 'Сумма взяток должна быть 10', errTricksRange: 'Взятки вне диапазона 0–10',
      errPasserTricks: 'У пасующего не может быть взяток', penalty: 'штраф за пасы',
      bothPass: 'оба пас', target: 'Цель: 121', passes: 'пасы', finished: 'окончена', home: 'К партиям',
    },
    en: {
      title: 'Paston', subtitle: 'Score keeper', players: 'Players', player: 'Player',
      firstDealer: 'First dealer', newGame: 'New game', resume: 'Resume game',
      recent: 'Recent games', dealer: 'deals', addHand: '+ Hand', undo: 'Undo last',
      undoConfirm: 'Undo the last hand?', history: 'Hands', noHands: 'No hands yet',
      hand: 'Hand', declarer: 'Declarer', bid: 'Bid', defense: 'Defense',
      vist: 'Vist', pass: 'Pass', tricks: 'Tricks', remainder: 'remainder', preview: 'Will be recorded',
      save: 'Save', cancel: 'Cancel', back: 'Back', winner: 'Winner', continue: 'Continue',
      redealHint: 'Redeal: do not record the hand.',
      errTricksSum: 'Tricks must add up to 10', errTricksRange: 'Tricks must be between 0 and 10',
      errPasserTricks: 'A passing defender cannot have tricks', penalty: 'pass penalty',
      bothPass: 'both pass', target: 'Target: 121', passes: 'passes', finished: 'finished', home: 'Games',
    },
    hy: {
      title: 'Պաստոն', subtitle: 'Խաղի հաշիվ', players: 'Խաղացողներ', player: 'Խաղացող',
      firstDealer: 'Առաջին բաժանողը', newGame: 'Նոր խաղ', resume: 'Շարունակել խաղը',
      recent: 'Վերջին խաղերը', dealer: 'բաժանում է', addHand: '+ Փուլ', undo: 'Չեղարկել վերջինը',
      undoConfirm: 'Չեղարկե՞լ վերջին փուլը։', history: 'Փուլեր', noHands: 'Փուլեր դեռ չկան',
      hand: 'Փուլ', declarer: 'Խաղարկող', bid: 'Հայտ', defense: 'Պաշտպանություն',
      vist: 'Վիստ', pass: 'Պաս', tricks: 'Ձեռքեր', remainder: 'մնացորդ', preview: 'Կգրանցվի',
      save: 'Գրանցել', cancel: 'Չեղարկել', back: 'Հետ', winner: 'Հաղթող', continue: 'Շարունակել',
      redealHint: 'Վերաբաժանման դեպքում փուլը չի գրանցվում։',
      errTricksSum: 'Ձեռքերի գումարը պետք է լինի 10', errTricksRange: 'Ձեռքերը պետք է լինեն 0–10',
      errPasserTricks: 'Պաս ասողը ձեռք չի կարող ունենալ', penalty: 'պասերի տուգանք',
      bothPass: 'երկուսն էլ պաս', target: 'Նպատակ՝ 121', passes: 'պասեր', finished: 'ավարտված', home: 'Խաղեր',
    },
  };

  function t(lang, key) {
    const d = DICT[lang] || DICT.ru;
    return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : key;
  }

  return { LANGS, DICT, t };
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test`
Expected: PASS (engine, store, i18n).

- [ ] **Step 6: Commit**

```bash
git add store.js store.test.js i18n.js i18n.test.js
git commit -m "Хранилище партий с защитой от битых данных и словари RU/EN/HY"
```

---

### Task 3: Интерфейс

**Files:**
- Create: `index.html`, `style.css`, `sheet.js`, `app.js`

**Interfaces:**
- Consumes: `PastonEngine` (Task 1), `PastonStore` и `PastonI18n` (Task 2) — глобальные объекты, подключаются `<script>` в этом порядке: `i18n.js`, `engine.js`, `store.js`, `sheet.js`, `app.js`.
- Produces: `PastonSheet = { blank() → draft, html(ctx) → string, click(el, draft) → void }`, где `ctx = {game, draft, t, esc, pname}`; `draft = {declarer, bid, defense:[a,b], td, t1}`. Элементы листа используют `data-act` из набора `sh-decl, sh-bid, sh-def, sh-td, sh-t1`. Кнопки `sh-save` и `sh-cancel` обрабатывает `app.js`.

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#14161c">
  <title>Пастон — счёт</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script src="i18n.js"></script>
  <script src="engine.js"></script>
  <script src="store.js"></script>
  <script src="sheet.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `style.css`**

```css
:root {
  --bg: #14161c; --card: #1d2029; --card2: #262a35; --text: #eceef3; --muted: #8b92a3;
  --accent: #e0b24a; --accent-ink: #1a1405; --pos: #5fd08a; --neg: #ff7a7a; --red: #ff6b6b; --line: #2e3340;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
#app { max-width: 480px; margin: 0 auto; min-height: 100dvh; padding: 12px 16px calc(112px + env(safe-area-inset-bottom)); }
button { font: inherit; color: inherit; border: 0; cursor: pointer; min-height: 48px; border-radius: 12px; }
button:disabled { opacity: .4; cursor: default; }
h1 { font-size: 22px; margin: 0; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 18px 0 8px; font-weight: 600; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0 8px; }
.lang { display: flex; gap: 6px; }
.card { background: var(--card); border-radius: 16px; padding: 16px; margin-top: 12px; }
.name { width: 100%; min-height: 48px; margin-bottom: 8px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card2); color: var(--text); font: inherit; }
.row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { background: var(--card2); padding: 0 16px; min-width: 48px; }
.chip.on { background: var(--accent); color: var(--accent-ink); font-weight: 700; }
.primary { width: 100%; margin-top: 16px; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
.secondary { width: 100%; margin-top: 8px; background: var(--card2); }
.recent { width: 100%; text-align: left; background: var(--card); margin-top: 8px; padding: 10px 14px; }
.recent small { color: var(--muted); display: block; }
.board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.pl { background: var(--card); border-radius: 16px; padding: 12px 6px; text-align: center; border: 2px solid transparent; min-width: 0; }
.pl.deal { border-color: var(--accent); }
.pn { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps { font-size: 40px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.ps.neg, .neg { color: var(--neg); }
.pos { color: var(--pos); }
.pp { color: var(--muted); letter-spacing: 3px; min-height: 22px; }
.db { font-size: 12px; color: var(--accent); }
.hist { list-style: none; margin: 0; padding: 0; }
.hrow { background: var(--card); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
.hh { font-size: 14px; color: var(--muted); }
.hd { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.red { color: var(--red); }
.note { color: var(--muted); font-size: 13px; }
.bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--bg) 30%); }
.bar .inner { max-width: 480px; margin: 0 auto; display: grid; grid-template-columns: 1fr 2fr; gap: 8px; }
.bar button { margin: 0; width: 100%; }
.bar .primary { margin: 0; }
.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .6); display: flex; align-items: flex-end; justify-content: center; z-index: 5; }
.sheet { background: var(--bg); width: 100%; max-width: 480px; max-height: 94dvh; overflow-y: auto; border-radius: 20px 20px 0 0; padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); }
.modal { align-items: center; padding: 16px; }
.modal .sheet { border-radius: 20px; background: var(--card); text-align: center; }
.stepper { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.stepper b { min-width: 2ch; text-align: center; font-size: 28px; }
.stepper span { flex: 1; }
.stepper button { width: 56px; background: var(--card2); font-size: 24px; }
.pv { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; background: var(--card); border-radius: 12px; padding: 10px; }
.pv div b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.err { color: var(--neg); min-height: 22px; margin: 8px 0; }
.sheet .actions { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-top: 8px; }
.sheet .actions .primary { margin: 0; }
```

- [ ] **Step 3: `sheet.js`**

```js
(function (root, factory) {
  root.PastonSheet = factory(root.PastonEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const SUIT = { S: '♠', C: '♣', D: '♦', H: '♥', G: 'Ղռխա' };
  const isRed = (b) => b === 'D' || b === 'H';
  const clamp = (n) => Math.max(0, Math.min(E.RULES.TRICKS, n));
  const sg = (n) => (n > 0 ? '+' + n : String(n));

  function blank() {
    return { declarer: null, bid: null, defense: [null, null], td: 0, t1: 0 };
  }

  function chip(act, attrs, label, on, extra) {
    return `<button class="chip ${on ? 'on' : ''} ${extra || ''}" data-act="${act}" ${attrs}>${label}</button>`;
  }

  function stepper(act, label, value) {
    return `<div class="stepper"><span>${label}</span>
      <button data-act="${act}" data-v="-1" aria-label="-">−</button><b>${value}</b>
      <button data-act="${act}" data-v="1" aria-label="+">+</button></div>`;
  }

  function html(ctx) {
    const { game, draft, t, esc, pname } = ctx;
    const hand = E.buildHand(draft);
    const err = hand ? E.validateHand(hand) : 'incomplete';
    const errText = { tricks_sum: 'errTricksSum', tricks_range: 'errTricksRange', passer_tricks: 'errPasserTricks' }[err];

    let out = `<div class="overlay"><div class="sheet" role="dialog">`;
    out += `<h2>${t('declarer')}</h2><div class="row">${[0, 1, 2].map((i) =>
      chip('sh-decl', `data-v="${i}"`, esc(pname(game, i)), draft.declarer === i)).join('')}</div>`;
    out += `<h2>${t('bid')}</h2><div class="row">${E.BIDS.map((b) =>
      chip('sh-bid', `data-v="${b}"`, SUIT[b], draft.bid === b, isRed(b) ? 'red' : '')).join('')}</div>`;

    if (draft.declarer !== null) {
      const ds = E.defendersOf(draft.declarer);
      out += `<h2>${t('defense')}</h2>`;
      ds.forEach((p, k) => {
        out += `<div class="stepper"><span>${esc(pname(game, p))}</span>
          ${chip('sh-def', `data-k="${k}" data-v="vist"`, t('vist'), draft.defense[k] === 'vist')}
          ${chip('sh-def', `data-k="${k}" data-v="pass"`, t('pass'), draft.defense[k] === 'pass')}</div>`;
      });

      const [a, b] = draft.defense;
      if (a && b && !(a === 'pass' && b === 'pass')) {
        out += `<h2>${t('tricks')}</h2>`;
        out += stepper('sh-td', esc(pname(game, draft.declarer)), draft.td);
        if (a === 'vist' && b === 'vist') {
          out += stepper('sh-t1', esc(pname(game, ds[0])), draft.t1);
          out += `<div class="stepper"><span>${esc(pname(game, ds[1]))} · ${t('remainder')}</span><b>${E.RULES.TRICKS - draft.td - draft.t1}</b></div>`;
        } else {
          const v = a === 'vist' ? ds[0] : ds[1];
          out += `<div class="stepper"><span>${esc(pname(game, v))} · ${t('remainder')}</span><b>${E.RULES.TRICKS - draft.td}</b></div>`;
        }
      }
    }

    out += `<h2>${t('preview')}</h2>`;
    if (!err) {
      const row = E.deriveGame({ dealerStart: game.dealerStart, hands: game.hands.concat([hand]) }).rows.pop();
      out += `<div class="pv">${[0, 1, 2].map((i) => `<div>${esc(pname(game, i))}<b class="${row.total[i] < 0 ? 'neg' : row.total[i] > 0 ? 'pos' : ''}">${sg(row.total[i])}</b><span class="note">${row.scores[i]}</span></div>`).join('')}</div>`;
    } else {
      out += `<div class="pv note"><div></div><div>—</div><div></div></div>`;
    }
    out += `<div class="err">${errText ? t(errText) : ''}</div>`;
    out += `<div class="note">${t('redealHint')}</div>`;
    out += `<div class="actions"><button class="secondary" data-act="sh-cancel">${t('cancel')}</button>
      <button class="primary" data-act="sh-save" ${err ? 'disabled' : ''}>${t('save')}</button></div>`;
    return out + '</div></div>';
  }

  function click(el, draft) {
    const act = el.dataset.act;
    const v = el.dataset.v;
    if (act === 'sh-decl') {
      draft.declarer = Number(v);
      draft.defense = [null, null];
      draft.td = 0;
      draft.t1 = 0;
    } else if (act === 'sh-bid') {
      draft.bid = v;
    } else if (act === 'sh-def') {
      draft.defense[Number(el.dataset.k)] = v;
    } else if (act === 'sh-td') {
      draft.td = clamp(draft.td + Number(v));
    } else if (act === 'sh-t1') {
      draft.t1 = clamp(draft.t1 + Number(v));
    }
  }

  return { blank, html, click };
});
```

- [ ] **Step 4: `app.js`**

```js
(function () {
  'use strict';
  const E = window.PastonEngine;
  const S = window.PastonStore;
  const I = window.PastonI18n;
  const Sheet = window.PastonSheet;
  const SUIT = { S: '♠', C: '♣', D: '♦', H: '♥', G: 'Ղռխա' };

  let ls = null;
  try { ls = window.localStorage; } catch (e) { /* blocked storage: run in memory */ }
  const state = S.load(ls, E);
  const ui = { screen: state.currentId ? 'board' : 'start', dealer: 0, sheet: null };
  const root = document.getElementById('app');

  const t = (k) => I.t(state.lang, k);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sg = (n) => (n > 0 ? '+' + n : String(n));
  const persist = () => S.save(ls, state);
  const current = () => state.games.find((g) => g.id === state.currentId) || null;
  const label = (name, i) => (name && name.trim()) || t('player') + ' ' + (i + 1);
  const pname = (game, i) => label(game.players[i], i);

  function langBar() {
    return '<div class="lang">' + I.LANGS.map((l) =>
      `<button class="chip ${l === state.lang ? 'on' : ''}" data-act="lang" data-v="${l}">${l.toUpperCase()}</button>`).join('') + '</div>';
  }

  function recentHtml() {
    if (!state.games.length) return '';
    return `<h2>${t('recent')}</h2>` + state.games.slice(0, 6).map((g) => {
      const d = E.deriveGame(g);
      const date = g.createdAt ? new Date(g.createdAt).toLocaleDateString(state.lang) : '';
      const line = [0, 1, 2].map((i) => `${esc(pname(g, i))} ${d.scores[i]}`).join(' · ');
      return `<button class="recent" data-act="open" data-id="${esc(g.id)}">${line}<small>${date}${d.finishedAt >= 0 ? ' · ' + t('finished') : ''}</small></button>`;
    }).join('');
  }

  function startHtml() {
    return `<header class="top"><h1>♠ ${t('title')}</h1>${langBar()}</header>
      <section class="card">
        <h2>${t('players')}</h2>
        ${[0, 1, 2].map((i) => `<input class="name" data-name="${i}" maxlength="20" value="${esc(state.players[i])}" placeholder="${t('player')} ${i + 1}" autocomplete="off">`).join('')}
        <h2>${t('firstDealer')}</h2>
        <div class="row">${[0, 1, 2].map((i) => `<button class="chip ${ui.dealer === i ? 'on' : ''}" data-act="dealer" data-v="${i}">${esc(label(state.players[i], i))}</button>`).join('')}</div>
        <button class="primary" data-act="start">${t('newGame')}</button>
        ${current() ? `<button class="secondary" data-act="resume">${t('resume')}</button>` : ''}
      </section>${recentHtml()}`;
  }

  function historyHtml(game, d) {
    if (!game.hands.length) return `<p class="note">${t('noHands')}</p>`;
    return '<ul class="hist">' + game.hands.map((h, idx) => {
      const r = d.rows[idx];
      const red = h.bid === 'D' || h.bid === 'H' ? 'red' : '';
      const both = h.defense[0] === 'pass' && h.defense[1] === 'pass' ? ' · ' + t('bothPass') : '';
      return `<li class="hrow"><div class="hh"><b>${t('hand')} ${idx + 1}</b> · ${esc(pname(game, h.declarer))} <span class="${red}">${SUIT[h.bid]}</span>${both}</div>
        <div class="hd">${[0, 1, 2].map((i) => `<span class="${r.total[i] < 0 ? 'neg' : r.total[i] > 0 ? 'pos' : ''}">${sg(r.total[i])}${r.penalty[i] ? '*' : ''}</span>`).join('')}</div></li>`;
    }).reverse().join('') + `</ul><p class="note">* ${t('penalty')}</p>`;
  }

  function winnerHtml(game, d) {
    const names = d.winners.map((i) => esc(pname(game, i))).join(' · ');
    return `<div class="overlay modal"><div class="sheet" role="dialog">
      <h1>${t('winner')}</h1><p style="font-size:24px">${names}</p>
      <p class="note">${[0, 1, 2].map((i) => `${esc(pname(game, i))} ${d.scores[i]}`).join(' · ')}</p>
      <button class="primary" data-act="continue">${t('continue')}</button>
      <button class="secondary" data-act="home">${t('home')}</button></div></div>`;
  }

  function boardHtml(game) {
    const d = E.deriveGame(game);
    const cols = [0, 1, 2].map((i) => `<div class="pl ${d.dealer === i ? 'deal' : ''}">
        <div class="pn">${esc(pname(game, i))}</div>
        <div class="ps ${d.scores[i] < 0 ? 'neg' : ''}">${d.scores[i]}</div>
        <div class="pp" title="${t('passes')}">${'●'.repeat(d.passes[i])}${'○'.repeat(E.RULES.PASS_LIMIT - d.passes[i])}</div>
        <div class="db">${d.dealer === i ? t('dealer') : '&nbsp;'}</div></div>`).join('');
    let out = `<header class="top"><button class="chip" data-act="home">‹ ${t('home')}</button>${langBar()}</header>
      <div class="note" style="text-align:center">${t('target')}</div>
      <div class="board">${cols}</div>
      <h2>${t('history')}</h2>${historyHtml(game, d)}
      <div class="bar"><div class="inner">
        <button class="secondary" data-act="undo" ${game.hands.length ? '' : 'disabled'}>${t('undo')}</button>
        <button class="primary" data-act="add">${t('addHand')}</button></div></div>`;
    if (ui.sheet) out += Sheet.html({ game, draft: ui.sheet, t, esc, pname });
    else if (d.finishedAt >= 0 && !game.continued) out += winnerHtml(game, d);
    return out;
  }

  function render() {
    document.documentElement.lang = state.lang;
    const game = current();
    if (ui.screen === 'board' && game) root.innerHTML = boardHtml(game);
    else { ui.screen = 'start'; root.innerHTML = startHtml(); }
  }

  function startGame() {
    const now = Date.now();
    S.newGame(state, state.players, ui.dealer, now, 'g' + now.toString(36));
    ui.screen = 'board';
  }

  root.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const game = current();
    if (act.startsWith('sh-') && ui.sheet) {
      if (act === 'sh-cancel') ui.sheet = null;
      else if (act === 'sh-save') {
        const hand = E.buildHand(ui.sheet);
        if (hand && game && !S.addHand(game, hand, E)) ui.sheet = null;
      } else Sheet.click(el, ui.sheet);
    } else if (act === 'lang') state.lang = el.dataset.v;
    else if (act === 'dealer') ui.dealer = Number(el.dataset.v);
    else if (act === 'start') startGame();
    else if (act === 'resume') ui.screen = 'board';
    else if (act === 'open') { state.currentId = el.dataset.id; ui.screen = 'board'; }
    else if (act === 'home') ui.screen = 'start';
    else if (act === 'add') ui.sheet = Sheet.blank();
    else if (act === 'undo') { if (game && window.confirm(t('undoConfirm'))) S.undoHand(game, E); }
    else if (act === 'continue') { if (game) game.continued = true; }
    persist();
    render();
  });

  root.addEventListener('input', (ev) => {
    const i = ev.target.dataset && ev.target.dataset.name;
    if (i === undefined) return;
    state.players[Number(i)] = ev.target.value.slice(0, 20);
    persist();
  });
  root.addEventListener('change', (ev) => {
    if (ev.target.dataset && ev.target.dataset.name !== undefined) render();
  });

  try {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
  } catch (e) { /* offline cache is optional */ }

  render();
})();
```

- [ ] **Step 5: Smoke check syntax**

Run: `node --check app.js && node --check sheet.js && node --test`
Expected: нет ошибок синтаксиса, все тесты Task 1–2 зелёные.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css sheet.js app.js
git commit -m "Интерфейс: старт, табло, история, лист ввода раздачи"
```

---

### Task 4: PWA, dev-сервер и README

**Files:**
- Create: `manifest.webmanifest`, `icon.svg`, `sw.js`, `dev-server.js`, `README.md`

**Interfaces:**
- Consumes: список файлов приложения из Task 3.
- Produces: офлайн-кэш `paston-v1` (при изменении файлов приложения версию в `sw.js` нужно увеличить); `npm start` поднимает http://localhost:8080.

- [ ] **Step 1: `manifest.webmanifest`**

```json
{
  "name": "Пастон — счёт",
  "short_name": "Пастон",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#14161c",
  "theme_color": "#14161c",
  "icons": [{ "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" }]
}
```

- [ ] **Step 2: `icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#14161c"/><text x="256" y="350" font-size="300" text-anchor="middle" fill="#e0b24a" font-family="serif">♠</text></svg>
```

- [ ] **Step 3: `sw.js`**

```js
const CACHE = 'paston-v1';
const ASSETS = ['./', 'index.html', 'style.css', 'i18n.js', 'engine.js', 'store.js', 'sheet.js', 'app.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

- [ ] **Step 4: `dev-server.js`**

```js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const PORT = Number(process.env.PORT) || 8080;

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(__dirname, rel);
  if (!file.startsWith(__dirname) || rel.includes('..')) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
```

- [ ] **Step 5: `README.md`**

```markdown
# Пастон — счёт

Мобильное PWA для ведения счёта игры «Пастон» (3 игрока, до 121). Правила: см. `docs/superpowers/specs/`.

## Запуск и тесты
- `npm start` — локальный сервер на http://localhost:8080
- `npm test` — тесты движка, хранилища и словарей

## Установка на телефон
Приложению нужен HTTPS (кроме localhost), чтобы работали офлайн-режим и «добавить на главный экран». Проще всего выложить папку на любой статический хостинг (GitHub Pages, Netlify, Cloudflare Pages). Откройте адрес на телефоне и выберите «Добавить на главный экран».

После изменений в файлах приложения увеличьте версию `CACHE` в `sw.js`, иначе телефон покажет старую копию.

## Правила, отличающиеся от PDF
Для одного вистующего порог успеха — 2 взятки (в PDF 4). Значения порогов — в `RULES` в `engine.js`.
```

- [ ] **Step 6: Verify the server serves everything**

Run: `node dev-server.js` (в фоне), затем `curl -s -o /dev/null -w "%{http_code} " localhost:8080/ localhost:8080/sw.js localhost:8080/engine.js localhost:8080/manifest.webmanifest localhost:8080/icon.svg`
Expected: `200 200 200 200 200`.

- [ ] **Step 7: Commit**

```bash
git add manifest.webmanifest icon.svg sw.js dev-server.js README.md
git commit -m "PWA: манифест, офлайн-кэш, dev-сервер и README"
```

---

### Task 5: Проверка в браузере на размере телефона

**Files:** нет (только проверка; исправления идут отдельными коммитами в файлы Task 3–4).

**Interfaces:**
- Consumes: запущенный `node dev-server.js`, встроенный браузер (`mcp__Claude_Browser__*`).
- Produces: подтверждение, что сценарии ниже проходят.

- [ ] **Step 1: Открыть приложение в размере 375×812**

Запусти сервер (`node dev-server.js`, в фоне), открой `http://localhost:8080` через `preview_start` с `url`, затем `resize_window` с пресетом `mobile`. Сделай скриншот, консоль должна быть без ошибок (`read_console_messages` с `onlyErrors`).

- [ ] **Step 2: Пройти сценарий**

1. Ввести имена «Аня», «<b>Бен</b>», пустое третье → выбрать первым сдающим второго → «Новая партия». Ожидание: колонки «Аня», `<b>Бен</b>` буквально (без жирного), «Игрок 3»; у второго метка «сдаёт».
2. «+ Раздача»: разыгрывающий Аня, ♥, оба «Вист», взятки Ани 7, второго 2 → в превью `+28 / +8 / −40`; «Записать». Ожидание: табло 28 / 8 / −40, сдающий сменился на третьего.
3. «+ Раздача»: Аня, ♠, оба «Пас» → превью `+6 / 0 / 0`, пасы 1 из 3 у обоих защитников. Повторить ещё дважды. Ожидание: на третьей раздаче у защитников `−10` и пасы обнулились, в истории звёздочка.
4. В листе ввода с двумя вистами поднять взятки так, чтобы остаток ушёл в минус (разыгрывающий 8, первый защитник 5). Ожидание: «Записать» неактивна, показана ошибка про диапазон 0–10.
5. «Отменить последнюю» → подтвердить. Ожидание: последняя раздача исчезла, счётчики пасов вернулись.
6. Перезагрузить страницу (F5). Ожидание: открывается табло той же партии с теми же очками.
7. Переключить RU → EN → HY. Ожидание: подписи меняются, очки сохраняются.
8. Довести партию до 121 (раздачи «♥, оба пас» по +24). Ожидание: после раздачи, достигшей 121, модальное окно «Победа»; «Продолжить» закрывает его и оно не возвращается; «Отменить последнюю» снимает победителя.
9. DevTools → Application → Service Workers: `sw.js` активен; переключить Network в Offline и перезагрузить. Ожидание: приложение открывается.

- [ ] **Step 3: Вернуть размер окна и остановить сервер**

`resize_window` с пресетом `desktop`; остановить фоновый `node dev-server.js`.

- [ ] **Step 4: Если пришлось что-то чинить, закоммитить**

```bash
git add -A
git commit -m "Исправления по итогам проверки в браузере"
```
