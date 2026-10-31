// Подсветка синтаксиса Фортрана (свободная форма). Возвращает HTML.
(function (root) {
  'use strict';

  const KEYWORDS = new Set((
    'program end module contains use only implicit none subroutine function result recursive pure elemental ' +
    'call return stop error if then else elseif endif select case default do enddo while exit cycle ' +
    'go to goto continue where elsewhere forall associate block interface procedure intent in out inout ' +
    'parameter dimension allocatable allocate deallocate pointer target optional save public private ' +
    'type class extends abstract sequence data common equivalence external intrinsic format ' +
    'open close read write print inquire rewind backspace endfile nullify include kind len ' +
    'concurrent namelist entry pause import value bind enum enumerator'
  ).split(/\s+/));

  const TYPES = new Set('integer real double precision complex logical character'.split(' '));

  const INTRINSICS = new Set((
    'abs sqrt exp log log10 sin cos tan asin acos atan atan2 sinh cosh tanh mod modulo int nint real dble ' +
    'cmplx aimag conjg floor ceiling min max sign huge tiny epsilon size shape sum product maxval minval ' +
    'maxloc minloc count any all matmul transpose dot_product reshape spread pack merge trim adjustl adjustr ' +
    'len_trim index scan verify repeat char ichar achar iachar lge lgt lle llt allocated present associated ' +
    'random_number random_seed cpu_time date_and_time system_clock selected_real_kind selected_int_kind ' +
    'kind precision range lbound ubound cshift eoshift iostat_end new_line hypot norm2 bit_size ' +
    'is_iostat_end is_iostat_eor get_command_argument command_argument_count move_alloc storage_size'
  ).split(/\s+/));

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Токенизатор: комментарии, строки, числа, .операторы., идентификаторы
  const TOKEN = new RegExp([
    '(![^\\n]*)', // 1 комментарий
    '("(?:[^"\\n]|"")*"?|\'(?:[^\'\\n]|\'\')*\'?)', // 2 строка
    '(\\.(?:and|or|not|eqv|neqv|true|false|eq|ne|lt|le|gt|ge)\\.(?:_\\w+)?)', // 3 логические операторы
    '((?:\\d+\\.?\\d*|\\.\\d+)(?:[eEdD][+-]?\\d+)?(?:_\\w+)?)', // 4 число
    '([A-Za-z_]\\w*)', // 5 идентификатор
  ].join('|'), 'gi');

  function highlight(code) {
    let out = '';
    let last = 0;
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(code)) !== null) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      const t = m[0];
      if (m[1] !== undefined) out += '<span class="hl-com">' + esc(t) + '</span>';
      else if (m[2] !== undefined) out += '<span class="hl-str">' + esc(t) + '</span>';
      else if (m[3] !== undefined) out += '<span class="hl-op">' + esc(t) + '</span>';
      else if (m[4] !== undefined) out += '<span class="hl-num">' + esc(t) + '</span>';
      else {
        const low = t.toLowerCase();
        if (KEYWORDS.has(low)) out += '<span class="hl-kw">' + esc(t) + '</span>';
        else if (TYPES.has(low)) out += '<span class="hl-type">' + esc(t) + '</span>';
        else if (INTRINSICS.has(low)) out += '<span class="hl-fn">' + esc(t) + '</span>';
        else out += esc(t);
      }
      last = m.index + t.length;
      if (t.length === 0) TOKEN.lastIndex++;
    }
    if (last < code.length) out += esc(code.slice(last));
    return out;
  }

  root.FortranHighlight = { highlight, esc };
})(window);
