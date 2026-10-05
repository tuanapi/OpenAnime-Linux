const { app, BrowserWindow, ipcMain, Menu, shell, powerMonitor, session } = require("electron");
const hasNvidiaHardware = global.__hasNvidiaHardware;
const iGpuDrivesDisplay = global.__iGpuDrivesDisplay;
const ozoneArgv = (() => {
  if (process.argv.includes('--ozone-platform=x11')) return 'x11';
  const oi = process.argv.indexOf('--ozone-platform');
  if (oi !== -1 && typeof process.argv[oi + 1] === 'string') return process.argv[oi + 1];
  return null;
})();
// argv, not env, tells which ozone is running after relaunch.
const isX11 = global.__isX11 === true || ozoneArgv === 'x11';
const hasNvidiaVulkan = global.__hasNvidiaVulkan !== false;
const isHybrid = global.__isHybrid === true;
const path = require("path");
const { Client: DiscordRPCClient } = require("@xhayper/discord-rpc");
  const updateCheck = require("./scripts/update-check");
  const packageUpdate = require("./scripts/package-update");

const MAIN_URL = "https://openani.me";
const MAIN_HOST = new URL(MAIN_URL).hostname;

function isAllowedDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === 'openani.me' || parsed.hostname.endsWith('.openani.me'));
  } catch (e) {
    return false;
  }
}

// config
const configPath = path.join(app.getPath('userData'), 'config.json');

function createDefaultConfig() {
  return {
    highPerformance: true,
    discordRPC: true,
    rpcVisibility: 'all',
    pauseDropMinutes: 5,
    useCustomFrame: false,
    persistFullscreen: false,
    isMaximized: false,
    forceWebGPU: true,
    forcePrimeOffload: false,
    gpuDisplayOverride: null,
    debugOutlines: false,
    dismissedUpdate: null,
    bounds: {
      width: 1360,
      height: 900
    },
    titlebar: {
      color: '#00000000',
      symbolColor: '#ffffffcc',
      height: 46,
      headerOffsetRight: 6,
      headerOffsetTop: 1
    }
  };
}

const CONFIG_VALUE_TYPES = {
  discordRPC: 'boolean',
  rpcVisibility: 'string',
  pauseDropMinutes: 'number',
  useCustomFrame: 'boolean',
  persistFullscreen: 'boolean',
  isMaximized: 'boolean',
  forceWebGPU: 'boolean',
  dismissedUpdate: 'string'
};

function configValueValid(key, value) {
  if (key === 'dismissedUpdate') return value === null || updateCheck.coreVersion(value) !== null;
  if (CONFIG_VALUE_TYPES[key] && typeof value !== CONFIG_VALUE_TYPES[key]) return false;
  if (key === 'pauseDropMinutes' && !(value >= 1 && value <= 60)) return false;
  if (key === 'rpcVisibility' && value !== 'all' && value !== 'watch_only') return false;
  return true;
}

function loadConfig() {
  const defaults = createDefaultConfig();
  try {
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults;
      const merged = {
        ...defaults,
        ...parsed,
        bounds: {
          ...defaults.bounds,
          ...(parsed.bounds || {})
        },
        titlebar: {
          ...defaults.titlebar,
          ...(parsed.titlebar || {})
        }
      };
      for (const key of Object.keys(CONFIG_VALUE_TYPES)) {
        if (!configValueValid(key, merged[key])) merged[key] = defaults[key];
      }
      return merged;
    }
  } catch (e) {
    console.error('Error reading config:', e);
  }
  return defaults;
}

const config = loadConfig();

const CONFIG_READ_KEYS = [
  'discordRPC',
  'rpcVisibility',
  'pauseDropMinutes',
  'useCustomFrame',
  'persistFullscreen',
  'isMaximized',
  'forceWebGPU'
];

const CONFIG_WRITE_KEYS = [
  'rpcVisibility',
  'pauseDropMinutes',
  'useCustomFrame',
  'persistFullscreen',
  'isMaximized'
];

