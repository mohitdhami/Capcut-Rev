const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { Readable } = require('node:stream');

const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const MIME = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.webm': 'video/webm', '.avi': 'video/x-msvideo', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.svg': 'image/svg+xml',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
  },
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#101014',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  if (process.env.CAPCUT_DEBUG) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[renderer-gone]', JSON.stringify(details));
    });
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  if (process.env.CAPCUT_SMOKE) {
    mainWindow.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await mainWindow.webContents.executeJavaScript(`((async () => {
            const out = {};
            out.hasApi = typeof window.api === 'object' && typeof window.api.probeFile === 'function';
            out.hasApp = !!document.querySelector('.app');
            out.topbarButtons = document.querySelectorAll('.topbar button').length;
            out.mediaTabs = document.querySelectorAll('.panel-tab').length;
            out.trackHeaders = document.querySelectorAll('.track-header').length;
            out.previewCanvas = !!document.querySelector('.preview-stage canvas');
            out.timelineScroll = !!document.querySelector('.timeline-scroll');
            out.rulerCanvas = !!document.querySelector('.ruler canvas');
            const st = await window.api.probeFile('samples/clip1.mp4').catch((e) => ({ error: String(e) }));
            out.probe = st && !st.error ? { w: st.width, h: st.height, dur: Math.round(st.duration * 10) / 10, hasAudio: st.hasAudio } : st;
            return out;
          })())`, true);
          console.log('SMOKE_RESULT', JSON.stringify(result));
          app.exit(0);
        } catch (err) {
          console.error('SMOKE_FAIL', err);
          app.exit(1);
        }
      }, 2500);
    });
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:action', 'new-project') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:action', 'open-project') },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:action', 'save-project') },
        { type: 'separator' },
        { label: 'Import Media…', accelerator: 'CmdOrCtrl+I', click: () => mainWindow?.webContents.send('menu:action', 'import-media') },
        { type: 'separator' },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:action', 'export') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  registerMediaProtocol();
  registerIpc();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ------------------------------- media:// ------------------------------- */

function decodeMediaUrl(url) {
  const raw = url.slice('media://local/'.length);
  const cleaned = raw.split('?')[0].split('#')[0];
  return Buffer.from(cleaned, 'base64url').toString('utf8');
}

function registerMediaProtocol() {
  protocol.handle('media', async (request) => {
    try {
      const filePath = decodeMediaUrl(request.url);
      const stat = await fsp.stat(filePath);
      const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const range = request.headers.get('range');
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (!Number.isFinite(start) || start < 0) start = 0;
        if (!Number.isFinite(end) || end >= stat.size) end = stat.size - 1;
        if (start > end) start = 0;
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      const stream = fs.createReadStream(filePath);
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response('Not found: ' + String(err), { status: 404 });
    }
  });
}

const toMediaUrl = (filePath) => 'media://local/' + Buffer.from(filePath, 'utf8').toString('base64url');

/* -------------------------------- probing -------------------------------- */

const IMAGE_CODECS = new Set(['mjpeg', 'png', 'bmp', 'webp', 'tiff', 'gif', 'apng']);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr }));
      else resolve(stdout);
    });
  });
}

async function probeFile(filePath) {
  const out = await run(ffprobePath, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format', '-show_streams',
    filePath,
  ]);
  const info = JSON.parse(out);
  const streams = info.streams || [];
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  const format = info.format || {};
  const isImageCodec = v && IMAGE_CODECS.has(v.codec_name) && v.codec_name !== 'gif';
  const isGif = v && v.codec_name === 'gif';
  const kind = !v ? 'audio' : isImageCodec || isGif ? 'image' : 'video';

  let rotation = 0;
  if (v) {
    if (v.tags && v.tags.rotate) rotation = parseInt(v.tags.rotate, 10) || 0;
    const sd = (v.side_data_list || []).find((d) => typeof d.rotation === 'number');
    if (sd) rotation = ((sd.rotation % 360) + 360) % 360;
  }

  let fps = 0;
  if (v && v.r_frame_rate && v.r_frame_rate !== '0/0') {
    const [n, d] = v.r_frame_rate.split('/').map(Number);
    if (d) fps = n / d;
  }

  let duration = parseFloat(format.duration || '0');
  if (!duration && v && v.duration) duration = parseFloat(v.duration);
  if (kind === 'image' && !isGif) duration = 0;

  let width = v ? v.width || 0 : 0;
  let height = v ? v.height || 0 : 0;
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];

  let sampleRate = a ? parseInt(a.sample_rate || '48000', 10) : 0;

  return {
    path: filePath,
    name: path.basename(filePath),
    url: toMediaUrl(filePath),
    kind,
    duration,
    width,
    height,
    fps: fps || 30,
    rotation,
    hasAudio: !!a,
    videoCodec: v ? v.codec_name : null,
    audioCodec: a ? a.codec_name : null,
    sampleRate,
    size: parseInt(format.size || '0', 10),
  };
}

/* --------------------------------- fonts --------------------------------- */

