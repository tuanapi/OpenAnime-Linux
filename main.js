const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const DiscordRPC = require("discord-rpc");

const URL = "https://openani.me";
const PROTOCOL = "openanime";

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

// handle the config file
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
    "right": "85px",
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

// Auto GPU switching for Linux (NVIDIA/AMD)
// Use the dGPU for better performance
if (process.platform === 'linux' && config.highPerformance !== false) {
  const { execSync } = require('child_process');
  const fs = require('fs');

  try {
    // Try NVIDIA offloading
    if (!process.env.__NV_PRIME_RENDER_OFFLOAD && fs.existsSync('/usr/share/vulkan/icd.d/nvidia_icd.json')) {
      process.env.VK_ICD_FILENAMES = '/usr/share/vulkan/icd.d/nvidia_icd.json';
      process.env.__NV_PRIME_RENDER_OFFLOAD = '1';
      process.env.__VK_LAYER_NV_optimus = 'NVIDIA_only';
      process.env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia';
    }
    // Fallback to AMD or Intel discrete chips
    else if (!process.env.DRI_PRIME) {
      const lspci = execSync('lspci').toString();
      // Look for a discrete VGA controller that isn't integrated
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
    // Silently fail if lspci is missing or other issues
  }
}

let mainWindow = null;

// Map openanime:// links to the website URLs
function protocolUrlToWebUrl(protocolUrl) {
  if (!protocolUrl || !protocolUrl.startsWith(PROTOCOL + "://")) return null;
  const pathPart = protocolUrl.slice((PROTOCOL + "://").length);
  return URL + "/" + pathPart;
}

// Handle deep links - either navigate now or save for when the window opens
let pendingUrl = null;

function handleDeepLink(url) {
  const webUrl = protocolUrlToWebUrl(url);
  if (!webUrl) return;

  if (mainWindow) {
    mainWindow.loadURL(webUrl);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingUrl = webUrl;
  }
}

// Enforce single instance — when a second instance is launched with a URL,
// forward it to the existing instance.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    // On Linux the URL usually comes in as the last argument
    const url = argv.find(arg => arg.startsWith(PROTOCOL + "://"));
    if (url) handleDeepLink(url);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Catch URLs on macOS or some Linux desktops
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}

function createMainWindow() {
  // Pull config from earlier
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
    if (!url.startsWith(URL)) e.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL)) return { action: "deny" };
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

  // Decide where to start: either a pending deep link or the home page
  let startUrl = pendingUrl || URL;
  pendingUrl = null;

  if (startUrl === URL) {
    const argUrl = process.argv.find(arg => arg.startsWith(PROTOCOL + "://"));
    if (argUrl) {
      const webUrl = protocolUrlToWebUrl(argUrl);
      if (webUrl) startUrl = webUrl;
    }
  }

  mainWindow.loadURL(startUrl);

  // Hotkeys
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // F11 -> Toggle Fullscreen
    if (input.key === "F11") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }

    // ESC -> Go Back or Exit Fullscreen
    if (input.key === "Escape") {
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
        event.preventDefault();
      } else if (mainWindow.webContents.navigationHistory.canGoBack()) {
        mainWindow.webContents.navigationHistory.goBack();
        event.preventDefault();
      }
    }
  });

  // Handle HTML5 Fullscreen (e.g. video player fullscreen button)
  let isHtmlFullscreen = false;
  mainWindow.webContents.on('enter-html-full-screen', () => {
    isHtmlFullscreen = true;
  });
  mainWindow.webContents.on('leave-html-full-screen', () => {
    isHtmlFullscreen = false;
  });

  // Persist fullscreen across navigation (prevents shrinking between episodes)
  mainWindow.webContents.on('did-start-navigation', (e, url, isInPlace, isMainFrame) => {
    if (persistFullscreen && isMainFrame && (isHtmlFullscreen || mainWindow.isFullScreen())) {
      // Force native fullscreen so it doesn't pop out
      setTimeout(() => {
        if (mainWindow && !mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(true);
        }
      }, 100);
    }
  });

  // Discord status
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    updateDiscordRPC(title, mainWindow.webContents.getURL());
  });
}

