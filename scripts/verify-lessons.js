#!/usr/bin/env node
// Проверка курса: компилирует все примеры из уроков и прогоняет эталонные решения задач на тестах.
//   node scripts/verify-lessons.js            — проверить всё
//   node scripts/verify-lessons.js 05-loops   — только указанный урок
//   node scripts/verify-lessons.js --print    — показать вывод эталонных решений
'use strict';
const fs = require('fs');
const path = require('path');
const { handleRun } = require('../server.js');
const { parseLesson } = require('../public/js/lessons.js');
const { verdict } = require('../public/js/checker.js');

const root = path.join(__dirname, '..', 'public', 'lessons');
const args = process.argv.slice(2);
const PRINT = args.includes('--print');
const only = args.filter((a) => !a.startsWith('--'));

function isModuleOnly(src) {
  const s = src.split('\n').map((l) => l.replace(/!.*$/, '')).join('\n');
  const first = s.split('\n').map((l) => l.trim()).find((l) => l);
  return !!first && /^module\s+(?!procedure\b)\w+/i.test(first) && !/^\s*program\b/im.test(s);
}
// Ячейки, которые специально содержат ошибку, помечены в первой строке: "! (с ошибкой)"
const expectsError = (src) => /^\s*!.*\(с ошибкой\)/i.test(src.split('\n')[0]);

(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  let fails = 0, tasks = 0, cells = 0;
  for (const sec of index.sections) {
    for (const l of sec.lessons) {
      if (only.length && !only.includes(l.id)) continue;
      const lesson = parseLesson(fs.readFileSync(path.join(root, l.file), 'utf8'), l.id);
      console.log(`\n== ${l.id}: ${lesson.title}`);
      const mods = [];
      for (const cell of lesson.cells) {
        if (cell.type === 'code') {
          cells++;
          const sources = [...mods.map((m, i) => ({ name: `mod${i + 1}.f90`, content: m })), { name: 'main.f90', content: cell.src }];
          if (isModuleOnly(cell.src)) sources.push({ name: 'zz_stub.f90', content: 'program module_check\nend program module_check\n' });
          const res = await handleRun({ sources, files: lesson.files, runs: [{ stdin: cell.stdin || '' }] });
          const bad = res.error || !res.compile.ok || res.runs[0].exitCode !== 0 || res.runs[0].timedOut;
          const first = cell.src.split('\n').find((x) => x.trim()) || '';
          if (bad !== expectsError(cell.src)) {
            fails++;
            console.log(`  ✗ ячейка ${cell.id} (${first.trim()}): ${bad ? 'ошибка' : 'ожидалась ошибка, но всё прошло'}`);
            if (res.error) console.log('    ' + res.error);
            else if (!res.compile.ok) console.log(res.compile.output.replace(/^/gm, '    '));
            else console.log((res.runs[0].stderr || '').replace(/^/gm, '    '));
          } else {
            const warn = res.compile && res.compile.ok && res.compile.output.trim() && !expectsError(cell.src);
            console.log(`  ✓ ячейка ${cell.id}${warn ? ' (есть предупреждения)' : ''}`);
            if (warn && PRINT) console.log(res.compile.output.replace(/^/gm, '    '));
            if (PRINT && res.runs) console.log(res.runs[0].stdout.replace(/^/gm, '    | '));
          }
          if (isModuleOnly(cell.src)) mods.push(cell.src);
        } else if (cell.type === 'task') {
          tasks++;
          const t = cell.task;
          const res = await handleRun({
            sources: [{ name: 'main.f90', content: t.solution }],
            files: [...t.files, ...lesson.files.filter((f) => !t.files.some((x) => x.name === f.name))],
            runs: t.tests.map((x) => ({ stdin: x.stdin, files: x.files })),
          });
          if (res.error || !res.compile.ok) {
            fails++;
            console.log(`  ✗ задача ${t.id} «${t.title}»: решение не компилируется`);
            console.log(res.error || res.compile.output);
            continue;
          }
          if (res.compile.output.trim()) console.log(`  ⚠ задача ${t.id}: предупреждения в решении:\n` + res.compile.output.replace(/^/gm, '    '));
          let ok = 0;
          t.tests.forEach((test, i) => {
            const v = verdict(res.runs[i], test);
            if (v.ok) ok++;
            else {
              fails++;
              console.log(`  ✗ задача ${t.id} тест ${i + 1}: ${v.message}`);
              console.log('    вывод: ' + JSON.stringify(res.runs[i].stdout) + (res.runs[i].stderr ? ' stderr: ' + res.runs[i].stderr : ''));
            }
            if (PRINT) {
              console.log(`    тест ${i + 1}: ` + JSON.stringify(res.runs[i].stdout));
              res.runs[i].files.forEach((f) => console.log(`      файл ${f.name}: ` + JSON.stringify(f.content)));
            }
          });
          if (t.tests.length === 0) { fails++; console.log(`  ✗ задача ${t.id}: нет тестов`); }
          console.log(`  ${ok === t.tests.length ? '✓' : '✗'} задача ${t.id} «${t.title}»: ${ok}/${t.tests.length}`);
          // стартовый код должен хотя бы компилироваться
          const st = await handleRun({ sources: [{ name: 'main.f90', content: t.starter }], files: t.files, runs: [{ stdin: '' }] });
          if (!st.compile || !st.compile.ok) {
            if (!/\(с ошибкой\)/.test(t.starter)) { fails++; console.log(`  ✗ задача ${t.id}: стартовый код не компилируется`); }
          }
        }
      }
    }
  }
  console.log(`\nЯчеек кода: ${cells}, задач: ${tasks}, проблем: ${fails}`);
  process.exit(fails ? 1 : 0);
})();
