const { app, BrowserWindow, ipcMain, Menu, shell, powerMonitor, session } = require("electron");
const path = require("path");
const { Client: DiscordRPCClient } = require("@xhayper/discord-rpc");

const MAIN_URL = "https://openani.me";

function isAllowedDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === 'openani.me' || parsed.hostname.endsWith('.openani.me'));
  } catch (e) {
    return false;
  }
}

// Detect NVIDIA hardware (driver installed)
const hasNvidiaHardware = (() => {
  try {
    const fs = require('fs');
    return fs.existsSync('/proc/driver/nvidia/version') ||
           fs.existsSync('/sys/module/nvidia/version');
  } catch (e) {
    return false;
  }
})();

// Detect Vulkan ICD (for modern NVIDIA)
const hasNvidiaVulkan = (() => {
  try {
    return require('fs').existsSync('/usr/share/vulkan/icd.d/nvidia_icd.json');
  } catch (e) {
    return false;
  }
})();

// config
const configPath = path.join(app.getPath('userData'), 'config.json');

function createDefaultConfig(useSmartBounds = false) {
  const defaultConfig = {
    highPerformance: true,
    discordRPC: true,
    useCustomFrame: false,
    persistFullscreen: false,
    isMaximized: false,
    forceWebGPU: true,
    forceX11: hasNvidiaHardware,
    forcePrimeOffload: false,
    debugOutlines: false,
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

  if (useSmartBounds) {
    try {
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      if (primaryDisplay && primaryDisplay.workArea) {
        const { width: workWidth, height: workHeight, x: workX, y: workY } = primaryDisplay.workArea;
        defaultConfig.bounds.x = Math.round(workX + (workWidth - 1360) / 2);
        defaultConfig.bounds.y = Math.round(workY + (workHeight - 900) / 2);
      }
    } catch (err) {
      console.error('Failed to calculate smart bounds:', err);
    }
  }

  return defaultConfig;
}

function loadConfig() {
  const defaults = createDefaultConfig(false);
  try {
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
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

      // Calculate smart bounds if x or y is missing and screen is ready
      if (merged.bounds.x === undefined || merged.bounds.y === undefined) {
        try {
          const { screen } = require('electron');
          const primaryDisplay = screen.getPrimaryDisplay();
          if (primaryDisplay && primaryDisplay.workArea) {
            const { width: workWidth, height: workHeight, x: workX, y: workY } = primaryDisplay.workArea;
            // clamp window size to screen (respect minWidth/minHeight)
            const minW = 800, minH = 600;
            merged.bounds.width = Math.max(minW, Math.min(merged.bounds.width || 1360, workWidth));
            merged.bounds.height = Math.max(minH, Math.min(merged.bounds.height || 900, workHeight));
            if (merged.bounds.x === undefined) {
              merged.bounds.x = Math.max(workX, Math.round(workX + (workWidth - merged.bounds.width) / 2));
            }
            if (merged.bounds.y === undefined) {
              merged.bounds.y = Math.max(workY, Math.round(workY + (workHeight - merged.bounds.height) / 2));
            }
          }
        } catch (e) {
          // screen API not ready yet
        }
      }
      return merged;
    }
  } catch (e) {
    console.error('Error reading config:', e);
  }
  return defaults;
}

const config = loadConfig();

// --- GPU / rendering command line switches ---
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

// Sets Wayland/X11 platform and Vulkan/ANGLE feature flags based on config.forceX11
const featureList = [
  "Vulkan",
  "VaapiVideoDecoder",
  "VaapiVideoEncoder",
  "CanvasOopRasterization",
  "UseMultiPlaneFormatForHardwareVideo",
  "AcceleratedVideoDecodeLinuxGL"
];

const forceX11 = config.forceX11 === true || (hasNvidiaHardware && !hasNvidiaVulkan);

if (forceX11) {
  app.commandLine.appendSwitch("ozone-platform", "x11");
  // If legacy NVIDIA, also force OpenGL
  if (hasNvidiaHardware && !hasNvidiaVulkan) {
    app.commandLine.appendSwitch("use-angle", "gl");
    // Remove Vulkan features
    const vulkanFeatures = ['VulkanFromANGLE', 'DefaultANGLEVulkan'];
    featureList = featureList.filter(f => !vulkanFeatures.includes(f));
  }
} else {
  // Non‑NVIDIA or NVIDIA with Vulkan (if user forced Wayland) – but config defaults to X11 for NVIDIA
  featureList.push("VulkanFromANGLE", "DefaultANGLEVulkan");
  app.commandLine.appendSwitch("use-angle", "vulkan");
}