app.whenReady().then(() => {
  createMainWindow();
  initDiscordRPC();
});

// IPC for Window Controls
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

// --- Discord RPC Setup ---
const discordClientId = '1482661655975428156';
let rpc;
const startTimestamp = new Date();

// Fix Discord RPC for Flatpak/Snap
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
      // Bridge sockets with socat
      const { spawn } = require('child_process');
      const bridge = spawn('socat', [
        `UNIX-LISTEN:${standardSocket},fork`,
        `UNIX-CONNECT:${targetSocket}`
      ], { detached: true, stdio: 'ignore' });
      bridge.unref();

      // Clean up proxy socket
      app.on('quit', () => {
        try { fs.unlinkSync(standardSocket); } catch (e) { }
        try { process.kill(-bridge.pid); } catch (e) { }
      });

      // Wait for socket to exist
      const start = Date.now();
      while (!fs.existsSync(standardSocket) && Date.now() - start < 1000) {
        // block briefly to ensure it exists before IPC starts looking
      }
    }
  } catch (err) {
    console.error("IPC Patch failed:", err);
  }
}

let currentActivityTitle = '';
let activityStartTimestamp = new Date();

function updateDiscordRPC(title, url) {
  if (!rpc) return;

  if (title && title !== currentActivityTitle) {
    activityStartTimestamp = new Date();
    currentActivityTitle = title;
  }

  let details = "OpenAnime'de";
  let state = "Geziniyor";

  if (title && title !== 'OpenAnime' && !title.includes('Just a moment')) {
    const segments = title.split(/ \| | - /);
    const cleanTitle = segments[0].trim();

    if (cleanTitle === 'Anasayfa' || cleanTitle === 'OpenAnime') {
      details = "Anasayfada dolaşıyor";
      state = undefined;
    } else {
      const epRegex = / (S\d+B\d+|(\d+\.)? (Sezon|Bölüm|Episode))/i;
      const match = cleanTitle.match(epRegex);

      if (match) {
        const animeName = cleanTitle.substring(0, match.index).trim();
        const epInfo = cleanTitle.substring(match.index).trim();

        details = `${animeName} izliyor`;

        const sxbxMatch = epInfo.match(/S(\d+)B(\d+)/i);
        if (sxbxMatch) {
          state = `Sezon ${parseInt(sxbxMatch[1])} Bölüm ${parseInt(sxbxMatch[2])}`;
        } else {
          state = epInfo;
        }
      } else {
        details = `${cleanTitle} izliyor`;
        state = 'Geziniyor';
      }
    }
  }

  const activity = {
    details: details,
    state: state,
    startTimestamp: activityStartTimestamp,
    largeImageKey: 'openanime',
    largeImageText: 'OpenAnime',
    instance: false,
  };

  if (url && url.startsWith('https://openani.me/')) {
    activity.buttons = [{ label: "OpenAnime'de İzle", url: url }];
  }

  try {
    // Update status if ready
    if (rpcReady) {
      rpc.setActivity(activity).catch(err => {
        console.error('Discord RPC setActivity failed:', err);
        rpcReady = false; // Mark as not ready if request fails
      });
      console.log(`Discord RPC Set: ${details}${state ? ' - ' + state : ''}`);
    }
  } catch (err) {
    console.error('Failed to set Discord activity (sync):', err);
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
    DiscordRPC.register(discordClientId);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      isConnecting = false;
      rpcReady = true;
      console.log('Discord RPC Connected!');
      updateDiscordRPC(mainWindow ? mainWindow.getTitle() : 'OpenAnime', mainWindow ? mainWindow.webContents.getURL() : URL);
    });

    rpc.on('disconnected', () => {
      console.log('Discord RPC Disconnected. Retrying in 15s...');
      rpc = null;
      isConnecting = false;
      rpcReady = false;
      setTimeout(initDiscordRPC, 15000);
    });
  }

  rpc.login({ clientId: discordClientId }).catch(err => {
    console.log('Discord RPC connection failed. Retrying in 15s...');
    isConnecting = false;
    rpcReady = false;
    setTimeout(initDiscordRPC, 15000);
  });
}