let injectedSource = '';
try {
  injectedSource = require('fs').readFileSync(path.join(__dirname, 'injected.js'), 'utf8');
} catch (e) {
  console.error('Error reading injected.js:', e);
}

let configSaveTimer = null;

function writeConfig() {
  try {
    const fs = require('fs');
    const tmp = configPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
    fs.renameSync(tmp, configPath);
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

function saveConfig() {
  if (configSaveTimer) return;
  configSaveTimer = setTimeout(() => {
    configSaveTimer = null;
    writeConfig();
  }, 150);
}

function flushConfig() {
  if (configSaveTimer) {
    clearTimeout(configSaveTimer);
    configSaveTimer = null;
  }
  writeConfig();
}

function sanitizeBounds(b) {
  const { screen } = require('electron');
  const minW = 800;
  const minH = 600;
  const num = (v, f) => (Number.isFinite(+v) ? Math.round(+v) : f);
  let width = Math.max(minW, num(b.width, 1360));
  let height = Math.max(minH, num(b.height, 900));
  const hasPos = Number.isFinite(+b.x) && Number.isFinite(+b.y);

  if (hasPos) {
    const x = Math.round(+b.x);
    const y = Math.round(+b.y);
    const reachable = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return x < a.x + a.width - 40 && x + width > a.x + 40 &&
             y < a.y + a.height - 40 && y + height > a.y + 40;
    });
    if (reachable) return { x, y, width, height };
  }

  const wa = screen.getPrimaryDisplay().workArea;
  width = Math.max(minW, Math.min(width, wa.width));
  height = Math.max(minH, Math.min(height, wa.height));
  return {
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
    width,
    height
  };
}

// GPU / rendering command line switches
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

// Single-adapter selection onto the dGPU.
app.commandLine.appendSwitch("force-high-performance-gpu");

let featureList = [
  "CanvasOopRasterization",
  "UseMultiPlaneFormatForHardwareVideo"
];

// No HW decode on Wayland iGPU+NVIDIA (gallium SEGV); X11 keeps it.
const hwDecodeOK = !(hasNvidiaHardware && iGpuDrivesDisplay && !isX11);
if (hwDecodeOK) {
  featureList.push(
    "VaapiVideoDecoder",
    "VaapiVideoEncoder",
    "AcceleratedVideoDecodeLinuxGL",
    "PlatformHEVCDecoderSupport"
  );

  if (hasNvidiaHardware) {
    featureList.push("VaapiOnNvidiaGPUs", "VaapiIgnoreDriverChecks");
  }
} else {
  console.log('[GPU] iGPU display + NVIDIA: hardware video decode OFF (software fallback); WebGPU stays on dGPU');
}

// X11: Vulkan feature on; ANGLE GL only without NVIDIA ICD.
if (isX11 && hasNvidiaHardware) {
  if (!featureList.includes("Vulkan")) featureList.unshift("Vulkan");
  if (!hasNvidiaVulkan) {
    app.commandLine.appendSwitch("use-angle", "gl");
    const vulkanAngleBits = ['VulkanFromANGLE', 'DefaultANGLEVulkan'];
    featureList = featureList.filter(f => !vulkanAngleBits.includes(f));
  }
}

app.commandLine.appendSwitch("enable-features", featureList.join(","));

app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("enable-gpu-rasterization");

app.commandLine.appendSwitch("enable-zero-copy");

if (isX11) app.commandLine.appendSwitch("enable-hardware-overlays");

app.commandLine.appendSwitch("ignore-resolution-limits-for-acceleration");
app.commandLine.appendSwitch("vaapi-ignore-driver-checks");

console.log(`[GPU] display=${iGpuDrivesDisplay ? "integrated" : "discrete"} ` +
  `hybrid=${isHybrid} zeroCopy=on angle=${isX11 && hasNvidiaHardware && !hasNvidiaVulkan ? "gl" : "default"} wayland=${isX11 ? "no" : "yes"}`);

