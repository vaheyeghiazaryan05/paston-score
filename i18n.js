(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PastonI18n = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LANGS = ['ru', 'en', 'hy'];
  const DICT = {
    ru: {
      dropHand: 'Бросил сразу', dropWho: 'Кто бросил', dropped: 'бросил(а)',
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
      dropHand: 'Threw in at once', dropWho: 'Who threw in', dropped: 'threw in',
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
      dropHand: 'Անմիջապես հրաժարվեց', dropWho: 'Ով հրաժարվեց', dropped: 'հրաժարվեց',
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
