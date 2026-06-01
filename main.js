const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { Client: DiscordRPCClient } = require("@xhayper/discord-rpc");

const MAIN_URL = "https://openani.me";

app.commandLine.appendSwitch("enable-features", "Vulkan,VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization,UseMultiPlaneFormatForHardwareVideo,AcceleratedVideoDecodeLinuxGL");
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("gpu-preference", "high-performance");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-hardware-overlays");
app.commandLine.appendSwitch("ignore-resolution-limits-for-acceleration");
app.commandLine.appendSwitch("vaapi-ignore-driver-checks");

// config
const configPath = path.join(app.getPath('userData'), 'config.json');

function createDefaultConfig() {
  const defaultConfig = `{
  "highPerformance": true,
  "discordRPC": true,
  "useCustomFrame": false,
  "persistFullscreen": false,
  "isMaximized": false,
  "bounds": { "x": 253, "y": 83, "width": 1360, "height": 926 },
  "titlebar": {
    "right": "135px",
    "top": "12px",
    "gap": "15px",
    "btnSize": "16px"
  }
}`;

  try {
    const fs = require('fs');
    if (!fs.existsSync(path.dirname(configPath))) {
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, defaultConfig);
    return JSON.parse(defaultConfig.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''));
  } catch (e) {
    console.error('Failed to create default config:', e);
    return {};
  }
}

function loadConfig() {
  try {
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      let content = fs.readFileSync(configPath, 'utf8');
      // Strip comments before parsing
      content = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
      return JSON.parse(content);
    } else {
      return createDefaultConfig();
    }
  } catch (e) {
    console.error('Error reading config:', e);
  }
  return {};
}

const config = loadConfig();

// auto gpu switcher for linux (nvidia/amd)
if (process.platform === 'linux' && config.highPerformance !== false) {
  const { execSync } = require('child_process');
  const fs = require('fs');

  try {
    // try nvidia
    if (!process.env.__NV_PRIME_RENDER_OFFLOAD && fs.existsSync('/usr/share/vulkan/icd.d/nvidia_icd.json')) {
      process.env.VK_ICD_FILENAMES = '/usr/share/vulkan/icd.d/nvidia_icd.json';
      process.env.__NV_PRIME_RENDER_OFFLOAD = '1';
      process.env.__VK_LAYER_NV_optimus = 'NVIDIA_only';
      process.env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia';
    }
    // fallback to amd/intel
    else if (!process.env.DRI_PRIME) {
      const lspci = execSync('lspci').toString();
      // find discrete gpu
      const hasDiscreteGPU = lspci.split('\n').some(line => {
        const l = line.toLowerCase();
        if (!l.includes('vga') && !l.includes('display')) return false;

        const isAMD = l.includes('amd') || l.includes('ati') || l.includes('radeon');
        const isIntel = l.includes('intel') || l.includes('arc');
        const isIntegrated = l.match(/integrated|raphael|renoir|cezanne|rembrandt|phoenix|iris|uhd|hd graphics/);

        return (isAMD || isIntel) && !isIntegrated;
      });

      if (hasDiscreteGPU) {
        process.env.DRI_PRIME = '1';
      }
    }
  } catch (e) {
    // ignore errors
  }
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

function createMainWindow() {
  // read config
  let useCustomFrame = config.useCustomFrame || false;
  let winBounds = config.bounds || { width: 1280, height: 800 };
  let isMaximized = config.isMaximized || false;
  let persistFullscreen = config.persistFullscreen || false;

  mainWindow = new BrowserWindow({
    width: winBounds.width || 1280,
    height: winBounds.height || 800,
    x: winBounds.x,
    y: winBounds.y,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "icon512.png"),
    frame: !useCustomFrame,
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      partition: "persist:openanime"
    }
  });

  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(MAIN_URL)) e.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(MAIN_URL)) return { action: "deny" };
    return { action: "allow" };
  });

  if (isMaximized) {
    mainWindow.maximize();
  }

  const saveBounds = () => {
    try {
      if (!mainWindow) return;
      const fs = require('fs');
      const configPath = path.join(app.getPath('userData'), 'config.json');
      let config = {};
      if (fs.existsSync(configPath)) {
        let content = fs.readFileSync(configPath, 'utf8');
        content = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
        config = JSON.parse(content);
      }
      config.bounds = mainWindow.getNormalBounds();
      config.isMaximized = mainWindow.isMaximized();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
      console.error('Error saving bounds:', e);
    }
  };

  mainWindow.on('close', saveBounds);

mainWindow.loadURL(MAIN_URL);

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



  // poll premid for discord status
  setInterval(async () => {
    if (mainWindow && !mainWindow.isDestroyed() && rpcReady) {
      try {
        const premidData = await mainWindow.webContents.executeJavaScript(`
          (() => {
            const el = document.querySelector('premid-announcer');
            return el ? el.textContent : null;
          })()
        `);
        
        if (premidData) {
          let parsed;
          try {
            let clean = premidData.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = JSON.parse(clean);
            }
            parsed = typeof clean === 'string' ? JSON.parse(clean) : clean;
          } catch (e) {
            // Failed to parse
          }
          
          if (parsed && typeof parsed === 'object') {
            updateDiscordRPCFromPremid(parsed);
          }
        }
      } catch (err) {
        // Ignored
      }
    }
  }, 3000);
}