if (hasNvidiaHardware) {
  const fs = require('fs');
  const warnIfOld = (version) => {
    const majorMinor = parseFloat(version);
    if (!Number.isNaN(majorMinor) && majorMinor < 572.16) {
      console.warn(`[GPU] NVIDIA driver ${version} — 10-bit HEVC needs >= 572.16 for hardware decode. Check chrome://media-internals during playback.`);
    }
  };
  try {
    if (fs.existsSync('/sys/module/nvidia/version')) {
      warnIfOld(fs.readFileSync('/sys/module/nvidia/version', 'utf8').trim());
    } else {
      require('child_process').exec('nvidia-smi --query-gpu=driver_version --format=csv,noheader', (err, stdout) => {
        if (!err && stdout) warnIfOld(stdout.trim());
      });
    }
  } catch (e) {}
}

let mainWindow = null;

// single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function openExternalSafe(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
  } catch (e) {
    return false;
  }
  shell.openExternal(url);
  return true;
}

// shared protections for main + child windows
function applyWindowProtections(win, lastOpenedTime) {
  const guardNav = (e, url) => {
    if (isAllowedDomain(url)) return;
    e.preventDefault();
    openExternalSafe(url);
  };
  win.webContents.on("will-navigate", guardNav);
  win.webContents.on("will-redirect", guardNav);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedDomain(url)) {
      openExternalSafe(url);
      return { action: "deny" };
    }

    // prevent duplicate window opens within 350ms
    const now = Date.now();
    if (now - lastOpenedTime < 350) {
      return { action: "deny" };
    }
    lastOpenedTime = now;

    const childWin = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      icon: path.join(__dirname, "icon512.png"),
      frame: true,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        sandbox: true,
        partition: "persist:openanime",
        additionalArguments: ["--child-window"]
      }
    });

    childWin.webContents.on('dom-ready', () => {
      childWin.webContents.insertCSS('::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }');
    });

    applyWindowProtections(childWin, lastOpenedTime);

    childWin.loadURL(url);
    return { action: "deny" };
  });
}

function saveBounds() {
  try {
    if (!mainWindow) return;
    config.bounds = mainWindow.getNormalBounds();
    config.isMaximized = mainWindow.isMaximized();
    saveConfig();
  } catch (e) {
    console.error('Error saving bounds:', e);
  }
}

