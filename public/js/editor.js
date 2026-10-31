// Лёгкий редактор кода: textarea поверх подсвеченного <pre>, номера строк, автоотступы.
(function (root) {
  'use strict';
  const { highlight } = root.FortranHighlight;
  const INDENT = '  ';
  const OPENERS = /^\s*(program|module|subroutine|function|recursive|pure|elemental|contains|type\s*[^(]|interface|select\s+case|case|else|do\b|.*\bthen\s*(!.*)?$|where\s*\(.*\)\s*$|block\b|associate|.*\bfunction\b|.*\bsubroutine\b)/i;

  function createEditor(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'editor';
    const gutter = document.createElement('div');
    gutter.className = 'editor-gutter';
    const scroller = document.createElement('div');
    scroller.className = 'editor-scroll';
    const inner = document.createElement('div');
    inner.className = 'editor-inner';
    const pre = document.createElement('pre');
    pre.className = 'editor-hl';
    pre.setAttribute('aria-hidden', 'true');
    const ta = document.createElement('textarea');
    ta.className = 'editor-ta';
    ta.spellcheck = false;
    ta.setAttribute('wrap', 'off');
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocomplete', 'off');
    ta.value = opts.value || '';
    if (opts.readOnly) ta.readOnly = true;
    if (opts.placeholder) ta.placeholder = opts.placeholder;
    inner.append(pre, ta);
    scroller.append(inner);
    wrap.append(gutter, scroller);

    let errorLines = new Set();
    let lineCount = 0;

    function render() {
      const v = ta.value;
      pre.innerHTML = highlight(v) + '\n';
      const n = v.split('\n').length;
      if (n !== lineCount || errorLines.size) {
        lineCount = n;
        let html = '';
        for (let i = 1; i <= n; i++) html += `<div class="${errorLines.has(i) ? 'ln err' : 'ln'}">${i}</div>`;
        gutter.innerHTML = html;
      }
    }

    function replaceRange(start, end, text, selStart, selEnd) {
      ta.focus();
      ta.setSelectionRange(start, end);
      // execCommand сохраняет историю отмены (Ctrl+Z)
      if (!document.execCommand('insertText', false, text)) {
        ta.setRangeText(text, start, end, 'end');
      }
      if (selStart !== undefined) ta.setSelectionRange(selStart, selEnd === undefined ? selStart : selEnd);
      render();
      if (opts.onChange) opts.onChange(ta.value);
    }

    function lineStartOf(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }

    ta.addEventListener('input', () => { if (errorLines.size) { errorLines = new Set(); lineCount = -1; } render(); if (opts.onChange) opts.onChange(ta.value); });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (opts.onRun) opts.onRun({ advance: e.shiftKey && !e.ctrlKey });
        return;
      }
      if (ta.readOnly) return;
      const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;
      if (e.key === 'Tab') {
        e.preventDefault();
        const ls = lineStartOf(s);
        if (s === en && !e.shiftKey) { replaceRange(s, en, INDENT); return; }
        // отступ / снятие отступа для выделенных строк
        let le = v.indexOf('\n', en - (en > s && v[en - 1] === '\n' ? 1 : 0));
        if (le === -1) le = v.length;
        const block = v.slice(ls, le);
        const lines = block.split('\n');
        const changed = lines.map((l) => e.shiftKey ? l.replace(/^ {1,2}/, '') : INDENT + l).join('\n');
        replaceRange(ls, le, changed, ls, ls + changed.length);
        return;
      }
      if (e.key === 'Enter' && !e.altKey) {
        e.preventDefault();
        let start = s;
        const end = en;
        const ls = lineStartOf(start);
        let line = v.slice(ls, start);
        let indent = (line.match(/^\s*/) || [''])[0];
        const code = line.replace(/!.*$/, '');
        let removed = 0;
        // автоматическое снятие отступа у end/else/case/contains, набранных на уровне тела блока
        if (/^\s*(end|else|case|contains)\b/i.test(code) && indent.length >= INDENT.length) {
          const prevLines = v.slice(0, ls).split('\n').filter((l) => l.trim());
          const prev = prevLines[prevLines.length - 1] || '';
          const prevIndent = (prev.match(/^\s*/) || [''])[0];
          const prevCode = prev.replace(/!.*$/, '');
          const prevOpens = OPENERS.test(prevCode) && !/^\s*end\b/i.test(prevCode);
          if (prevIndent.length === indent.length && !prevOpens) {
            indent = indent.slice(INDENT.length);
            removed = INDENT.length;
          }
        }
        let next = indent;
        if (OPENERS.test(code) && !/^\s*end\b/i.test(code)) {
          // "if (...) x = 1" без then — не открывает блок
          if (!/^\s*if\s*\(/i.test(code) || /\bthen\s*$/i.test(code)) next += INDENT;
        }
        if (removed) {
          // заменяем всю строку до курсора: убираем отступ и вставляем перевод строки
          const rest = line.slice(removed);
          replaceRange(ls, end, rest + '\n' + next);
        } else {
          replaceRange(start, end, '\n' + next);
        }
        return;
      }
      if (e.key === 'Backspace' && s === en && s > 0) {
        const ls = lineStartOf(s);
        const before = v.slice(ls, s);
        if (before.length >= 2 && /^ +$/.test(before) && before.length % 2 === 0) {
          e.preventDefault();
          replaceRange(s - 2, s, '');
        }
        return;
      }
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const ls = lineStartOf(s);
        let le = v.indexOf('\n', en);
        if (le === -1) le = v.length;
        const lines = v.slice(ls, le).split('\n');
        const allCommented = lines.every((l) => /^\s*!/.test(l) || !l.trim());
        const changed = lines.map((l) => {
          if (!l.trim()) return l;
          return allCommented ? l.replace(/^(\s*)! ?/, '$1') : l.replace(/^(\s*)/, '$1! ');
        }).join('\n');
        replaceRange(ls, le, changed, ls, ls + changed.length);
      }
    });

    ta.addEventListener('focus', () => wrap.classList.add('focused'));
    ta.addEventListener('blur', () => wrap.classList.remove('focused'));

    render();

    return {
      el: wrap,
      textarea: ta,
      getValue: () => ta.value,
      setValue(v) { ta.value = v; lineCount = -1; render(); },
      focus() { ta.focus(); },
      markErrors(lines) { errorLines = new Set(lines); lineCount = -1; render(); },
      gotoLine(n) {
        const lines = ta.value.split('\n');
        let pos = 0;
        for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
        ta.focus();
        ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
      },
    };
  }

  // Простое поле для текста (markdown, stdin, файлы) с автоматической высотой
  function autoGrow(ta) {
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, 34) + 'px'; };
    ta.addEventListener('input', fit);
    requestAnimationFrame(fit);
    return fit;
  }

  root.CodeEditor = { createEditor, autoGrow };
})(window);
