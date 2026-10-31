// Сравнение вывода программы с ожидаемым ответом.
// Работает и в браузере (window.Checker), и в Node (module.exports).
(function (root) {
  'use strict';

  const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eEdD][+-]?\d+)?$/;

  function isNumber(tok) { return NUM_RE.test(tok); }
  function toNumber(tok) { return parseFloat(tok.replace(/[dD]/, 'e')); }

  // Допуск определяется точностью, с которой записан ожидаемый ответ:
  // "1027.68" — достаточно совпадения после округления до 0.01.
  function tolerance(expTok) {
    const m = expTok.match(/^[+-]?(\d*)(?:\.(\d*))?(?:[eEdD]([+-]?\d+))?$/);
    if (!m) return 0;
    const isReal = expTok.includes('.') || /[eEdD]/.test(expTok);
    if (!isReal) return 0; // целое — точное совпадение
    const decimals = (m[2] || '').length;
    const exp = m[3] ? parseInt(m[3], 10) : 0;
    return 0.5000001 * Math.pow(10, exp - decimals);
  }

  function numbersEqual(actTok, expTok) {
    const a = toNumber(actTok), b = toNumber(expTok);
    if (!isFinite(a) || !isFinite(b)) return a === b;
    const tol = Math.max(tolerance(expTok), 1e-9 * Math.abs(b), 1e-12);
    return Math.abs(a - b) <= tol;
  }

  function tokenize(text, splitPunct) {
    const re = splitPunct ? /[\s=,;:()\[\]]+/ : /\s+/;
    return String(text).split(re).filter((t) => t.length > 0);
  }

  // Возвращает { ok, message }
  function compare(actual, expected) {
    const expTokens = tokenize(expected, false);
    const numericOnly = expTokens.length > 0 && expTokens.every(isNumber);
    if (numericOnly) {
      // Сравниваем только числа: подписи вроде "Сумма =" можно печатать
      const actNums = tokenize(actual, true).filter(isNumber);
      if (actNums.length !== expTokens.length) {
        return {
          ok: false,
          message: `Ожидалось чисел: ${expTokens.length}, напечатано: ${actNums.length}`,
        };
      }
      for (let i = 0; i < expTokens.length; i++) {
        if (!numbersEqual(actNums[i], expTokens[i])) {
          return { ok: false, message: `Число №${i + 1}: ожидалось ${expTokens[i]}, получено ${actNums[i]}` };
        }
      }
      return { ok: true, message: 'Верно' };
    }
    const actTokens = tokenize(actual, false);
    const n = Math.max(actTokens.length, expTokens.length);
    for (let i = 0; i < n; i++) {
      const a = actTokens[i], e = expTokens[i];
      if (a === undefined) return { ok: false, message: `Вывод короче ожидаемого: не хватает «${e}»` };
      if (e === undefined) return { ok: false, message: `Лишний вывод: «${a}»` };
      if (isNumber(e) && isNumber(a)) {
        if (!numbersEqual(a, e)) return { ok: false, message: `Ожидалось ${e}, получено ${a}` };
      } else if (a.toLowerCase() !== e.toLowerCase()) {
        return { ok: false, message: `Ожидалось «${e}», получено «${a}»` };
      }
    }
    return { ok: true, message: 'Верно' };
  }

  // Итог одного теста задачи: run — результат запуска с сервера, test — описание теста
  function verdict(run, test) {
    if (run.timedOut) return { ok: false, message: 'Превышено время работы (бесконечный цикл?)' };
    if (run.exitCode !== 0) return { ok: false, message: 'Ошибка во время выполнения' };
    const expFiles = test.expectFiles || [];
    if (test.expect || !expFiles.length) {
      const v = compare(run.stdout, test.expect || '');
      if (!v.ok) return v;
    }
    for (const ef of expFiles) {
      const got = (run.files || []).find((f) => f.name === ef.name);
      if (!got) return { ok: false, message: `Программа не создала файл ${ef.name}` };
      if (got.content === null) return { ok: false, message: `Файл ${ef.name} слишком большой` };
      const v = compare(got.content, ef.content);
      if (!v.ok) return { ok: false, message: `Файл ${ef.name}: ${v.message}` };
    }
    return { ok: true, message: 'Верно' };
  }

  const api = { compare, verdict, tokenize, isNumber, tolerance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Checker = api;
})(typeof window !== 'undefined' ? window : globalThis);