async function createMainWindow() {
  // read config
  let useCustomFrame = config.useCustomFrame || false;
  let winBounds = sanitizeBounds(config.bounds || {});
  let isMaximized = config.isMaximized || false;
  const tbSrc = config.titlebar;
  const tb = (tbSrc && typeof tbSrc === 'object' && !Array.isArray(tbSrc)) ? tbSrc : {};
  const nnum = (v, f) => (Number.isFinite(+v) ? +v : f);
  const nstr = (v, f) => (typeof v === 'string' && v ? v : f);

  // Uses Electron's native Window Controls Overlay when useCustomFrame is on
  const frameOptions = useCustomFrame
    ? { titleBarStyle: 'hidden', titleBarOverlay: { color: nstr(tb.color, '#00000000'), symbolColor: nstr(tb.symbolColor, '#ffffffcc'), height: nnum(tb.height, 46) } }
    : { frame: true };

  mainWindow = new BrowserWindow({
    width: winBounds.width,
    height: winBounds.height,
    x: winBounds.x,
    y: winBounds.y,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "icon512.png"),
    ...frameOptions,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      partition: "persist:openanime"
    }
  });

  mainWindow.webContents.on('dom-ready', () => {
    let css = '::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }';
    if (useCustomFrame) {
      const offsetRight = nnum(tb.headerOffsetRight, 8);
      const offsetTop = nnum(tb.headerOffsetTop, 0);
      css += `
        .topbar > div.header-right {
          margin-right: ${offsetRight}rem !important;
          margin-top: ${offsetTop}px !important;
        }
      `;
    }
    if (config.debugOutlines === true) {
      css += `
        a, button, [role="button"], [onclick], input[type="submit"], input[type="button"],
        label[for], select, [tabindex]:not([tabindex="-1"]), .clickable, [data-href] {
          outline: 1px solid red !important;
          outline-offset: -1px !important;
        }
      `;
    }
    mainWindow.webContents.insertCSS(css);
  });

  applyWindowProtections(mainWindow, 0);

  if (isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.on('close', saveBounds);
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.loadURL(MAIN_URL);

  // SW in control => reload past the cache; only ever after an observed outage.
  let failCount = 0;
  let crashCount = 0;
  let reloadedOnce = false;
  let sawNetDown = false;
  let reloadTries = 0;
  let netMisses = 0;
  let probing = false;
  let reloadInterval = null;
  const https = require('https');
  const netOk = () => new Promise(res => {
    const req = https.request({ host: MAIN_HOST, port: 443, path: '/', method: 'HEAD', timeout: 3000 }, r => {
      req.destroy();
      res(r.statusCode < 500);
    });
    req.once('timeout', () => { req.destroy(); res(false); });
    req.once('error', () => { req.destroy(); res(false); });
    req.end();
  });
  const stopRetries = () => {
    if (reloadInterval) { clearInterval(reloadInterval); reloadInterval = null; }
  };
  const probe = async () => {
    if (probing) return;
    probing = true;
    try {
      if (!mainWindow || mainWindow.isDestroyed()) { stopRetries(); return; }
      if (!await netOk()) {
        sawNetDown = true;
        if (++netMisses >= 10) stopRetries();
        return;
      }
      netMisses = 0;
      if (!sawNetDown) { stopRetries(); return; }
      sawNetDown = false;
      if (reloadTries >= 3 || !mainWindow || mainWindow.isDestroyed()) { stopRetries(); return; }
      reloadTries++;
      mainWindow.webContents.reload();
    } finally {
      probing = false;
    }
  };
  const armRetries = () => {
    if (reloadInterval || reloadTries >= 3) return;
    reloadInterval = setInterval(probe, 3000);
  };
  mainWindow.webContents.on('destroyed', stopRetries);
  mainWindow.webContents.on('did-finish-load', () => {
    failCount = 0;
    crashCount = 0;
    (async () => {
      if (reloadedOnce || !mainWindow || mainWindow.isDestroyed()) return;
      reloadedOnce = true;
      const hasSW = await mainWindow.webContents.executeJavaScript(
        '!!(navigator.serviceWorker && navigator.serviceWorker.controller)'
      ).catch(() => false);
      if (!hasSW) return;
      if (!await netOk()) { armRetries(); return; }
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.reload();
    })().catch(() => {});
  });
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || !mainWindow || mainWindow.isDestroyed()) return;
    if (failCount < 3) { failCount++; mainWindow.webContents.reload(); }
    else mainWindow.loadFile(path.join(__dirname, 'scripts', 'load-error.html'));
  });

  const wc = mainWindow.webContents;
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (isMainFrame) console.log('[nav] ' + url);
  });
  wc.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit' || !mainWindow || mainWindow.isDestroyed()) return;
    crashCount++;
    if (crashCount > 3) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(path.join(__dirname, 'scripts', 'load-error.html'));
      }
      return;
    }
    console.error('[render] process gone (' + details.reason + '), reloading');
    wc.reload();
  });

  // global keyboard shortcuts (F5, F11, Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      if (!app.isPackaged) mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // html5 fullscreen
  let isHtmlFullscreen = false;
  let persistFsTimer = null;
  mainWindow.webContents.on('enter-html-full-screen', () => {
    isHtmlFullscreen = true;
  });
  mainWindow.webContents.on('leave-html-full-screen', () => {
    isHtmlFullscreen = false;
  });

  // keep fullscreen when switching episodes
  mainWindow.webContents.on('did-start-navigation', (_e, _url, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    const wasFullscreen = isHtmlFullscreen || mainWindow.isFullScreen();
    isHtmlFullscreen = false;
    if (config.persistFullscreen && wasFullscreen && !persistFsTimer) {
      persistFsTimer = setTimeout(() => {
        persistFsTimer = null;
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(true);
        }
      }, 100);
    }
  });

  // Discord status arrives via 'premid-update' IPC from preload.js
}

