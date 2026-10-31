#!/usr/bin/env node
// ФортранЛаб — сервер: раздаёт фронтенд и компилирует/запускает Fortran через gfortran.
// Без внешних зависимостей: только встроенные модули Node.js (>= 18).
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const FC = process.env.FC || 'gfortran';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL || Math.max(2, os.cpus().length));
const COMPILE_TIMEOUT_MS = 20000;
const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS || 5000);
const MAX_OUTPUT = 256 * 1024; // байт stdout/stderr на запуск
const MAX_BODY = 2 * 1024 * 1024; // байт тела запроса
const MAX_RUNS = 20; // запусков (тестов) на один запрос
const RETURN_FILE_LIMIT = 64 * 1024; // файлы, созданные программой, возвращаем если не больше
// Запрещаем вызов shell из программы (execute_command_line, system, bind(c)).
// Это не настоящая песочница — для публичного развёртывания запускайте в Docker (см. README).
const ALLOW_SHELL = process.env.ALLOW_SHELL === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// ---------- очередь задач: не больше MAX_PARALLEL компиляций одновременно ----------
let active = 0;
const queue = [];
function withSlot(fn) {
  return new Promise((resolve, reject) => {
    const task = async () => {
      active++;
      try { resolve(await fn()); } catch (e) { reject(e); } finally {
        active--;
        if (queue.length) queue.shift()();
      }
    };
    if (active < MAX_PARALLEL) task(); else queue.push(task);
  });
}

// ---------- запуск процесса с ограничениями ----------
function runProcess(cmd, args, { cwd, input, timeoutMs, limits }) {
  return new Promise((resolve) => {
    let fullCmd = cmd, fullArgs = args;
    if (limits) {
      // prlimit: процессорное время, память, размер файлов
      fullArgs = [
        `--cpu=${Math.ceil(timeoutMs / 1000) + 1}`,
        '--as=1073741824', // 1 ГБ адресного пространства
        '--fsize=16777216', // 16 МБ на файл
        '--core=0',
        cmd, ...args,
      ];
      fullCmd = 'prlimit';
    }
    const started = Date.now();
    const child = spawn(fullCmd, fullArgs, {
      cwd,
      env: { PATH: process.env.PATH, HOME: cwd, LANG: 'C.UTF-8', GFORTRAN_UNBUFFERED_PRECONNECTED: 'y' },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0);
    let truncated = false, timedOut = false;
    const collect = (which) => (chunk) => {
      const cur = which === 'out' ? stdout : stderr;
      if (cur.length >= MAX_OUTPUT) { truncated = true; return; }
      const next = Buffer.concat([cur, chunk]).subarray(0, MAX_OUTPUT);
      if (next.length === MAX_OUTPUT) truncated = true;
      if (which === 'out') stdout = next; else stderr = next;
    };
    child.stdout.on('data', collect('out'));
    child.stderr.on('data', collect('err'));
    const kill = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { try { child.kill('SIGKILL'); } catch (_) {} } };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: String(err.message), exitCode: -1, signal: null, timedOut, truncated, timeMs: Date.now() - started });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        exitCode: code, signal, timedOut, truncated,
        timeMs: Date.now() - started,
      });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
  });
}

// ---------- валидация входных данных ----------
const SAFE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.\-]{0,63}$/;
function checkName(name) {
  return typeof name === 'string' && SAFE_NAME.test(name) && !name.includes('..');
}

