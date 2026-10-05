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
      let head;
      if (E.isDrop(h)) {
        head = `${esc(pname(game, h.player))} · ${t('dropped')}`;
      } else {
        const red = h.bid === 'D' || h.bid === 'H' ? 'red' : '';
        const both = h.defense[0] === 'pass' && h.defense[1] === 'pass' ? ' · ' + t('bothPass') : '';
        head = `${esc(pname(game, h.declarer))} <span class="${red}">${SUIT[h.bid]}</span>${both}`;
      }
      return `<li class="hrow"><div class="hh"><b>${t('hand')} ${idx + 1}</b> · ${head}</div>
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
    else if (act === 'add') ui.sheet = Sheet.blank((E.deriveGame(game).dealer + 1) % 3);
    else if (act === 'undo') { if (game && window.confirm(t('undoConfirm'))) S.undoHand(game, E); }
    else if (act === 'continue') { if (game) game.continued = true; }
    persist();
    render();
  });

  root.addEventListener('input', (ev) => {
    const i = ev.target.dataset && ev.target.dataset.name;
    if (i === undefined) return;
    state.players[Number(i)] = ev.target.value.slice(0, 20);
    const chip = root.querySelector(`[data-act="dealer"][data-v="${Number(i)}"]`);
    if (chip) chip.textContent = label(state.players[Number(i)], Number(i));
    persist();
  });

  try {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) { /* offline cache is optional */ }

  render();
})();