app.whenReady().then(async () => {
  const fs = require('fs');
  try {
    // rewrites config.json, backfilling any new keys
    // drop keys for cut features so they can't come back from an old file
    for (const dead of ['localLibraryPaths']) delete config[dead];
    if (!fs.existsSync(path.dirname(configPath))) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    writeConfig();
  } catch (e) {
    console.error('Error writing/syncing config on startup:', e);
  }

  Menu.setApplicationMenu(null);
  const allowedPermissions = new Set(['fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'notifications', 'idle-detection', 'pointerLock']);
  const oaSession = session.fromPartition('persist:openanime');
  oaSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowedPermissions.has(permission)));
  oaSession.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission));
  createMainWindow();
  initDiscordRPC();
  updateCheck.start({
    getWindow: () => mainWindow,
    openExternal: openExternalSafe,
    getDismissed: () => config.dismissedUpdate,
    setDismissed: (tag) => { config.dismissedUpdate = tag; saveConfig(); },
    onUpdate: () => packageUpdate.run().then((r) => r.handled)
  });

  // reconnect rpc after sleep
  powerMonitor.on('resume', () => {
    if (!rpcReady) initDiscordRPC();
  });
});

ipcMain.on('get-config', (event, key) => {
  event.returnValue = CONFIG_READ_KEYS.includes(key) ? config[key] : undefined;
});

ipcMain.on('get-config-all', (event) => {
  const out = {};
  for (const key of CONFIG_READ_KEYS) out[key] = config[key];
  event.returnValue = out;
});

ipcMain.on('get-injected-source', (event) => {
  event.returnValue = injectedSource;
});

ipcMain.on('premid-update', (event, data) => {
  updateDiscordRPCFromPremid(data);
});

ipcMain.on('rpc-set-enabled', (event, enabled) => {
  config.discordRPC = enabled === true;
  saveConfig();
  invalidatePremidCache();
  if (!enabled) {
    if (rpc && rpc.user) rpc.user.clearActivity().catch(() => {});
    try { if (rpc) rpc.destroy(); } catch (e) {}
    rpc = null;
    rpcReady = false;
    isConnecting = false;
    presenceDropped = false;
    if (pauseDropTimer) { clearTimeout(pauseDropTimer); pauseDropTimer = null; }
    if (rpcRetryTimer) { clearTimeout(rpcRetryTimer); rpcRetryTimer = null; }
    console.log('Discord RPC disabled via settings');
  } else {
    initDiscordRPC();
    console.log('Discord RPC enabled via settings');
  }
});

// Generic settings writes from the RPC card: save + apply live effects.
ipcMain.on('config-set', (event, key, value) => {
  if (typeof key !== 'string' || !CONFIG_WRITE_KEYS.includes(key)) return;
  if (!configValueValid(key, value)) return;
  const prev = config[key];
  config[key] = value;
  saveConfig();
  if (key === 'useCustomFrame' && prev !== value && mainWindow && !mainWindow.isDestroyed()) {
    // Frame can't change on a live window; relaunch cleanly.
    setTimeout(() => { app.relaunch(); app.exit(0); }, 400);
  }
  if (key === 'isMaximized' && value === true && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.maximize();
  }
  console.log('config-set:', key, '=', typeof value === 'object' ? JSON.stringify(value) : value);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (rpc) {
    try { rpc.destroy(); } catch (e) {}
  }
});

app.on('before-quit', () => { saveBounds(); flushConfig(); });

// Discord RPC Setup
const discordClientId = '1482661655975428156';

