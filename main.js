const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const URL = "https://openani.me";

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

  mainWindow.loadURL(URL);

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
