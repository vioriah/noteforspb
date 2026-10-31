// Разбор файлов уроков (.md с особыми блоками) в блокнот из ячеек.
//
//   ```fortran     — исполняемая ячейка кода
//   ```stdin       — входные данные для предыдущей ячейки кода
//   ```f90         — просто подсвеченный фрагмент внутри текста (не запускается)
//   ```file имя    — файл данных урока (виден программам), показывается в тексте
//   ~~~task        — задача с автопроверкой:
//        id: …  title: …  ---  условие (markdown)
//        @starter / @solution / @hint — стартовый код, эталон, подсказки
//        @file имя — файл данных (до @test — общий, после — для этого теста)
//        @test [название]  @stdin  @expect  @expectfile имя — тесты
(function (root) {
  'use strict';

  function parseTask(body, lessonId, n) {
    const lines = body.split('\n');
    const task = { id: `${lessonId}-t${n}`, title: 'Задача', statement: '', starter: '', solution: '', hints: [], tests: [], files: [] };
    let i = 0;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^---\s*$/.test(l)) { i++; break; }
      const m = l.match(/^(\w+)\s*:\s*(.*)$/);
      if (m) task[m[1]] = m[2].trim();
    }
    let section = 'statement';
    let buf = [];
    let curTest = null;
    let curFile = null;
    const commit = () => {
      const text = buf.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
      if (section === 'statement') task.statement = text;
      else if (section === 'starter') task.starter = text;
      else if (section === 'solution') task.solution = text;
      else if (section === 'hint') task.hints.push(text);
      else if (section === 'stdin' && curTest) curTest.stdin = text + '\n';
      else if (section === 'expect' && curTest) curTest.expect = text;
      else if ((section === 'file' || section === 'expectfile') && curFile) curFile.content = text + '\n';
      buf = [];
    };
    for (; i < lines.length; i++) {
      const m = lines[i].match(/^@(\w+)\s*(.*)$/);
      if (!m) { buf.push(lines[i]); continue; }
      commit();
      section = m[1];
      if (section === 'test') {
        curTest = { stdin: '', expect: '', name: m[2].trim(), files: [], expectFiles: [] };
        task.tests.push(curTest);
      } else if (section === 'file') {
        // @file до первого @test — общий файл задачи, после — файл конкретного теста
        curFile = { name: m[2].trim(), content: '' };
        (curTest ? curTest.files : task.files).push(curFile);
      } else if (section === 'expectfile' && curTest) {
        curFile = { name: m[2].trim(), content: '' };
        curTest.expectFiles.push(curFile);
      }
    }
    commit();
    if (!task.starter) task.starter = 'program main\n  implicit none\n\nend program main';
    return task;
  }

  function parseLesson(src, lessonId) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const cells = [];
    const files = [];
    let title = lessonId;
    let md = [];
    let codeN = 0, taskN = 0;
    const flushMd = () => {
      const text = md.join('\n').trim();
      if (text) cells.push({ id: `${lessonId}-m${cells.length}`, type: 'md', src: text });
      md = [];
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const h1 = line.match(/^#\s+(.*)$/);
      if (h1 && title === lessonId) title = h1[1].replace(/`/g, '').trim();
      const fence = line.match(/^(```|~~~)\s*(\w+)\s*(.*)$/);
      if (fence && ['fortran', 'stdin', 'task', 'file'].includes(fence[2])) {
        const kind = fence[2];
        const body = [];
        i++;
        while (i < lines.length && !(lines[i].startsWith(fence[1]) && lines[i].trim() === fence[1])) body.push(lines[i++]);
        i++;
        const text = body.join('\n');
        if (kind === 'fortran') {
          flushMd();
          cells.push({ id: `${lessonId}-c${codeN++}`, type: 'code', src: text, stdin: '' });
        } else if (kind === 'stdin') {
          const last = cells[cells.length - 1];
          if (last && last.type === 'code') last.stdin = text + '\n';
        } else if (kind === 'task') {
          flushMd();
          cells.push({ id: `${lessonId}-t${taskN}`, type: 'task', task: parseTask(text, lessonId, taskN++) });
        } else if (kind === 'file') {
          const name = fence[3].trim();
          files.push({ name, content: text + '\n' });
          md.push('```file ' + name, text, '```');
        }
        continue;
      }
      md.push(line);
      i++;
    }
    flushMd();
    return { id: lessonId, title, cells, files };
  }

  // Простой хеш содержимого — чтобы понять, что урок обновился
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  const api = { parseLesson, parseTask, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lessons = api;
})(typeof window !== 'undefined' ? window : globalThis);