const PLAY_BADGE_URL = "https://raw.githubusercontent.com/tuanapi/OpenAnime-Linux/main/assets/discord/play.png";
const PAUSE_BADGE_URL = "https://raw.githubusercontent.com/tuanapi/OpenAnime-Linux/main/assets/discord/pause.png";

// Minutes of paused video before presence clears, from config.pauseDropMinutes.
// OA_PAUSE_DROP_MS overrides with an exact millisecond value (testing).
function getPauseDropMs() {
  const envMs = Number(process.env.OA_PAUSE_DROP_MS);
  if (envMs > 0) return envMs;
  const minutes = Number(config && config.pauseDropMinutes) || 5;
  return minutes * 60 * 1000;
}
let rpc;

let lastPremidJson = '';

let lastKnownVideoTime = 0;
let lastKnownVideoTimeUpdated = 0;
let stableStartTimestamp = 0;
let lastPausedState = false;
let lastCalculatedStart = 0;
let pauseDropTimer = null;
let presenceDropped = false;

function invalidatePremidCache() {
  lastPremidJson = '';
  lastCalculatedStart = 0;
}

function updateDiscordRPCFromPremid(data) {
  if (!rpc || !rpcReady) return;
  if (!data || typeof data !== 'object') return;

  let currentStart = 0;
  if (data.video && typeof data.video.currentTime === 'number') {
    const now = Date.now();
    const paused = data.video.paused;
    let isSeeked = false;

    if (paused !== lastPausedState) {
      isSeeked = true;
      lastPausedState = paused;
    }

    if (lastKnownVideoTime > 0 && !isSeeked) {
      const elapsedRealTime = (now - lastKnownVideoTimeUpdated) / 1000;
      const expectedVideoTime = lastKnownVideoTime + (paused ? 0 : elapsedRealTime);
      if (Math.abs(data.video.currentTime - expectedVideoTime) > 4) {
        isSeeked = true;
      }
    } else {
      isSeeked = true;
    }

    lastKnownVideoTime = data.video.currentTime;
    lastKnownVideoTimeUpdated = now;

    if (isSeeked || !stableStartTimestamp) {
      stableStartTimestamp = now - Math.floor(data.video.currentTime * 1000);
    }

    if (!paused) {
      currentStart = stableStartTimestamp;
    }
  } else {
    lastKnownVideoTime = 0;
    lastKnownVideoTimeUpdated = 0;
    stableStartTimestamp = 0;
  }

  // ignore video ticking to avoid rate limits
  const dataForCheck = {
    ...data,
    video: data.video ? { ...data.video, currentTime: undefined } : undefined
  };
  const currentJson = JSON.stringify(dataForCheck);

  if (currentJson === lastPremidJson && currentStart === lastCalculatedStart) {
    return;
  }

  lastPremidJson = currentJson;
  lastCalculatedStart = currentStart;

  const watchingVideo = !!(data.video && typeof data.video.currentTime === 'number');
  const pausedNow = !!(data.video && data.video.paused);

  // video paused: clear presence after a while; anything else brings it back
  if (watchingVideo && pausedNow) {
    if (presenceDropped) {
      // activity changed while paused: re-show it and start the countdown over
      presenceDropped = false;
    }
    if (!pauseDropTimer) {
      pauseDropTimer = setTimeout(async () => {
        pauseDropTimer = null;
        if (!rpc || !rpc.user) return;
        try {
          await rpc.user.clearActivity();
          presenceDropped = true;
          console.log('Discord RPC cleared: paused too long');
        } catch (err) {
          console.error('Discord RPC clearActivity failed (premid):', err);
        }
      }, getPauseDropMs());
    }
  } else {
    if (pauseDropTimer) {
      clearTimeout(pauseDropTimer);
      pauseDropTimer = null;
    }
    presenceDropped = false;
  }

  if (config.rpcVisibility === 'watch_only' && !(watchingVideo && !pausedNow)) {
    if (!presenceDropped && rpc && rpc.user) {
      presenceDropped = true;
      rpc.user.clearActivity().catch(err => {
        console.error('Discord RPC clearActivity failed (watch_only):', err);
      });
    }
    return;
  }

  const activity = {
    details: data.details || "OpenAnime'de",
    state: data.state || "Geziniyor",
    largeImageKey: data.largeImageKey || 'openanime',
    largeImageText: data.largeImageText || 'OpenAnime',
    smallImageKey: watchingVideo ? (pausedNow ? PAUSE_BADGE_URL : PLAY_BADGE_URL) : undefined,
    smallImageText: watchingVideo ? (pausedNow ? 'Duraklatıldı' : 'İzliyor') : undefined,
    instance: false,
    type: 3
  };

  if (currentStart > 0) {
    activity.startTimestamp = new Date(currentStart);
    if (data.video && typeof data.video.duration === 'number') {
      activity.endTimestamp = new Date(currentStart + Math.floor(data.video.duration * 1000));
    }
  } else if (data.startTimestamp) {
    activity.startTimestamp = new Date(data.startTimestamp);
    if (data.endTimestamp) {
      activity.endTimestamp = new Date(data.endTimestamp);
    }
  }

  const url = mainWindow ? mainWindow.webContents.getURL() : MAIN_URL;
  if (url && isAllowedDomain(url)) {
    activity.buttons = [{ label: "OpenAnime'de İzle", url: url }];
  }

  if (!rpc.user) {
    console.error('Discord RPC setActivity skipped: rpc.user is not populated yet');
    return;
  }

  try {
    rpc.user.setActivity(activity)
      .then(() => {
        console.log(`Discord RPC Set (PreMid): ${activity.details} - ${activity.state}`);
      })
      .catch(err => {
        console.error('Discord RPC setActivity failed (premid):', err);
      });
  } catch (err) {
    console.error('Failed to set Discord activity (premid sync):', err);
  }
}

