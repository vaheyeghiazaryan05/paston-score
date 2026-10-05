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
