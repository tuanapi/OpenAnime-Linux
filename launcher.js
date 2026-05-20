// Wayland + Vulkan workaround for Electron 42+
// --ozone-platform must be a real CLI argument; app.commandLine.appendSwitch is too late
const isWayland = process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY;

if (isWayland && !process.argv.includes('--ozone-platform=x11')) {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['--ozone-platform=x11', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  require('./main.js');
}