app.whenReady().then(() => {
  createMainWindow();
  initDiscordRPC();
});

// window controls
ipcMain.on('window-control', (event, action) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  if (!win) return;

  switch (action) {
    case 'minimize': win.minimize(); break;
    case 'maximize': win.setFullScreen(!win.isFullScreen()); break;
    case 'close': win.close(); break;
  }
});

ipcMain.on('get-config', (event, key) => {
  event.returnValue = config[key];
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (rpc) {
    try { rpc.destroy(); } catch(e) {}
  }
});

// --- Discord RPC Setup ---
const discordClientId = '1482661655975428156';
let rpc;

// flatpak/snap rpc fix
function applyDiscordIPCPatch() {
  if (process.platform !== 'linux') return;
  try {
    const fs = require('fs');
    const runtimeDir = process.env.XDG_RUNTIME_DIR || '/run/user/' + process.getuid();
    const standardSocket = path.join(runtimeDir, 'discord-ipc-0');

    if (fs.existsSync(standardSocket)) return; // Already exists

    const flatpakSocket = path.join(runtimeDir, 'app/com.discordapp.Discord/discord-ipc-0');
    const vesktopSocket = path.join(runtimeDir, 'app/dev.vencord.Vesktop/discord-ipc-0');
    const snapSocket = path.join(runtimeDir, 'snap.discord/discord-ipc-0');

    let targetSocket = null;
    if (fs.existsSync(flatpakSocket)) targetSocket = flatpakSocket;
    else if (fs.existsSync(vesktopSocket)) targetSocket = vesktopSocket;
    else if (fs.existsSync(snapSocket)) targetSocket = snapSocket;

    if (targetSocket) {
      // bridge via socat
      const { spawn } = require('child_process');
      const bridge = spawn('socat', [
        `UNIX-LISTEN:${standardSocket},fork`,
        `UNIX-CONNECT:${targetSocket}`
      ], { detached: true, stdio: 'ignore' });
      bridge.unref();

      // cleanup socket
      app.on('quit', () => {
        try { fs.unlinkSync(standardSocket); } catch (e) { }
        try { process.kill(-bridge.pid); } catch (e) { }
      });

      // wait for socket
      const start = Date.now();
      while (!fs.existsSync(standardSocket) && Date.now() - start < 1000) {
        // block slightly
      }
    }
  } catch (err) {
    console.error("IPC Patch failed:", err);
  }
}

let lastPremidJson = '';
let lastPremidTime = 0;



let lastCalculatedStart = 0;

function updateDiscordRPCFromPremid(data) {
  if (!rpc || !rpcReady) return;

  let currentStart = 0;
  if (data.video && typeof data.video.currentTime === 'number' && !data.video.paused) {
    currentStart = Date.now() - Math.floor(data.video.currentTime * 1000);
  }

  // ignore video ticking to avoid rate limits
  const dataForCheck = {
    ...data,
    video: data.video ? { ...data.video, currentTime: undefined } : undefined
  };
  const currentJson = JSON.stringify(dataForCheck);
  
  if (currentJson === lastPremidJson) {
    if (currentStart > 0 && Math.abs(currentStart - lastCalculatedStart) > 4000) {
    } else {
      return;
    }
  }

  lastPremidJson = currentJson;
  lastCalculatedStart = currentStart;
  lastPremidTime = Date.now();

  const activity = {
    details: data.details || "OpenAnime'de",
    state: data.state || "Geziniyor",
    largeImageKey: data.largeImageKey || 'openanime',
    largeImageText: data.largeImageText || 'OpenAnime',
    smallImageKey: 'https://github.com/tuanapi/OpenAnime-Linux/blob/main/candy.png?raw=true',
    smallImageText: data.smallImageText || 'OpenAnime',
    instance: false,
    type: 3 // Watching
  };

  if (data.smallImageKey !== 'play' && data.smallImageKey !== 'pause') {
    delete activity.smallImageKey;
    delete activity.smallImageText;
  }

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
  if (url && url.startsWith('https://openani.me/')) {
    activity.buttons = [{ label: "OpenAnime'de İzle", url: url }];
  }

  try {
    rpc.user?.setActivity(activity).catch(err => {
      console.error('Discord RPC setActivity failed (premid):', err);
      rpcReady = false;
    });
    console.log(`Discord RPC Set (PreMid): ${activity.details} - ${activity.state}`);
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
  applyDiscordIPCPatch();

  if (!rpc) {
    rpc = new DiscordRPCClient({ clientId: discordClientId });

    rpc.on('ready', () => {
      isConnecting = false;
      rpcReady = true;
      console.log('Discord RPC Connected!');
    });

    rpc.on('disconnected', () => {
      console.log('Discord RPC Disconnected. Retrying in 15s...');
      rpc = null;
      isConnecting = false;
      rpcReady = false;
      setTimeout(initDiscordRPC, 15000);
    });
  }

  rpc.login().catch(err => {
    console.log('Discord RPC connection failed. Retrying in 15s...');
    isConnecting = false;
    rpcReady = false;
    setTimeout(initDiscordRPC, 15000);
  });
}