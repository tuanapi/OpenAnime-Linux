const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const URL = "https://openani.me";
const PROTOCOL = "openanime";

app.commandLine.appendSwitch("enable-features", "Vulkan,VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization,UseMultiPlaneFormatForHardwareVideo,AcceleratedVideoDecodeLinuxGL");
app.commandLine.appendSwitch("enable-unsafe-webgpu");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("ozone-platform-hint", "auto");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("gpu-preference", "high-performance");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-hardware-overlays");
app.commandLine.appendSwitch("ignore-resolution-limits-for-acceleration");
app.commandLine.appendSwitch("vaapi-ignore-driver-checks");

let mainWindow = null;

/**
 * Convert an openanime:// URL to an https://openani.me URL.
 * e.g. "openanime://anime/123" -> "https://openani.me/anime/123"
 */
function protocolUrlToWebUrl(protocolUrl) {
  if (!protocolUrl || !protocolUrl.startsWith(PROTOCOL + "://")) return null;
  const pathPart = protocolUrl.slice((PROTOCOL + "://").length);
  return URL + "/" + pathPart;
}

/**
 * Handle an incoming deep link URL.
 * If the window exists, navigate it; otherwise store for later.
 */
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
    // On Linux the URL is passed as the last argv element
    const url = argv.find(arg => arg.startsWith(PROTOCOL + "://"));
    if (url) handleDeepLink(url);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS / some Linux DEs fire open-url instead
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "icon512.png"),
    frame: false,
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

  // Consolidate start URL: check pendingUrl (from open-url) first, then process.argv
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

  // Keyboard Shortcuts Handler
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // ESC -> Go Back
    if (input.key === "Escape") {
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      } else if (mainWindow.webContents.navigationHistory.canGoBack()) {
        mainWindow.webContents.navigationHistory.goBack();
      }
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
