// Построение графиков по числовым столбцам из вывода программы (SVG).
(function (root) {
  'use strict';
  const COLORS = ['#1a73e8', '#e8710a', '#188038', '#d93025', '#9334e6', '#12b5cb'];

  // Строки, состоящие только из чисел (≥ 2 столбцов)
  function parseTable(text) {
    const rows = [];
    for (const line of String(text).split('\n')) {
      const toks = line.trim().split(/[\s,;]+/).filter(Boolean);
      if (toks.length < 2) continue;
      if (!toks.every((t) => /^[+-]?(\d+\.?\d*|\.\d+)([eEdD][+-]?\d+)?$/.test(t))) continue;
      rows.push(toks.map((t) => parseFloat(t.replace(/[dD]/, 'e'))));
    }
    if (!rows.length) return null;
    // берём самую частую ширину строки
    const counts = {};
    rows.forEach((r) => { counts[r.length] = (counts[r.length] || 0) + 1; });
    const width = Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]);
    const data = rows.filter((r) => r.length === width);
    return data.length >= 2 ? { width, rows: data } : null;
  }

  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = Math.pow(10, Math.floor(Math.log10(span / n)));
    const err = (span / n) / step0;
    const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toPrecision(12));
    return { ticks, min: Math.min(min, ticks[0]), max: Math.max(max, ticks[ticks.length - 1]) };
  }

  function fmt(v) {
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(1);
    return String(+v.toPrecision(6));
  }

  function svgPlot(table, opt) {
    const W = 640, H = 360, L = 64, R = 16, T = 16, B = 44;
    const xs = table.rows.map((r) => r[opt.x]);
    const ys = [];
    opt.ys.forEach((c) => table.rows.forEach((r) => ys.push(r[c])));
    const fx = niceTicks(Math.min(...xs), Math.max(...xs), 6);
    const fy = niceTicks(Math.min(...ys), Math.max(...ys), 6);
    const px = (v) => L + (v - fx.min) / (fx.max - fx.min) * (W - L - R);
    const py = (v) => opt.invertY
      ? T + (v - fy.min) / (fy.max - fy.min) * (H - T - B)
      : H - B - (v - fy.min) / (fy.max - fy.min) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="plot-svg" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="none" stroke="#c4c7c5"/>`;
    fx.ticks.forEach((t) => {
      const x = px(t);
      s += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" stroke="#eee"/>`;
      s += `<text x="${x}" y="${H - B + 16}" text-anchor="middle" class="plot-tick">${fmt(t)}</text>`;
    });
    fy.ticks.forEach((t) => {
      const y = py(t);
      s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#eee"/>`;
      s += `<text x="${L - 6}" y="${y + 4}" text-anchor="end" class="plot-tick">${fmt(t)}</text>`;
    });
    s += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" class="plot-label">${opt.xLabel}</text>`;
    opt.ys.forEach((c, k) => {
      const color = COLORS[k % COLORS.length];
      const pts = table.rows.map((r) => `${px(r[opt.x]).toFixed(1)},${py(r[c]).toFixed(1)}`);
      if (opt.lines) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
      if (table.rows.length <= 200) pts.forEach((p) => { const [x, y] = p.split(','); s += `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`; });
      s += `<rect x="${L + 10}" y="${T + 8 + k * 18}" width="12" height="12" fill="${color}"/>`;
      s += `<text x="${L + 28}" y="${T + 18 + k * 18}" class="plot-legend">${opt.yLabels[k]}</text>`;
    });
    return s + '</svg>';
  }

  // Создаёт панель графика с настройками столбцов
  function createPlotPanel(text) {
    const table = parseTable(text);
    const panel = document.createElement('div');
    panel.className = 'plot-panel';
    if (!table) {
      panel.innerHTML = '<div class="muted">Не нашёл числовых столбцов. Выведите данные строками вида <code>x  y</code> (например, <code>print *, z, t</code> в цикле).</div>';
      return panel;
    }
    const cols = Array.from({ length: table.width }, (_, i) => i);
    const state = { x: 0, ys: cols.slice(1, 4), invertY: false, lines: true, profile: false };
    const ctrl = document.createElement('div');
    ctrl.className = 'plot-ctrl';
    const chart = document.createElement('div');
    const draw = () => {
      let opt;
      if (state.profile) {
        if (!state.ys.length) { chart.innerHTML = '<div class="muted">Выберите столбец для оси Y</div>'; return; }
        // вертикальный профиль: столбец X = глубина откладываем вниз по оси Y
        const t = { width: table.width, rows: table.rows.map((r) => r.slice()) };
        opt = { x: state.ys[0], ys: [state.x], invertY: true, lines: state.lines, xLabel: `столбец ${state.ys[0] + 1}`, yLabels: [`столбец ${state.ys[0] + 1} по глубине (по вертикали — столбец ${state.x + 1})`] };
        chart.innerHTML = svgPlot(t, opt);
        return;
      }
      opt = { x: state.x, ys: state.ys, invertY: state.invertY, lines: state.lines, xLabel: `столбец ${state.x + 1}`, yLabels: state.ys.map((c) => `столбец ${c + 1}`) };
      chart.innerHTML = state.ys.length ? svgPlot(table, opt) : '<div class="muted">Выберите столбцы для оси Y</div>';
    };
    const sel = document.createElement('select');
    cols.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = `X: столбец ${c + 1}`; sel.append(o); });
    sel.onchange = () => { state.x = +sel.value; draw(); };
    ctrl.append(sel);
    const ysBox = document.createElement('span');
    ysBox.className = 'plot-ys';
    ysBox.append('Y: ');
    cols.forEach((c) => {
      const lab = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.ys.includes(c);
      cb.onchange = () => { state.ys = cols.filter((k) => ysBox.querySelectorAll('input')[k].checked); draw(); };
      lab.append(cb, ` ${c + 1}`);
      ysBox.append(lab);
    });
    ctrl.append(ysBox);
    const mk = (label, key, title) => {
      const lab = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state[key];
      cb.onchange = () => { state[key] = cb.checked; draw(); };
      lab.title = title || '';
      lab.append(cb, ' ' + label);
      ctrl.append(lab);
    };
    mk('линии', 'lines');
    mk('ось Y вниз', 'invertY');
    mk('вертикальный профиль', 'profile', 'X-столбец считается глубиной и откладывается по вертикали вниз, первый Y-столбец — по горизонтали');
    panel.append(ctrl, chart);
    draw();
    return panel;
  }

  root.Plot = { createPlotPanel, parseTable };
})(window);