let isConnecting = false;
let rpcReady = false;
let rpcRetryTimer = null;
let rpcLoginGuard = null;
function scheduleRpcRetry() {
  if (rpcRetryTimer) return;
  rpcRetryTimer = setTimeout(() => {
    rpcRetryTimer = null;
    initDiscordRPC();
  }, 15000);
}
function initDiscordRPC() {
  const discordEnabled = config.discordRPC !== false;
  if (!discordEnabled || isConnecting || rpcReady) return;

  isConnecting = true;

  if (!rpc) {
    rpc = new DiscordRPCClient({ clientId: discordClientId });

    rpc.on('ready', () => {
      isConnecting = false;
      rpcReady = true;
      invalidatePremidCache();
      if (rpcRetryTimer) { clearTimeout(rpcRetryTimer); rpcRetryTimer = null; }
      if (rpcLoginGuard) { clearTimeout(rpcLoginGuard); rpcLoginGuard = null; }
      console.log('Discord RPC Connected!');
    });

    rpc.on('disconnected', () => {
      console.log('Discord RPC Disconnected. Retrying in 15s...');
      try { rpc.destroy(); } catch (e) {}
      rpc = null;
      isConnecting = false;
      rpcReady = false;
      scheduleRpcRetry();
    });
  }

  rpc.login()
    .then(() => {})
    .catch(err => {
      console.log('Discord RPC connection failed. Retrying in 15s...');
      isConnecting = false;
      try { if (rpc) rpc.destroy(); } catch (e) {}
      rpc = null;
      scheduleRpcRetry();
    });

  if (rpcLoginGuard) { clearTimeout(rpcLoginGuard); rpcLoginGuard = null; }
  rpcLoginGuard = setTimeout(() => {
    rpcLoginGuard = null;
    if (isConnecting && !rpcReady) {
      console.log('Discord RPC login timed out. Retrying in 15s...');
      isConnecting = false;
      scheduleRpcRetry();
    }
  }, 10000);
}
