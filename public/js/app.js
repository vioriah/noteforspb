// ФортранЛаб — интерфейс блокнота в стиле Colab.
(function () {
  'use strict';
  const { createEditor, autoGrow } = window.CodeEditor;
  const md = window.Markdown;

  // ---------------- утилиты ----------------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = (sel) => document.querySelector(sel);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('flab:' + k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('flab:' + k, JSON.stringify(v)); } catch (e) { toast('Не удалось сохранить: ' + e.message); } },
    del(k) { localStorage.removeItem('flab:' + k); },
  };
  function toast(msg, ms = 2600) {
    const t = h('div', { class: 'toast', text: msg });
    document.body.append(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
  }
  function download(name, content, type = 'text/plain') {
    const a = h('a', { href: URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' })), download: name });
    document.body.append(a); a.click(); a.remove();
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // ---------------- состояние ----------------
  const state = {
    course: [], // [{title, lessons:[{id, file, title, tasks:[ids], src}]}]
    lessonsById: {},
    solved: new Set(store.get('solved', [])),
    nb: null, // текущий блокнот
    cellViews: [],
    outputs: {}, // id ячейки -> последний результат (на время сессии)
    server: null,
  };

  function markSolved(id) {
    state.solved.add(id);
    store.set('solved', [...state.solved]);
    renderSidebar();
  }

  // ---------------- работа с сервером ----------------
  async function apiRun(payload) {
    let res;
    try {
      res = await fetch('api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {
      return { error: 'Сервер недоступен. Запустите его командой «node server.js» (см. README).' };
    }
    try { return await res.json(); } catch (_) { return { error: `Ошибка сервера (HTTP ${res.status})` }; }
  }
  async function checkServer() {
    const pill = $('#server-status');
    try {
      const r = await fetch('api/health');
      const j = await r.json();
      state.server = j;
      pill.className = 'status ok';
      pill.textContent = '● ' + (j.compiler.match(/GNU Fortran.*?(\d+\.\d+\.\d+)/) ? 'gfortran ' + j.compiler.match(/(\d+\.\d+\.\d+)/)[1] : j.compiler);
      pill.title = j.compiler;
    } catch (_) {
      pill.className = 'status bad';
      pill.textContent = '● сервер недоступен';
      pill.title = 'Запустите: node server.js';
    }
  }

  // ---------------- модули в ячейках ----------------
  function stripComments(src) { return src.split('\n').map((l) => l.replace(/!.*$/, '')).join('\n'); }
  function isModuleOnly(src) {
    const s = stripComments(src);
    const first = s.split('\n').map((l) => l.trim()).find((l) => l);
    return !!first && /^module\s+(?!procedure\b)\w+/i.test(first) && !/^\s*program\b/im.test(s);
  }
  function hasProgram(src) { return /^\s*program\b/im.test(stripComments(src)); }

  function buildSources(cellIndex, code) {
    const sources = [];
    const cells = state.nb.cells;
    let k = 0;
    for (let i = 0; i < cellIndex; i++) {
      const c = cells[i];
      if (c.type === 'code' && isModuleOnly(c.src)) sources.push({ name: `mod${++k}.f90`, content: c.src });
    }
    sources.push({ name: 'main.f90', content: code });
    if (isModuleOnly(code)) sources.push({ name: 'zz_stub.f90', content: 'program module_check\nend program module_check\n' });
    return sources;
  }

  // ---------------- отображение результата ----------------
  function renderCompileMessages(text, editor) {
    const box = h('div', { class: 'out-compile' });
    box.append(h('pre', { class: 'out-pre err', text: text.trim() }));
    const hints = window.Hints.hintsFor(text);
    if (hints.length) box.append(h('div', { class: 'hints' }, hints.map((x) => h('div', { class: 'hint', html: '💡 ' + x }))));
    if (editor) {
      const lines = window.Hints.errorLines(text, 'main.f90');
      editor.markErrors(lines);
    }
    return box;
  }

  function renderRun(run, opts) {
    const frag = h('div', { class: 'out-run' });
    const meta = [];
    if (run.stdout) frag.append(h('pre', { class: 'out-pre', text: run.stdout }));
    if (run.stderr) {
      frag.append(h('pre', { class: 'out-pre err', text: run.stderr }));
      const hints = window.Hints.hintsFor(run.stderr);
      if (hints.length) frag.append(h('div', { class: 'hints' }, hints.map((x) => h('div', { class: 'hint', html: '💡 ' + x }))));
      if (opts && opts.editor) {
        const lines = window.Hints.errorLines(run.stderr, 'main.f90');
        if (lines.length) opts.editor.markErrors(lines);
      }
    }
    if (run.timedOut) {
      frag.append(h('div', { class: 'hint warn', html: `⏱ Программа работала дольше ${(state.server && state.server.runTimeoutMs / 1000) || 5} с и была остановлена. Возможно, бесконечный цикл (например, <code>do while</code>, условие которого не меняется) или программа ждёт ввода, которого нет.` }));
    }
    if (run.truncated) frag.append(h('div', { class: 'hint warn', text: 'Вывод слишком большой и был обрезан.' }));
    if (!run.stdout && !run.stderr && !run.timedOut) frag.append(h('div', { class: 'muted small', text: '(программа ничего не напечатала)' }));
    if (run.exitCode !== 0 && !run.timedOut && run.exitCode !== null) meta.push(`код завершения ${run.exitCode}`);
    if (run.signal && !run.timedOut) meta.push(`сигнал ${run.signal}`);
    meta.push(`${run.timeMs} мс`);

    // файлы, созданные программой
    if (run.files && run.files.length) {
      const fl = h('div', { class: 'out-files' }, h('div', { class: 'small muted', text: 'Программа записала файлы:' }));
      run.files.forEach((f) => {
        const row = h('div', { class: 'out-file' });
        row.append(h('span', { class: 'fname', text: '📄 ' + f.name }));
        if (f.content !== null) {
          const pre = h('pre', { class: 'out-pre file-preview', text: f.content.length > 4000 ? f.content.slice(0, 4000) + '\n…' : f.content });
          pre.hidden = true;
          row.append(
            h('button', { class: 'btn-link', onclick: () => { pre.hidden = !pre.hidden; } }, 'показать'),
            h('button', { class: 'btn-link', onclick: () => download(f.name, f.content) }, 'скачать'),
            h('button', { class: 'btn-link', onclick: () => { upsertFile(f.name, f.content); toast(`Файл ${f.name} добавлен в блокнот`); } }, 'в файлы блокнота'),
            h('button', { class: 'btn-link', onclick: () => togglePlot(fl, f.content) }, '📈 график'),
          );
          fl.append(row, pre);
        } else {
          row.append(h('span', { class: 'muted small', text: ` (${f.size} байт — слишком большой для просмотра)` }));
          fl.append(row);
        }
      });
      frag.append(fl);
    }
    const bar = h('div', { class: 'out-meta' }, h('span', { text: meta.join(' · ') }));
    if (run.stdout && window.Plot.parseTable(run.stdout)) {
      bar.append(h('button', { class: 'btn-link', onclick: () => togglePlot(frag, run.stdout) }, '📈 график'));
    }
    if (run.stdout) bar.append(h('button', { class: 'btn-link', onclick: () => { navigator.clipboard.writeText(run.stdout); toast('Вывод скопирован'); } }, 'копировать'));
    frag.prepend(bar);
    return frag;
  }

  function togglePlot(container, text) {
    const ex = container.querySelector(':scope > .plot-panel');
    if (ex) { ex.remove(); return; }
    container.append(window.Plot.createPlotPanel(text));
  }

  // ---------------- ячейки ----------------
  function cellToolbar(cell, idx, extra) {
    const n = state.nb.cells.length;
    return h('div', { class: 'cell-tools' },
      extra || null,
      h('button', { class: 'icon', title: 'Вверх', disabled: idx === 0, onclick: () => moveCell(idx, -1) }, '↑'),
      h('button', { class: 'icon', title: 'Вниз', disabled: idx === n - 1, onclick: () => moveCell(idx, 1) }, '↓'),
      h('button', { class: 'icon', title: 'Удалить ячейку', onclick: () => deleteCell(idx) }, '🗑'),
    );
  }

  function mdCellView(cell, idx) {
    const el = h('div', { class: 'cell md-cell', 'data-id': cell.id });
    const view = h('div', { class: 'md-view', html: md.render(cell.src || '*Пустая текстовая ячейка — дважды щёлкните, чтобы редактировать*') });
    let editing = false;
    const ta = h('textarea', { class: 'md-edit', spellcheck: 'true' });
    const fit = autoGrow(ta);
    const done = () => {
      if (!editing) return;
      editing = false;
      cell.src = ta.value;
      view.innerHTML = md.render(cell.src || '*Пустая текстовая ячейка*');
      ta.replaceWith(view);
      el.classList.remove('editing');
      save();
    };
    const edit = () => {
      if (editing) return;
      editing = true;
      ta.value = cell.src;
      view.replaceWith(ta);
      el.classList.add('editing');
      fit();
      ta.focus();
    };
    ta.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) || e.key === 'Escape') { e.preventDefault(); done(); }
    });
    ta.addEventListener('blur', done);
    view.addEventListener('dblclick', edit);
    el.append(cellToolbar(cell, idx, h('button', { class: 'icon', title: 'Редактировать', onclick: edit }, '✎')), view);
    return { el, focus: edit };
  }

  function codeCellView(cell, idx) {
    const el = h('div', { class: 'cell code-cell', 'data-id': cell.id });
    const runBtn = h('button', { class: 'run-btn', title: 'Запустить (Shift+Enter)' }, '▶');
    const editor = createEditor({
      value: cell.src,
      onChange: (v) => { cell.src = v; save(); badge.textContent = isModuleOnly(v) ? 'модуль' : ''; },
      onRun: ({ advance }) => { run(); if (advance) focusNext(idx); },
    });
    const badge = h('span', { class: 'badge', text: isModuleOnly(cell.src) ? 'модуль' : '' });
    const stdinTa = h('textarea', { class: 'stdin', placeholder: 'Ввод с клавиатуры (stdin): то, что программа прочитает через read(*,*)', spellcheck: 'false' });
    stdinTa.value = cell.stdin || '';
    const stdinBox = h('div', { class: 'stdin-box' }, h('div', { class: 'small muted', text: 'Ввод (stdin)' }), stdinTa);
    stdinBox.hidden = !cell.stdin && !cell.showStdin;
    const fitStdin = autoGrow(stdinTa);
    stdinTa.addEventListener('input', () => { cell.stdin = stdinTa.value; save(); });
    const out = h('div', { class: 'output' });

    const stdinBtn = h('button', { class: 'icon', title: 'Показать/скрыть поле ввода stdin', onclick: () => {
      stdinBox.hidden = !stdinBox.hidden;
      cell.showStdin = !stdinBox.hidden;
      if (!stdinBox.hidden) { fitStdin(); stdinTa.focus(); }
    } }, '⌨');
    const dlBtn = h('button', { class: 'icon', title: 'Скачать как .f90', onclick: () => download(guessName(cell.src), cell.src) }, '⤓');

    let running = false;
    async function run() {
      if (running) return;
      running = true;
      el.classList.add('running');
      runBtn.textContent = '■';
      out.innerHTML = '';
      out.append(h('div', { class: 'muted small', text: 'Компиляция и запуск…' }));
      editor.markErrors([]);
      const res = await apiRun({ sources: buildSources(idx, cell.src), files: state.nb.files || [], runs: [{ stdin: cell.stdin || '' }] });
      out.innerHTML = '';
      running = false;
      el.classList.remove('running');
      runBtn.textContent = '▶';
      state.outputs[cell.id] = res;
      if (el.isConnected) showResult(res);
      else {
        // блокнот успели перерисовать (например, добавили ячейку) — выводим в новое представление
        const v = state.cellViews.find((x) => x.cellId === cell.id);
        if (v && v.show) v.show(res);
      }
      return res;
    }
    function showResult(res) {
      out.innerHTML = '';
      if (res.error) { out.append(h('div', { class: 'hint warn', text: res.error })); return; }
      if (!res.compile.ok) {
        out.append(h('div', { class: 'out-title err', text: '✗ Ошибка компиляции' }), renderCompileMessages(res.compile.output, editor));
        return;
      }
      if (res.compile.output.trim()) {
        const det = h('details', { class: 'warnings' }, h('summary', { text: '⚠ Предупреждения компилятора' }), renderCompileMessages(res.compile.output, null));
        out.append(det);
      }
      if (isModuleOnly(cell.src)) {
        out.append(h('div', { class: 'out-title ok', text: '✓ Модуль скомпилирован. Его можно подключать через use в ячейках ниже.' }));
        return;
      }
      out.append(renderRun(res.runs[0], { editor }));
    }
    runBtn.addEventListener('click', run);
    if (state.outputs[cell.id]) showResult(state.outputs[cell.id]);

    el.append(
      cellToolbar(cell, idx, [badge, stdinBtn, dlBtn]),
      h('div', { class: 'code-row' }, h('div', { class: 'run-col' }, runBtn), h('div', { class: 'code-col' }, editor.el, stdinBox)),
      out,
    );
    return { el, run, focus: () => editor.focus(), isCode: true, cellId: cell.id, show: showResult };
  }

  function taskCellView(cell, idx) {
    const t = cell.task;
    if (cell.src === undefined) cell.src = t.starter;
    const solved = () => state.solved.has(t.id);
    const el = h('div', { class: 'cell task-cell' + (solved() ? ' solved' : ''), 'data-id': cell.id });
    const status = h('span', { class: 'task-status', text: solved() ? '✓ решено' : '' });
    const head = h('div', { class: 'task-head' }, h('span', { class: 'task-label', text: 'Задача' }), h('span', { class: 'task-title', text: t.title }), status);
    const statement = h('div', { class: 'md-view', html: md.render(t.statement) });
    const editor = createEditor({
      value: cell.src,
      onChange: (v) => { cell.src = v; save(); },
      onRun: ({ advance }) => { if (advance) check(); else runOnce(); },
    });
    const stdinTa = h('textarea', { class: 'stdin', spellcheck: 'false', placeholder: 'Ввод для пробного запуска' });
    stdinTa.value = cell.stdin !== undefined ? cell.stdin : (t.tests[0] ? t.tests[0].stdin : '');
    stdinTa.addEventListener('input', () => { cell.stdin = stdinTa.value; save(); });
    const fitStdin = autoGrow(stdinTa);
    const stdinBox = h('div', { class: 'stdin-box' }, h('div', { class: 'small muted', text: 'Ввод (stdin) для пробного запуска' }), stdinTa);
    stdinBox.hidden = !stdinTa.value.trim();
    const out = h('div', { class: 'output' });
    const hintBox = h('div', { class: 'task-hints' });
    let hintsShown = 0;

    const files = () => [...(t.files || []), ...(state.nb.files || []).filter((f) => !(t.files || []).some((tf) => tf.name === f.name))];

    async function runOnce() {
      out.innerHTML = '';
      out.append(h('div', { class: 'muted small', text: 'Компиляция и запуск…' }));
      editor.markErrors([]);
      const res = await apiRun({ sources: buildSources(idx, cell.src), files: files(), runs: [{ stdin: stdinTa.value }] });
      out.innerHTML = '';
      if (res.error) { out.append(h('div', { class: 'hint warn', text: res.error })); return; }
      if (!res.compile.ok) { out.append(h('div', { class: 'out-title err', text: '✗ Ошибка компиляции' }), renderCompileMessages(res.compile.output, editor)); return; }
      out.append(renderRun(res.runs[0], { editor }));
    }

    async function check() {
      if (!hasProgram(cell.src)) { out.innerHTML = ''; out.append(h('div', { class: 'hint warn', html: 'В решении нет <code>program</code> … <code>end program</code>.' })); return; }
      out.innerHTML = '';
      out.append(h('div', { class: 'muted small', text: `Проверка на ${t.tests.length} тестах…` }));
      editor.markErrors([]);
      const res = await apiRun({ sources: buildSources(idx, cell.src), files: files(), runs: t.tests.map((x) => ({ stdin: x.stdin, files: x.files })) });
      out.innerHTML = '';
      if (res.error) { out.append(h('div', { class: 'hint warn', text: res.error })); return; }
      if (!res.compile.ok) { out.append(h('div', { class: 'out-title err', text: '✗ Ошибка компиляции' }), renderCompileMessages(res.compile.output, editor)); return; }
      let passed = 0;
      const list = h('div', { class: 'tests' });
      t.tests.forEach((test, i) => {
        const r = res.runs[i];
        const verdict = window.Checker.verdict(r, test);
        if (verdict.ok) passed++;
        const det = h('details', { class: 'test ' + (verdict.ok ? 'pass' : 'fail') });
        det.append(h('summary', {}, h('b', { text: `${verdict.ok ? '✓' : '✗'} Тест ${i + 1}${test.name ? ' — ' + test.name : ''}` }), ' ', h('span', { class: 'muted', text: verdict.message })));
        const grid = h('div', { class: 'test-grid' },
          h('div', {}, h('div', { class: 'small muted', text: 'Ввод' }), h('pre', { class: 'out-pre', text: [test.stdin, ...(test.files || []).map((f) => `— файл ${f.name}:\n${f.content}`)].filter(Boolean).join('\n') || '(пусто)' })),
          h('div', {}, h('div', { class: 'small muted', text: 'Ожидается' }), h('pre', { class: 'out-pre', text: [test.expect, ...(test.expectFiles || []).map((f) => `— файл ${f.name}:\n${f.content}`)].filter(Boolean).join('\n') })),
          h('div', {}, h('div', { class: 'small muted', text: 'Ваш вывод' }), h('pre', { class: 'out-pre' + (verdict.ok ? '' : ' err'), text: [r.stdout, r.stderr, ...(test.expectFiles || []).map((ef) => { const g = (r.files || []).find((f) => f.name === ef.name); return `— файл ${ef.name}:\n${g ? g.content : '(не создан)'}`; })].filter(Boolean).join('\n') || '(пусто)' })),
        );
        det.append(grid);
        if (r.stderr) {
          const hints = window.Hints.hintsFor(r.stderr);
          if (hints.length) det.append(h('div', { class: 'hints' }, hints.map((x) => h('div', { class: 'hint', html: '💡 ' + x }))));
        }
        if (!verdict.ok && passed === i) det.open = true;
        list.append(det);
      });
      const all = passed === t.tests.length;
      out.append(h('div', { class: 'out-title ' + (all ? 'ok' : 'err'), text: all ? `🎉 Все тесты пройдены (${passed}/${t.tests.length})!` : `Пройдено тестов: ${passed} из ${t.tests.length}` }), list);
      if (all) {
        markSolved(t.id);
        el.classList.add('solved');
        status.textContent = '✓ решено';
      }
    }

    const btns = h('div', { class: 'task-btns' },
      h('button', { class: 'btn primary', onclick: check, title: 'Shift+Enter' }, '✓ Проверить'),
      h('button', { class: 'btn', onclick: runOnce, title: 'Ctrl+Enter' }, '▶ Запустить'),
      h('button', { class: 'btn', onclick: () => { stdinBox.hidden = !stdinBox.hidden; if (!stdinBox.hidden) fitStdin(); } }, '⌨ Ввод'),
      t.hints.length ? h('button', { class: 'btn', onclick: () => {
        if (hintsShown >= t.hints.length) { toast('Подсказок больше нет'); return; }
        hintBox.append(h('div', { class: 'hint', html: `💡 <b>Подсказка ${hintsShown + 1}.</b> ` + md.render(t.hints[hintsShown]).replace(/^<p>|<\/p>$/g, '') }));
        hintsShown++;
      } }, '💡 Подсказка') : null,
      t.solution ? h('button', { class: 'btn ghost', onclick: () => {
        if (!confirm('Показать эталонное решение? Сначала попробуйте решить сами 🙂')) return;
        const solEd = createEditor({ value: t.solution, readOnly: true });
        hintBox.append(h('div', { class: 'solution' }, h('div', { class: 'small muted', text: 'Эталонное решение (только чтение):' }), solEd.el,
          h('button', { class: 'btn-link', onclick: () => { if (confirm('Заменить ваш код эталонным решением?')) { editor.setValue(t.solution); cell.src = t.solution; save(); } } }, 'вставить в редактор')));
      } }, 'Решение') : null,
      h('button', { class: 'btn ghost', onclick: () => { if (confirm('Вернуть стартовый код задачи?')) { editor.setValue(t.starter); cell.src = t.starter; save(); } } }, '↺ Сброс'),
    );

    if (t.files && t.files.length) {
      statement.append(h('div', { class: 'small muted', text: 'Файлы задачи: ' + t.files.map((f) => f.name).join(', ') + ' (доступны программе при запуске)' }));
    }

    el.append(cellToolbar(cell, idx), head, statement, editor.el, stdinBox, btns, hintBox, out);
    return { el, focus: () => editor.focus() };
  }

  function guessName(src) {
    const m = stripComments(src).match(/^\s*(?:program|module)\s+(\w+)/im);
    return (m ? m[1] : 'program') + '.f90';
  }

  // ---------------- блокнот ----------------
  function newCell(type) {
    if (type === 'code') return { id: 'c' + uid(), type: 'code', src: 'program main\n  implicit none\n  \nend program main\n', stdin: '' };
    return { id: 'm' + uid(), type: 'md', src: '' };
  }

  function insertCell(idx, type) {
    const c = newCell(type);
    state.nb.cells.splice(idx, 0, c);
    save();
    renderNotebook();
    const v = state.cellViews[idx];
    if (v) { v.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); v.focus(); }
  }
  function moveCell(idx, d) {
    const cells = state.nb.cells;
    const j = idx + d;
    if (j < 0 || j >= cells.length) return;
    [cells[idx], cells[j]] = [cells[j], cells[idx]];
    save();
    renderNotebook();
  }
  function deleteCell(idx) {
    const c = state.nb.cells[idx];
    if (c.type !== 'md' || c.src.trim()) {
      if (!confirm('Удалить ячейку?')) return;
    }
    state.nb.cells.splice(idx, 1);
    save();
    renderNotebook();
  }
  function focusNext(idx) {
    const v = state.cellViews[idx + 1];
    if (v) { v.focus(); v.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } else insertCell(idx + 1, 'code');
  }

  const save = debounce(() => {
    const nb = state.nb;
    if (!nb) return;
    if (nb.kind === 'lesson') {
      store.set('lesson:' + nb.id, { hash: nb.hash, cells: nb.cells, files: nb.files });
    } else if (nb.kind === 'user') {
      nb.updated = Date.now();
      store.set('nb:' + nb.id, nb);
      const idx = store.get('nbindex', []);
      const e = idx.find((x) => x.id === nb.id);
      if (e) { e.title = nb.title; e.updated = nb.updated; } else idx.unshift({ id: nb.id, title: nb.title, updated: nb.updated });
      store.set('nbindex', idx);
    }
  }, 400);

  function inserter(idx) {
    return h('div', { class: 'inserter' },
      h('button', { onclick: () => insertCell(idx, 'code') }, '+ Код'),
      h('button', { onclick: () => insertCell(idx, 'md') }, '+ Текст'),
    );
  }

  function renderNotebook() {
    const main = $('#main');
    const scroll = main.scrollTop;
    main.innerHTML = '';
    const nb = state.nb;
    const wrap = h('div', { class: 'notebook' });
    if (nb.banner) wrap.append(nb.banner);
    state.cellViews = [];
    wrap.append(inserter(0));
    nb.cells.forEach((cell, i) => {
      let v;
      if (cell.type === 'md') v = mdCellView(cell, i);
      else if (cell.type === 'task') v = taskCellView(cell, i);
      else v = codeCellView(cell, i);
      state.cellViews.push(v);
      wrap.append(v.el, inserter(i + 1));
    });
    if (!nb.cells.length) wrap.append(h('div', { class: 'muted center', text: 'Пустой блокнот. Добавьте ячейку кнопками выше.' }));
    if (nb.kind === 'lesson') wrap.append(lessonFooter(nb.id));
    main.append(wrap);
    main.scrollTop = scroll;
    renderTopbar();
  }

  function lessonFooter(id) {
    const flat = state.course.flatMap((s) => s.lessons);
    const i = flat.findIndex((l) => l.id === id);
    const prev = flat[i - 1], next = flat[i + 1];
    return h('div', { class: 'lesson-nav' },
      prev ? h('a', { class: 'btn', href: '#/lesson/' + prev.id }, '← ' + prev.title) : h('span'),
      next ? h('a', { class: 'btn primary', href: '#/lesson/' + next.id }, next.title + ' →') : h('span'),
    );
  }

  async function runAll() {
    for (const v of state.cellViews) {
      if (!v.isCode) continue;
      v.el.scrollIntoView({ block: 'nearest' });
      const res = await v.run();
      if (!res || res.error || !res.compile.ok) { toast('Остановлено: ошибка в ячейке'); break; }
    }
  }

  // ---------------- файлы блокнота ----------------
  function upsertFile(name, content) {
    const files = state.nb.files || (state.nb.files = []);
    const f = files.find((x) => x.name === name);
    if (f) f.content = content; else files.push({ name, content });
    save();
    renderFiles();
    renderTopbar();
  }

  function renderFiles() {
    const panel = $('#files-panel');
    if (panel.hidden) return;
    panel.innerHTML = '';
    const files = state.nb ? (state.nb.files || (state.nb.files = [])) : [];
    panel.append(h('div', { class: 'panel-head' }, h('b', { text: 'Файлы блокнота' }), h('button', { class: 'icon', onclick: () => { panel.hidden = true; } }, '✕')));
    panel.append(h('div', { class: 'small muted', text: 'Эти файлы лежат в рабочей папке программы: их можно открыть через open(unit, file="имя").' }));
    const list = h('div', { class: 'file-list' });
    files.forEach((f, i) => {
      const ta = h('textarea', { class: 'file-edit', spellcheck: 'false' });
      ta.value = f.content;
      ta.addEventListener('input', () => { f.content = ta.value; save(); });
      const body = h('div', { class: 'file-body' }, ta);
      body.hidden = true;
      list.append(h('div', { class: 'file-item' },
        h('div', { class: 'file-row' },
          h('button', { class: 'btn-link fname', onclick: () => { body.hidden = !body.hidden; if (!body.hidden) autoGrow(ta)(); } }, '📄 ' + f.name),
          h('span', { class: 'muted small', text: `${f.content.split('\n').length - 1} стр.` }),
          h('button', { class: 'icon', title: 'Скачать', onclick: () => download(f.name, f.content) }, '⤓'),
          h('button', { class: 'icon', title: 'Удалить', onclick: () => { if (confirm(`Удалить ${f.name}?`)) { files.splice(i, 1); save(); renderFiles(); renderTopbar(); } } }, '🗑'),
        ), body));
    });
    if (!files.length) list.append(h('div', { class: 'muted small', text: 'Файлов пока нет.' }));
    const upload = h('input', { type: 'file', multiple: true, hidden: true, onchange: async () => {
      for (const file of upload.files) {
        if (file.size > 1024 * 1024) { toast(`${file.name}: больше 1 МБ`); continue; }
        const name = file.name.replace(/[^A-Za-z0-9_.\-]/g, '_');
        upsertFile(name, await file.text());
      }
    } });
    panel.append(list, h('div', { class: 'panel-btns' },
      h('button', { class: 'btn', onclick: () => {
        const name = prompt('Имя файла (латиница, например data.txt):', 'data.txt');
        if (!name) return;
        if (!/^[A-Za-z0-9_][A-Za-z0-9_.\-]{0,63}$/.test(name)) { toast('Недопустимое имя файла'); return; }
        upsertFile(name, '');
      } }, '+ Новый файл'),
      h('button', { class: 'btn', onclick: () => upload.click() }, '⤒ Загрузить'), upload));
  }

  // ---------------- верхняя панель ----------------
  function renderTopbar() {
    const nb = state.nb;
    const bar = $('#nb-actions');
    bar.innerHTML = '';
    const title = $('#nb-title');
    title.innerHTML = '';
    if (!nb) return;
    if (nb.kind === 'user') {
      const inp = h('input', { class: 'title-input', value: nb.title });
      inp.addEventListener('input', () => { nb.title = inp.value || 'Без названия'; save(); renderSidebarDebounced(); });
      title.append(inp);
    } else {
      title.append(h('span', { text: nb.title }));
    }
    const nFiles = (nb.files || []).length;
    bar.append(
      h('button', { class: 'btn', onclick: runAll, title: 'Запустить все ячейки с кодом по порядку' }, '▶▶ Выполнить всё'),
      h('button', { class: 'btn', onclick: () => insertCell(nb.cells.length, 'code') }, '+ Код'),
      h('button', { class: 'btn', onclick: () => insertCell(nb.cells.length, 'md') }, '+ Текст'),
      h('button', { class: 'btn', onclick: () => { const p = $('#files-panel'); p.hidden = !p.hidden; renderFiles(); } }, `📁 Файлы${nFiles ? ' (' + nFiles + ')' : ''}`),
      menu(),
    );
  }

  function menu() {
    const nb = state.nb;
    const items = [
      ['Скачать весь код (.f90)', () => {
        const code = nb.cells.filter((c) => c.type !== 'md').map((c) => `! ===== ячейка =====\n${c.src}`).join('\n');
        download((nb.title || 'notebook').replace(/[^\wа-яё]+/gi, '_') + '.f90', code);
      }],
      ['Экспорт блокнота (.json)', () => download((nb.title || 'notebook').replace(/[^\wа-яё]+/gi, '_') + '.flab.json', JSON.stringify({ format: 'fortranlab', title: nb.title, cells: nb.cells, files: nb.files || [] }, null, 1), 'application/json')],
      ['Копировать в «Мои блокноты»', () => {
        const copy = { id: uid(), kind: 'user', title: nb.title + ' (копия)', cells: JSON.parse(JSON.stringify(nb.cells)), files: JSON.parse(JSON.stringify(nb.files || [])) };
        store.set('nb:' + copy.id, copy);
        const idx = store.get('nbindex', []);
        idx.unshift({ id: copy.id, title: copy.title, updated: Date.now() });
        store.set('nbindex', idx);
        location.hash = '#/nb/' + copy.id;
      }],
    ];
    if (nb.kind === 'lesson') items.push(['Сбросить урок к исходному', () => {
      if (!confirm('Все ваши изменения в этом уроке (код, ячейки, файлы) будут потеряны. Решённые задачи останутся отмеченными. Продолжить?')) return;
      store.del('lesson:' + nb.id);
      openLesson(nb.id);
    }]);
    if (nb.kind === 'user') items.push(['Удалить блокнот', () => {
      if (!confirm(`Удалить блокнот «${nb.title}»?`)) return;
      store.del('nb:' + nb.id);
      store.set('nbindex', store.get('nbindex', []).filter((x) => x.id !== nb.id));
      location.hash = '#/';
    }]);
    const dd = h('div', { class: 'dropdown' });
    const list = h('div', { class: 'dropdown-menu' }, items.map(([label, fn]) => h('button', { onclick: () => { dd.classList.remove('open'); fn(); } }, label)));
    dd.append(h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); dd.classList.toggle('open'); } }, '⋯'), list);
    return dd;
  }

  // ---------------- боковая панель ----------------
  function renderSidebar() {
    const sb = $('#sidebar-content');
    sb.innerHTML = '';
    const cur = location.hash;
    let total = 0, done = 0;
    state.course.forEach((sec) => {
      sb.append(h('div', { class: 'sb-section', text: sec.title }));
      sec.lessons.forEach((l) => {
        const n = l.tasks.length;
        const d = l.tasks.filter((t) => state.solved.has(t)).length;
        total += n; done += d;
        const href = '#/lesson/' + l.id;
        sb.append(h('a', { class: 'sb-item' + (cur === href ? ' active' : '') + (n && d === n ? ' complete' : ''), href },
          h('span', { class: 'sb-title', text: l.title }),
          n ? h('span', { class: 'sb-count', text: `${d}/${n}` }) : null));
      });
    });
    sb.append(h('div', { class: 'sb-section' }, 'Мои блокноты ', h('button', { class: 'icon small', title: 'Новый блокнот', onclick: newNotebook }, '+')));
    const idx = store.get('nbindex', []);
    if (!idx.length) sb.append(h('div', { class: 'sb-empty muted small', text: 'Здесь будут ваши блокноты — песочница для своих программ.' }));
    idx.forEach((e) => {
      const href = '#/nb/' + e.id;
      sb.append(h('a', { class: 'sb-item' + (cur === href ? ' active' : ''), href }, h('span', { class: 'sb-title', text: '📓 ' + e.title })));
    });
    sb.append(h('div', { class: 'sb-actions' },
      h('button', { class: 'btn small', onclick: newNotebook }, '+ Новый блокнот'),
      h('button', { class: 'btn small', onclick: importNotebook }, '⤒ Импорт')));
    $('#progress').textContent = total ? `Решено задач: ${done} из ${total}` : '';
    $('#progress-bar').style.width = total ? (100 * done / total) + '%' : '0';
  }
  const renderSidebarDebounced = debounce(renderSidebar, 300);

  function newNotebook() {
    const nb = {
      id: uid(), kind: 'user', title: 'Новый блокнот',
      cells: [
        { id: 'm' + uid(), type: 'md', src: '# Новый блокнот\n\nДважды щёлкните по тексту, чтобы его изменить. Запуск ячейки с кодом — **Shift+Enter**.' },
        { id: 'c' + uid(), type: 'code', src: 'program hello\n  implicit none\n  print *, "Привет, океан!"\nend program hello\n', stdin: '' },
      ],
      files: [],
    };
    store.set('nb:' + nb.id, nb);
    const idx = store.get('nbindex', []);
    idx.unshift({ id: nb.id, title: nb.title, updated: Date.now() });
    store.set('nbindex', idx);
    location.hash = '#/nb/' + nb.id;
  }

  function importNotebook() {
    const inp = h('input', { type: 'file', accept: '.json,.f90,.f95,.f,.for,.txt' });
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      const text = await file.text();
      let nb;
      if (/\.json$/i.test(file.name)) {
        try {
          const j = JSON.parse(text);
          if (!Array.isArray(j.cells)) throw new Error('нет ячеек');
          nb = { id: uid(), kind: 'user', title: j.title || file.name, cells: j.cells.map((c) => ({ ...c, id: (c.type === 'md' ? 'm' : 'c') + uid() })), files: j.files || [] };
        } catch (e) { toast('Не удалось прочитать файл: ' + e.message); return; }
      } else {
        nb = { id: uid(), kind: 'user', title: file.name, cells: [{ id: 'c' + uid(), type: 'code', src: text, stdin: '' }], files: [] };
      }
      store.set('nb:' + nb.id, nb);
      const idx = store.get('nbindex', []);
      idx.unshift({ id: nb.id, title: nb.title, updated: Date.now() });
      store.set('nbindex', idx);
      location.hash = '#/nb/' + nb.id;
    };
    inp.click();
  }

  // ---------------- маршрутизация ----------------
  function openLesson(id) {
    const l = state.lessonsById[id];
    if (!l) { renderHome(); return; }
    const parsed = window.Lessons.parseLesson(l.src, id);
    const hash = window.Lessons.hash(l.src);
    const saved = store.get('lesson:' + id, null);
    const nb = { id, kind: 'lesson', title: parsed.title, hash, cells: parsed.cells, files: parsed.files };
    if (saved) {
      // условия и тесты задач всегда берём из актуальной версии урока, код — из сохранённого
      const fresh = {};
      parsed.cells.forEach((c) => { if (c.type === 'task') fresh[c.task.id] = c.task; });
      saved.cells.forEach((c) => { if (c.type === 'task' && fresh[c.task.id]) c.task = fresh[c.task.id]; });
      nb.cells = saved.cells;
      nb.files = saved.files || parsed.files;
      if (saved.hash !== hash) {
        nb.banner = h('div', { class: 'banner' },
          'Этот урок обновился с момента вашего последнего визита. ',
          h('button', { class: 'btn small', onclick: () => {
            if (!confirm('Загрузить новую версию урока? Ваши правки в этом уроке пропадут.')) return;
            store.del('lesson:' + id); openLesson(id);
          } }, 'Загрузить новую версию'),
          h('button', { class: 'btn small ghost', onclick: () => { saved.hash = hash; store.set('lesson:' + id, saved); delete nb.banner; renderNotebook(); } }, 'Оставить мою'));
      }
    }
    state.nb = nb;
    renderNotebook();
    $('#main').scrollTop = 0;
    renderFiles();
  }

  function openUserNotebook(id) {
    const nb = store.get('nb:' + id, null);
    if (!nb) { toast('Блокнот не найден'); location.hash = '#/'; return; }
    nb.kind = 'user';
    state.nb = nb;
    renderNotebook();
    $('#main').scrollTop = 0;
    renderFiles();
  }

  function renderHome() {
    state.nb = null;
    renderTopbar();
    $('#nb-title').textContent = 'Главная';
    const main = $('#main');
    main.innerHTML = '';
    const home = h('div', { class: 'notebook home' });
    const intro = state.lessonsById.welcome;
    if (intro) home.append(h('div', { class: 'cell md-cell' }, h('div', { class: 'md-view', html: md.render(intro.src) })));
    const grid = h('div', { class: 'lesson-grid' });
    state.course.forEach((sec) => {
      if (sec.hideOnHome) return;
      grid.append(h('h3', { class: 'grid-section', text: sec.title }));
      sec.lessons.forEach((l) => {
        const n = l.tasks.length, d = l.tasks.filter((t) => state.solved.has(t)).length;
        grid.append(h('a', { class: 'lesson-card' + (n && d === n ? ' complete' : ''), href: '#/lesson/' + l.id },
          h('div', { class: 'lc-title', text: l.title }),
          h('div', { class: 'lc-desc', text: l.desc || '' }),
          n ? h('div', { class: 'lc-progress' }, h('div', { class: 'lc-track' }, h('div', { class: 'lc-bar', style: `width:${100 * d / n}%` })), h('span', { text: `${d}/${n} задач` })) : null));
      });
    });
    home.append(grid);
    main.append(home);
  }

  function route() {
    const m = location.hash.match(/^#\/(lesson|nb)\/(.+)$/);
    if (m && m[1] === 'lesson') openLesson(decodeURIComponent(m[2]));
    else if (m && m[1] === 'nb') openUserNotebook(decodeURIComponent(m[2]));
    else renderHome();
    renderSidebar();
    document.body.classList.remove('sb-open');
  }

  // ---------------- загрузка курса ----------------
  async function loadCourse() {
    const index = await (await fetch('lessons/index.json')).json();
    const all = [];
    for (const sec of index.sections) {
      const s = { title: sec.title, hideOnHome: sec.hideOnHome, lessons: [] };
      for (const l of sec.lessons) {
        const p = fetch('lessons/' + l.file).then((r) => r.text()).then((src) => {
          const parsed = window.Lessons.parseLesson(src, l.id);
          const lesson = { id: l.id, file: l.file, desc: l.desc, title: l.title || parsed.title, src, tasks: parsed.cells.filter((c) => c.type === 'task').map((c) => c.task.id) };
          state.lessonsById[l.id] = lesson;
          return lesson;
        });
        all.push(p);
        s.lessons.push(p);
      }
      state.course.push(s);
    }
    await Promise.all(all);
    for (const s of state.course) s.lessons = await Promise.all(s.lessons);
    if (index.welcome) {
      state.lessonsById.welcome = { src: await (await fetch('lessons/' + index.welcome)).text() };
    }
  }

  async function init() {
    $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('sb-open'));
    document.addEventListener('click', () => document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open')));
    checkServer();
    setInterval(checkServer, 30000);
    try {
      await loadCourse();
    } catch (e) {
      $('#main').innerHTML = '';
      $('#main').append(h('div', { class: 'hint warn', text: 'Не удалось загрузить уроки: ' + e.message }));
      return;
    }
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