// Enables VA-API on NVIDIA — needed regardless of the ozone-platform choice above
if (hasNvidiaHardware) {
  featureList.push("VaapiOnNvidiaGPUs", "VaapiIgnoreDriverChecks");
}

app.commandLine.appendSwitch("enable-features", featureList.join(","));
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("gpu-preference", "high-performance");
app.commandLine.appendSwitch("enable-gpu-rasterization");
if (config.forcePrimeOffload !== true) {
  app.commandLine.appendSwitch("enable-zero-copy");
  app.commandLine.appendSwitch("enable-hardware-overlays");
}
app.commandLine.appendSwitch("ignore-resolution-limits-for-acceleration");
app.commandLine.appendSwitch("vaapi-ignore-driver-checks");

// Sets GPU render-offload environment variables for hybrid graphics
function getConnectedDisplayPciAddresses() {
  try {
    const fs = require('fs');
    const drmDir = '/sys/class/drm';
    const connectedCards = new Set();
    for (const entry of fs.readdirSync(drmDir)) {
      if (!/^card\d+-/.test(entry)) continue;
      let status;
      try {
        status = fs.readFileSync(`${drmDir}/${entry}/status`, 'utf8').trim();
      } catch (e) {
        continue;
      }
      if (status === 'connected') connectedCards.add(entry.split('-')[0]);
    }
    const addresses = new Set();
    for (const card of connectedCards) {
      try {
        const devicePath = fs.realpathSync(`${drmDir}/${card}/device`);
        addresses.add(devicePath.split('/').pop());
      } catch (e) {}
    }
    return addresses.size > 0 ? addresses : null;
  } catch (e) {
    return null;
  }
}

// Whether the PCI device at this address matches a given PCI vendor ID hex
function pciAddressHasVendor(pciAddr, vendorHex) {
  try {
    const fs = require('fs');
    const uevent = fs.readFileSync(`/sys/bus/pci/devices/${pciAddr}/uevent`, 'utf8');
    return new RegExp(`PCI_ID=${vendorHex}:`, 'i').test(uevent);
  } catch (e) {
    return false;
  }
}

function nvidiaAlreadyDrivesDisplay() {
  const connected = getConnectedDisplayPciAddresses();
  if (!connected) return null;
  for (const addr of connected) {
    if (pciAddressHasVendor(addr, '10DE')) return true; // 10DE = NVIDIA's PCI vendor ID
  }
  return false;
}

let gpuPrimeReady = Promise.resolve();
if (process.platform === 'linux' && config.highPerformance !== false) {
  const fs = require('fs');
  let gpuCount = 0;
  try {
    gpuCount = fs.readdirSync('/dev/dri').filter(file => file.startsWith('renderD')).length;
  } catch (e) {}

  if (gpuCount > 1 && hasNvidiaHardware && !process.env.__NV_PRIME_RENDER_OFFLOAD && nvidiaAlreadyDrivesDisplay() === false) {
  process.env.VK_ICD_FILENAMES = '/usr/share/vulkan/icd.d/nvidia_icd.json';
    process.env.__NV_PRIME_RENDER_OFFLOAD = '1';
    process.env.__VK_LAYER_NV_optimus = 'NVIDIA_only';
    process.env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia';
  } else if (gpuCount > 1 && !hasNvidiaHardware && !process.env.DRI_PRIME && config.forcePrimeOffload === true) {
    gpuPrimeReady = new Promise((resolve) => {
      require('child_process').execFile('lspci', { timeout: 3000 }, (err, stdout) => {
        if (!err && stdout) {
          let hasDiscreteGPU = false;
          let hasDiscreteAMD = false;
          let discreteGpuPciAddr = null;
          stdout.split('\n').forEach(line => {
            const l = line.toLowerCase();
            if (!l.includes('vga') && !l.includes('display')) return;
            const isAMD = /\b(amd|ati|radeon)\b/.test(l);
            const isIntel = /\b(intel|arc)\b/.test(l);
            const isIntegrated = /\b(integrated|raphael|renoir|cezanne|rembrandt|phoenix|iris|uhd|hd graphics)\b/.test(l);
            if ((isAMD || isIntel) && !isIntegrated) {
              hasDiscreteGPU = true;
              if (isAMD) hasDiscreteAMD = true;
              const pciMatch = line.match(/^([0-9a-fA-F]{4}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9a-fA-F])/);
              if (pciMatch) discreteGpuPciAddr = pciMatch[1];
            }
          });
          const connected = getConnectedDisplayPciAddresses();
          const discreteAlreadyDrivesDisplay = !!(connected && discreteGpuPciAddr && connected.has(discreteGpuPciAddr));
          if (hasDiscreteGPU && !discreteAlreadyDrivesDisplay) {
            process.env.DRI_PRIME = '1';
            if (hasDiscreteAMD) {
              process.env.RADV_DEBUG = [process.env.RADV_DEBUG, 'nodcc'].filter(Boolean).join(',');
              process.env.AMD_DEBUG = [process.env.AMD_DEBUG, 'nodcc'].filter(Boolean).join(',');
            }
          }
        }
        resolve();
      });
    });
  }
}

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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// shared protections for main + child windows
function applyWindowProtections(win, lastOpenedTime) {
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAllowedDomain(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedDomain(url)) {
      shell.openExternal(url);
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
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
        partition: "persist:openanime",
        // tells preload.js this is a child window
        additionalArguments: ["--child-window"]
      }
    });

    childWin.setMenu(null);

    // hide scrollbars
    childWin.webContents.on('dom-ready', () => {
      childWin.webContents.insertCSS('::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }');
    });

    // recursive — child windows get the same protections
    applyWindowProtections(childWin, lastOpenedTime);

    childWin.loadURL(url);
    return { action: "deny" };
  });
}

