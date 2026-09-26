'use strict';

/**
 * gpu-diagnose.js — runtime GPU probe for OpenAnime.
 *
 * Prints which GPU Chromium picked for WebGL/WebGPU/compositing, the
 * presentation fps, and the topology decisions the launcher made. Use it to
 * verify WebGPU lands on the discrete GPU on ANY machine:
 *
 *   npm run diagnose
 *   # or, matching the packaged app's flags:
 *   npx electron scripts/gpu-diagnose.js
 *
 * Output ends with a single-line DIAG_JSON=... record that is safe to paste
 * into an issue.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Mirror the app's rendering flags so the probe measures the real ship state.
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force-high-performance-gpu');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-resolution-limits-for-acceleration');
app.commandLine.appendSwitch('vaapi-ignore-driver-checks');
app.commandLine.appendSwitch('disable-gpu-sandbox');

if (process.argv.includes('--x11')) {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
}

const pretty = (s) => (s === null || s === undefined || s === '' ? '(empty)' : s);

app.whenReady().then(async () => {
  const diag = {
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    session: `${process.env.XDG_SESSION_TYPE || ''} (${process.env.WAYLAND_DISPLAY ? 'wayland socket' : 'no wayland'})`,
    ozone: app.commandLine.getSwitchValue('ozone-platform') || 'auto',
    env: {
      __NV_PRIME_RENDER_OFFLOAD: process.env.__NV_PRIME_RENDER_OFFLOAD || null,
      __GLX_VENDOR_LIBRARY_NAME: process.env.__GLX_VENDOR_LIBRARY_NAME || null,
      __VK_LAYER_NV_optimus: process.env.__VK_LAYER_NV_optimus || null,
      DRI_PRIME: process.env.DRI_PRIME || null,
      __EGL_VENDOR_LIBRARY_FILENAMES: process.env.__EGL_VENDOR_LIBRARY_FILENAMES || null,
      VK_ICD_FILENAMES: process.env.VK_ICD_FILENAMES || null,
    },
  };

  try {
    const basic = await app.getGPUInfo('basic');
    diag.gpuInfo = {
      activeAdapter: {
        vendorId: pretty(basic.activeAdapter?.vendorId),
        deviceId: pretty(basic.activeAdapter?.deviceId),
        description: pretty(basic.activeAdapter?.description),
        driverVendor: pretty(basic.activeAdapter?.driverVendor),
      },
      gpuDevices: (basic.gpuDevice || []).map((d) => ({
        vendorId: pretty(d.vendorId),
        deviceId: pretty(d.deviceId),
        description: pretty(d.description),
      })),
    };
  } catch (e) {
    diag.gpuInfoError = e.message;
  }

  const win = new BrowserWindow({ width: 900, height: 620, show: true, autoHideMenuBar: true });
  await win.loadFile(path.join(__dirname, 'diagnose.html'));

  let page = {};
  for (let i = 0; i < 70; i++) {
    await new Promise((r) => setTimeout(r, 500));
    page = await win.webContents.executeJavaScript('window.__diag || {}', true);
    const done = page.rafFps !== undefined &&
      (page.webgpuFps !== undefined || page.webgpu === 'NO ADAPTER (null)');
    if (done) break;
  }

  diag.page = page;

  console.log('\n=== OpenAnime GPU Diagnose ===');
  console.log(`session             : ${diag.session}`);
  console.log(`ozone               : ${diag.ozone}`);
  console.log(`env offload vars    : ${JSON.stringify(diag.env)}`);
  if (diag.gpuInfo) {
    for (const d of diag.gpuInfo.gpuDevices) {
      console.log(`gpu device          : ${d.description} (${d.vendorId}:${d.deviceId})`);
    }
    console.log(`active GL adapter   : ${diag.gpuInfo.activeAdapter.description} (${diag.gpuInfo.activeAdapter.vendorId}:${diag.gpuInfo.activeAdapter.deviceId})`);
  }
  if (page.webgl2) console.log(`webgl2 renderer     : ${page.webgl2}`);
  if (page.webgpu) console.log(`webgpu adapter      : ${page.webgpu}`);
  if (page.rafFps) console.log(`presentation fps    : ${page.rafFps}`);
  if ('webgpuFps' in page) console.log(`webgpu fps (load)   : ${page.webgpuFps}`);
  if (diag.page.webgpuPipelineOK === false) console.log('webgpu pipeline     : FAILED');
  if (page.errors && page.errors.length) console.log(`errors              : ${page.errors.join(' | ')}`);

  console.log(`DIAG_JSON=${JSON.stringify({ ...diag, page })}\n`);
  app.exit(0);
});