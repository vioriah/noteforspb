// Мини-рендерер Markdown: заголовки, абзацы, списки, таблицы, цитаты, код, ссылки, $формулы$.
(function (root) {
  'use strict';
  const { highlight, esc } = root.FortranHighlight;

  function inline(text) {
    const codes = [];
    // сначала вырезаем `код`, чтобы внутри не срабатывала разметка
    let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = esc(s);
    s = s.replace(/\$([^$\n]+)\$/g, (_, f) => {
      // индексы и степени внутри формул: x_i, x_{i-1}, 10^-5, x^{2n}
      f = f.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>').replace(/_([A-Za-zА-Яа-я0-9]+)/g, '<sub>$1</sub>');
      f = f.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>').replace(/\^([−-]?[A-Za-z0-9]+)/g, '<sup>$1</sup>');
      return '<span class="math">' + f + '</span>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const safe = /^(https?:|#|\.?\/)/.test(u) ? u : '#';
      return `<a href="${safe}" target="_blank" rel="noopener">${t}</a>`;
    });
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[+i]) + '</code>');
    return s;
  }

  function render(src) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let i = 0;
    let para = [];
    const flush = () => {
      if (para.length) { html += '<p>' + inline(para.join(' ')) + '</p>'; para = []; }
    };

    while (i < lines.length) {
      const line = lines[i];
      // блок кода
      const fence = line.match(/^(```|~~~)\s*(\w*)(.*)$/);
      if (fence) {
        flush();
        const lang = fence[2].toLowerCase();
        const body = [];
        i++;
        while (i < lines.length && !lines[i].startsWith(fence[1])) body.push(lines[i++]);
        i++;
        const code = body.join('\n');
        const content = (lang === 'fortran' || lang === 'f90') ? highlight(code) : esc(code);
        if (lang === 'file') {
          html += `<div class="md-file"><div class="md-file-name">📄 ${esc(fence[3].trim())}</div><pre class="md-code"><code>${content}</code></pre></div>`;
        } else {
          html += `<pre class="md-code"><code>${content}</code></pre>`;
        }
        continue;
      }
      if (!line.trim()) { flush(); i++; continue; }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { flush(); const n = h[1].length; html += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
      if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flush(); html += '<hr>'; i++; continue; }
      if (line.startsWith('>')) {
        flush();
        const body = [];
        while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
        html += '<blockquote>' + render(body.join('\n')) + '</blockquote>';
        continue;
      }
      // таблица
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = row(line);
        i += 2;
        let t = '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          t += '<tr>' + row(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
          i++;
        }
        html += t + '</tbody></table>';
        continue;
      }
      // список (с одним уровнем вложенности)
      const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (li) {
        flush();
        const ordered = /\d/.test(li[2]);
        let out = ordered ? '<ol>' : '<ul>';
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
          if (!m) {
            // продолжение пункта на следующей строке
            if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && out.endsWith('</li>')) {
              out = out.slice(0, -5) + ' ' + inline(lines[i].trim()) + '</li>';
              i++;
              continue;
            }
            break;
          }
          if (m[1].length >= 2) {
            const sub = [];
            while (i < lines.length && /^\s{2,}([-*]|\d+\.)\s+/.test(lines[i])) sub.push(lines[i++].trim());
            out = out.slice(0, -5) + render(sub.join('\n')) + '</li>';
            continue;
          }
          out += '<li>' + inline(m[3]) + '</li>';
          i++;
        }
        html += out + (ordered ? '</ol>' : '</ul>');
        continue;
      }
      para.push(line.trim());
      i++;
    }
    flush();
    return html;
  }

  root.Markdown = { render, inline };
})(window);