function saveBounds() {
  try {
    if (!mainWindow) return;
    const fs = require('fs');
    config.bounds = mainWindow.getNormalBounds();
    config.isMaximized = mainWindow.isMaximized();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('Error saving bounds:', e);
  }
}

async function clearStaleServiceWorkerCache() {
  try {
    const ses = session.fromPartition('persist:openanime');
    // Unregisters the service worker; leaves the Cache Storage API untouched
    await ses.clearStorageData({ storages: ['serviceworkers'] });
  } catch (e) {
    console.error('Failed to clear stale service worker registration:', e);
  }
}

async function createMainWindow() {
  // read config
  let useCustomFrame = config.useCustomFrame || false;
  let winBounds = config.bounds || { width: 1280, height: 800 };
  let isMaximized = config.isMaximized || false;
  let persistFullscreen = config.persistFullscreen || false;
  const tb = config.titlebar || {};

  // Uses Electron's native Window Controls Overlay when useCustomFrame is on
  const frameOptions = useCustomFrame
    ? { titleBarStyle: 'hidden', titleBarOverlay: { color: tb.color, symbolColor: tb.symbolColor, height: tb.height } }
    : { frame: true };

  mainWindow = new BrowserWindow({
    width: winBounds.width || 1280,
    height: winBounds.height || 800,
    x: winBounds.x,
    y: winBounds.y,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "icon512.png"),
    ...frameOptions,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      partition: "persist:openanime"
    }
  });

  mainWindow.webContents.on('dom-ready', () => {
    let css = '::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }';
    if (useCustomFrame) {
      const offsetRight = tb.headerOffsetRight ?? 8;
      const offsetTop = tb.headerOffsetTop ?? 0;
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

  // Unregisters a stale service worker before first load
  await clearStaleServiceWorkerCache();

  mainWindow.loadURL(MAIN_URL);

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
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // html5 fullscreen
  let isHtmlFullscreen = false;
  mainWindow.webContents.on('enter-html-full-screen', () => {
    isHtmlFullscreen = true;
  });
  mainWindow.webContents.on('leave-html-full-screen', () => {
    isHtmlFullscreen = false;
  });

  // keep fullscreen when switching episodes
  mainWindow.webContents.on('did-start-navigation', (e, url, isInPlace, isMainFrame) => {
    if (persistFullscreen && isMainFrame && (isHtmlFullscreen || mainWindow.isFullScreen())) {
      // force native fullscreen
      setTimeout(() => {
        if (mainWindow && !mainWindow.isFullScreen()) {
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
    const currentConfig = fs.existsSync(configPath) ? config : createDefaultConfig(true);
    if (!fs.existsSync(path.dirname(configPath))) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    Object.assign(config, currentConfig);
  } catch (e) {
    console.error('Error writing/syncing config on startup:', e);
  }

  Menu.setApplicationMenu(null);
  await gpuPrimeReady; // make sure DRI_PRIME (if any) is set before the GPU process spawns
  createMainWindow();
  initDiscordRPC();

  // reconnect rpc after sleep
  powerMonitor.on('resume', () => {
    if (!rpcReady) initDiscordRPC();
  });
});

ipcMain.on('get-config', (event, key) => {
  event.returnValue = config[key];
});

ipcMain.on('premid-update', (event, data) => {
  updateDiscordRPCFromPremid(data);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (rpc) {
    try { rpc.destroy(); } catch (e) {}
  }
});

// --- Discord RPC Setup ---
const discordClientId = '1482661655975428156';
let rpc;

// Path to the standard Discord IPC socket
function getDiscordSocketPath() {
  const runtimeDir = process.env.XDG_RUNTIME_DIR || '/run/user/' + process.getuid();
  return path.join(runtimeDir, 'discord-ipc-0');
}

// Whether we created the symlink below (so we know whether to clean it up)
let discordSymlinkCreated = false;

// Removes the symlink on quit, if we created one
app.on('quit', () => {
  if (!discordSymlinkCreated) return;
  try { require('fs').unlinkSync(getDiscordSocketPath()); } catch (e) {}
});

// Symlinks the standard Discord IPC path to a Flatpak/Vesktop/Snap Discord socket, if found
function ensureDiscordSocketAccess() {
  if (process.platform !== 'linux') return;
  try {
    const fs = require('fs');
    const runtimeDir = process.env.XDG_RUNTIME_DIR || '/run/user/' + process.getuid();
    const standardSocket = getDiscordSocketPath();

    if (fs.existsSync(standardSocket)) return;
    try { fs.unlinkSync(standardSocket); } catch (e) {}

    const candidates = [
      path.join(runtimeDir, 'app/com.discordapp.Discord/discord-ipc-0'),
      path.join(runtimeDir, 'app/dev.vencord.Vesktop/discord-ipc-0'),
      path.join(runtimeDir, 'snap.discord/discord-ipc-0')
    ];
    const target = candidates.find(p => fs.existsSync(p));
    if (target) {
      fs.symlinkSync(target, standardSocket);
      discordSymlinkCreated = true;
    }
  } catch (err) {
    console.error("Discord socket symlink failed:", err);
  }
}

let lastPremidJson = '';

let lastKnownVideoTime = 0;
let lastKnownVideoTimeUpdated = 0;
let stableStartTimestamp = 0;
let lastPausedState = false;
let lastCalculatedStart = 0;

function updateDiscordRPCFromPremid(data) {
  if (!rpc || !rpcReady) return;

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

  const activity = {
    details: data.details || "OpenAnime'de",
    state: data.state || "Geziniyor",
    largeImageKey: data.largeImageKey || 'openanime',
    largeImageText: data.largeImageText || 'OpenAnime',
    instance: false,
    type: 3 // Watching
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
function initDiscordRPC() {
  const discordEnabled = config.discordRPC !== false;
  if (!discordEnabled || isConnecting || rpcReady) return;

  isConnecting = true;
  ensureDiscordSocketAccess();

  if (!rpc) {
    rpc = new DiscordRPCClient({ clientId: discordClientId });

    rpc.on('ready', () => {
      isConnecting = false;
      rpcReady = true;
      console.log('Discord RPC Connected!');
    });

    rpc.on('disconnected', () => {
      console.log('Discord RPC Disconnected. Retrying in 15s...');
      // destroys the client before clearing the reference
      try { rpc.destroy(); } catch (e) {}
      rpc = null;
      isConnecting = false;
      rpcReady = false;
      setTimeout(initDiscordRPC, 15000);
    });
  }

  rpc.login()
    .then(() => { /* 'ready' event handles success */ })
    .catch(err => {
      console.log('Discord RPC connection failed. Retrying in 15s...');
      isConnecting = false;
      setTimeout(initDiscordRPC, 15000);
    });

  // Safeguard: if login() never resolves or rejects, isConnecting would stay
  // true forever and block all future retries (including after sleep/wake).
  setTimeout(() => {
    if (isConnecting && !rpcReady) {
      console.log('Discord RPC login timed out. Retrying in 15s...');
      isConnecting = false;
      setTimeout(initDiscordRPC, 15000);
    }
  }, 10000);
}
