(function (root, factory) {
  root.PastonSheet = factory(root.PastonEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const SUIT = { S: '♠', C: '♣', D: '♦', H: '♥', G: 'Ղռխա' };
  const isRed = (b) => b === 'D' || b === 'H';
  const clamp = (n) => Math.max(0, Math.min(E.RULES.TRICKS, n));
  const sg = (n) => (n > 0 ? '+' + n : String(n));

  // firstMover: the player to the left of the dealer, the default "who threw in"
  function blank(firstMover) {
    return { declarer: null, bid: null, defense: [null, null], td: 0, t1: 0, drop: false, dropPlayer: firstMover };
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
    out += `<div class="row" style="margin-top:12px">${chip('sh-drop', '', t('dropHand'), draft.drop)}</div>`;
    if (draft.drop) {
      out += `<h2>${t('dropWho')}</h2><div class="row">${[0, 1, 2].map((i) =>
        chip('sh-dropper', `data-v="${i}"`, esc(pname(game, i)), draft.dropPlayer === i)).join('')}</div>`;
    } else {
      out += `<h2>${t('declarer')}</h2><div class="row">${[0, 1, 2].map((i) =>
        chip('sh-decl', `data-v="${i}"`, esc(pname(game, i)), draft.declarer === i)).join('')}</div>`;
      out += `<h2>${t('bid')}</h2><div class="row">${E.BIDS.map((b) =>
        chip('sh-bid', `data-v="${b}"`, SUIT[b], draft.bid === b, isRed(b) ? 'red' : '')).join('')}</div>`;
    }

    if (!draft.drop && draft.declarer !== null) {
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
    if (!draft.drop) out += `<div class="note">${t('redealHint')}</div>`;
    out += `<div class="actions"><button class="secondary" data-act="sh-cancel">${t('cancel')}</button>
      <button class="primary" data-act="sh-save" ${err ? 'disabled' : ''}>${t('save')}</button></div>`;
    return out + '</div></div>';
  }

  function click(el, draft) {
    const act = el.dataset.act;
    const v = el.dataset.v;
    if (act === 'sh-drop') {
      draft.drop = !draft.drop;
    } else if (act === 'sh-dropper') {
      draft.dropPlayer = Number(v);
    } else if (act === 'sh-decl') {
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