const FONT_CANDIDATES = {
  Arial: ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf'],
  'Helvetica Neue': ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/HelveticaNeue.ttc'],
  Helvetica: ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/HelveticaNeue.ttc'],
  'Times New Roman': ['/System/Library/Fonts/Supplemental/Times New Roman.ttf'],
  Georgia: ['/System/Library/Fonts/Supplemental/Georgia.ttf'],
  'Courier New': ['/System/Library/Fonts/Supplemental/Courier New.ttf'],
  Verdana: ['/System/Library/Fonts/Supplemental/Verdana.ttf'],
  Impact: ['/System/Library/Fonts/Supplemental/Impact.ttf'],
  'Comic Sans MS': ['/System/Library/Fonts/Supplemental/Comic Sans MS.ttf'],
  'Trebuchet MS': ['/System/Library/Fonts/Supplemental/Trebuchet MS.ttf'],
  Futura: ['/System/Library/Fonts/Supplemental/Futura.ttc'],
  Palatino: ['/System/Library/Fonts/Palatino.ttc'],
  'Snell Roundhand': ['/System/Library/Fonts/SnellRoundhand.ttc'],
  Baskerville: ['/System/Library/Fonts/Baskerville.ttc'],
  'Apple Color Emoji': ['/System/Library/Fonts/Apple Color Emoji.ttc'],
};

let fontCache = null;
function resolvedFonts() {
  if (fontCache) return fontCache;
  fontCache = {};
  for (const [family, candidates] of Object.entries(FONT_CANDIDATES)) {
    const found = candidates.find((p) => fs.existsSync(p));
    if (found) fontCache[family] = found;
  }
  return fontCache;
}

/* --------------------------------- export -------------------------------- */

const exportJobs = new Map();

function startExport(job) {
  const { id, args, duration } = job;
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    exportJobs.set(id, proc);
    let log = '';
    let totalDuration = duration || 0;
    const pushProgress = (patch) => {
      try {
        mainWindow?.webContents.send('export:progress', { id, ...patch });
      } catch {}
    };
    proc.stdout.on('data', (buf) => {
      for (const line of buf.toString().split('\n')) {
        const [key, value] = line.split('=');
        if (!key || value === undefined) continue;
        if (key === 'out_time_ms' || key === 'out_time_us') {
          const sec = parseInt(value, 10) / 1e6;
          if (totalDuration > 0) pushProgress({ progress: Math.min(1, sec / totalDuration), time: sec });
        } else if (key === 'speed') {
          pushProgress({ speed: value });
        } else if (key === 'progress' && value.trim() === 'end') {
          pushProgress({ progress: 1, done: true });
        }
      }
    });
    proc.stderr.on('data', (buf) => {
      log += buf.toString();
      if (log.length > 60000) log = log.slice(-40000);
      pushProgress({ log: log.slice(-2500) });
    });
    proc.on('close', (code) => {
      exportJobs.delete(id);
      if (code === 0) resolve({ ok: true });
      else if (proc.killed) resolve({ ok: false, canceled: true });
      else resolve({ ok: false, error: `FFmpeg exited with code ${code}`, log: log.slice(-6000) });
    });
    proc.on('error', (err) => {
      exportJobs.delete(id);
      resolve({ ok: false, error: String(err) });
    });
  });
}

/* ---------------------------------- IPC ---------------------------------- */

const MEDIA_FILTERS = [
  { name: 'All Media', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'gif', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'] },
  { name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi'] },
  { name: 'Audio', extensions: ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'] },
  { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
];

function registerIpc() {
  ipcMain.handle('media:select', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Media',
      properties: ['openFile', 'multiSelections'],
      filters: MEDIA_FILTERS,
    });
    if (res.canceled) return [];
    const items = [];
    for (const p of res.filePaths) {
      try {
        items.push(await probeFile(p));
      } catch (err) {
        items.push({ path: p, name: path.basename(p), url: toMediaUrl(p), kind: 'video', error: String(err), duration: 0, width: 0, height: 0, fps: 30, rotation: 0, hasAudio: false });
      }
    }
    return items;
  });

  ipcMain.handle('media:probe', async (_e, filePath) => {
    try {
      return await probeFile(filePath);
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('media:url', (_e, filePath) => toMediaUrl(filePath));

  ipcMain.handle('project:save', async (_e, json) => {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project',
      defaultPath: 'project.cprj',
      filters: [{ name: 'CapCut Rev Project', extensions: ['cprj'] }],
    });
    if (res.canceled || !res.filePath) return null;
    await fsp.writeFile(res.filePath, json, 'utf8');
    return res.filePath;
  });

  ipcMain.handle('project:save-as-path', async (_e, { filePath, json }) => {
    await fsp.writeFile(filePath, json, 'utf8');
    return filePath;
  });

  ipcMain.handle('project:open', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Project',
      properties: ['openFile'],
      filters: [{ name: 'CapCut Rev Project', extensions: ['cprj'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    const json = await fsp.readFile(filePath, 'utf8');
    return { filePath, json };
  });

  ipcMain.handle('export:choose', async (_e, defaultName) => {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Video',
      defaultPath: defaultName || 'export.mp4',
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'QuickTime Movie', extensions: ['mov'] },
      ],
    });
    if (res.canceled || !res.filePath) return null;
    return res.filePath;
  });

  ipcMain.handle('export:start', async (_e, job) => startExport(job));

  ipcMain.on('export:cancel', (_e, id) => {
    const proc = exportJobs.get(id);
    if (proc) proc.kill('SIGKILL');
  });

  ipcMain.handle('temp:write', async (_e, { name, dataBase64 }) => {
    const dir = path.join(os.tmpdir(), 'capcut-rev');
    await fsp.mkdir(dir, { recursive: true });
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
    await fsp.writeFile(filePath, Buffer.from(dataBase64, 'base64'));
    return filePath;
  });

  ipcMain.handle('shell:reveal', (_e, filePath) => shell.showItemInFolder(filePath));

  ipcMain.handle('app:fonts', () => resolvedFonts());

  ipcMain.handle('app:paths', () => ({ ffmpeg: ffmpegPath, ffprobe: ffprobePath, tmp: os.tmpdir() }));

  ipcMain.handle('app:open-external', (_e, url) => shell.openExternal(url));
}
