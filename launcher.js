const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function hasNvidiaGpu() {
  try {
    return fs.existsSync('/usr/share/vulkan/icd.d/nvidia_icd.json');
  } catch (e) {
    return false;
  }
}

function shouldForceX11() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (typeof config.forceX11 === 'boolean') return config.forceX11;
  } catch (e) {}
  return hasNvidiaGpu();
}

const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;

if (isWayland && !process.argv.includes('--ozone-platform=x11') && shouldForceX11()) {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['--ozone-platform=x11', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  require('./main.js');
}