const SHELL_PATTERNS = [
  /\bexecute_command_line\b/i,
  /\bcall\s+system\b/i,
  /\bsystem\s*\(/i,
  /\bbind\s*\(\s*c\b/i,
];

async function snapshotDir(dir) {
  const map = new Map();
  for (const name of await fsp.readdir(dir)) {
    const st = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (st && st.isFile()) map.set(name, st.mtimeMs + ':' + st.size);
  }
  return map;
}

async function handleRun(body) {
  const sources = Array.isArray(body.sources) ? body.sources : [];
  const dataFiles = Array.isArray(body.files) ? body.files : [];
  let runs = Array.isArray(body.runs) ? body.runs : [{ stdin: body.stdin || '' }];
  if (!sources.length) return { error: 'Нет исходного кода' };
  if (runs.length === 0) runs = [{ stdin: '' }];
  if (runs.length > MAX_RUNS) return { error: `Слишком много запусков (максимум ${MAX_RUNS})` };
  for (const s of sources) {
    if (!checkName(s.name) || !/\.(f90|f95|f03|f08|f|for)$/i.test(s.name) || typeof s.content !== 'string') {
      return { error: 'Некорректное имя исходного файла: ' + s.name };
    }
    if (!ALLOW_SHELL) {
      const noComments = s.content.split('\n').map((l) => l.replace(/!.*$/, '')).join('\n');
      if (SHELL_PATTERNS.some((re) => re.test(noComments))) {
        return { error: 'Вызовы оболочки (execute_command_line, system, bind(c)) отключены на этом сервере.' };
      }
    }
  }
  for (const f of dataFiles) {
    if (!checkName(f.name) || typeof f.content !== 'string') return { error: 'Некорректное имя файла данных: ' + f.name };
  }

  return withSlot(async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'flab-'));
    try {
      for (const s of sources) await fsp.writeFile(path.join(dir, s.name), s.content);
      // Компиляция. Модули должны идти раньше программы — порядок задаёт клиент.
      const flags = ['-g', '-fcheck=all', '-fbacktrace', '-Wall', '-Wno-unused-dummy-argument', '-Wno-conversion', '-ffree-line-length-none'];
      const compile = await runProcess(FC, [...flags, '-o', 'prog', ...sources.map((s) => s.name)], {
        cwd: dir, timeoutMs: COMPILE_TIMEOUT_MS, limits: false,
      });
      const compileOk = compile.exitCode === 0 && !compile.timedOut;
      const result = {
        compile: { ok: compileOk, output: compile.stderr + compile.stdout, timedOut: compile.timedOut, timeMs: compile.timeMs },
        runs: [],
      };
      if (!compileOk) return result;

      for (let i = 0; i < runs.length; i++) {
        const r = runs[i];
        // Каждый запуск — в своей чистой папке со своими файлами данных
        const runDir = path.join(dir, 'run' + i);
        await fsp.mkdir(runDir);
        const extra = Array.isArray(r.files) ? r.files.filter((f) => checkName(f.name) && typeof f.content === 'string') : [];
        for (const f of [...dataFiles, ...extra]) await fsp.writeFile(path.join(runDir, f.name), f.content);
        const before = await snapshotDir(runDir);
        const res = await runProcess(path.join(dir, 'prog'), [], {
          cwd: runDir, input: typeof r.stdin === 'string' ? r.stdin : '', timeoutMs: RUN_TIMEOUT_MS, limits: true,
        });
        // Файлы, которые программа создала или изменила
        const after = await snapshotDir(runDir);
        const outFiles = [];
        for (const [name, sig] of after) {
          if (before.get(name) === sig) continue; // не изменился
          const full = path.join(runDir, name);
          const st = await fsp.stat(full);
          if (st.size <= RETURN_FILE_LIMIT) outFiles.push({ name, content: await fsp.readFile(full, 'utf8') });
          else outFiles.push({ name, content: null, size: st.size });
        }
        result.runs.push({
          stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode, signal: res.signal,
          timedOut: res.timedOut, truncated: res.truncated, timeMs: res.timeMs, files: outFiles,
        });
      }
      return result;
    } finally {
      fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}

// ---------- HTTP ----------
function sendJson(res, status, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Слишком большой запрос')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const full = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!full.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const st = await fsp.stat(full);
    if (!st.isFile()) throw new Error('not file');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(full).pipe(res);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Не найдено');
  }
}

let compilerVersion = 'unknown';
runProcess(FC, ['--version'], { cwd: os.tmpdir(), timeoutMs: 5000 }).then((r) => {
  compilerVersion = (r.stdout.split('\n')[0] || r.stderr || 'gfortran не найден').trim();
  console.log('Компилятор:', compilerVersion);
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') {
      return sendJson(res, 200, { ok: true, compiler: compilerVersion, queue: queue.length, active, runTimeoutMs: RUN_TIMEOUT_MS });
    }
    if (req.url === '/api/run' && req.method === 'POST') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: 'Неверный JSON: ' + e.message }); }
      const result = await handleRun(body);
      return sendJson(res, result.error ? 400 : 200, result);
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: 'Внутренняя ошибка сервера: ' + e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`ФортранЛаб: http://localhost:${PORT}`);
  });
}

module.exports = { handleRun };
