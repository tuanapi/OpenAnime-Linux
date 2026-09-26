'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const {
  enumerateDrmCards,
  displayGpuClassification,
  renderNodeCount,
  hasNvidiaModule,
  hasNvidiaDrm,
  hasAmdDiscrete,
  nvidiaRenderNode,
} = require('./scripts/gpu-detect');

const configPath = path.join(app.getPath('userData'), 'config.json');
let config = { highPerformance: true, forcePrimeOffload: false, gpuDisplayOverride: null };
try {
  if (fs.existsSync(configPath)) {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }
} catch (e) {}

// Strip external --render-node-override.
let i = 0;
while (i < process.argv.length) {
  const a = process.argv[i];
  if (a === '--render-node-override' || a.startsWith('--render-node-override=')) {
    process.argv.splice(i, 1);
    if (a === '--render-node-override') process.argv.splice(i, 1); // also drops its value arg
    console.warn('[GPU] stripped --render-node-override (stale flag; crashes hybrid GPU process)');
    continue;
  }
  i++;
}

function detectSession() {
  const hasWaylandSocket = !!process.env.WAYLAND_DISPLAY;
  const sessionType = process.env.XDG_SESSION_TYPE || '';
  if (sessionType === 'wayland' && (hasWaylandSocket || process.env.DISPLAY)) return 'wayland';
  if (sessionType === 'wayland' && !hasWaylandSocket) return 'x11';
  if (hasWaylandSocket && sessionType === 'x11') return 'x11';
  if (hasWaylandSocket) return 'wayland';
  return 'x11';
}

const cards = enumerateDrmCards();
const hasNvidia = hasNvidiaModule();
const renderNodes = renderNodeCount();
const isHybrid = renderNodes > 1 || cards.length > 1;
const displayGpu = displayGpuClassification(cards, config.gpuDisplayOverride);
const iGpuDrivesDisplay = displayGpu === 'integrated';
const hasAmdDiscreteGpu = hasAmdDiscrete(cards);
const session = detectSession();

console.log(`[GPU] session=${session} hybrid=${isHybrid} nvidia=${hasNvidia} ` +
  `renderNodes=${renderNodes} displayGpu=${displayGpu} displayGpuIntegrated=${iGpuDrivesDisplay} ` +
  `amdDiscrete=${hasAmdDiscreteGpu}`);

const ozoneX11inArgv = process.argv.includes('--ozone-platform=x11');
const goingX11 = session === 'wayland' && !ozoneX11inArgv && hasNvidia && isHybrid &&
  iGpuDrivesDisplay && config.highPerformance !== false;

if (isHybrid && config.highPerformance !== false) {
  if (hasNvidia) {
    // Vulkan only sees NVIDIA.
    process.env.__VK_LAYER_NV_optimus = process.env.__VK_LAYER_NV_optimus || 'NVIDIA_only';
    const nvidiaIcd = '/usr/share/vulkan/icd.d/nvidia_icd.json';
    global.__hasNvidiaVulkan = fs.existsSync(nvidiaIcd);
    if (global.__hasNvidiaVulkan && !process.env.VK_ICD_FILENAMES) {
      process.env.VK_ICD_FILENAMES = nvidiaIcd;
    }

    if (!iGpuDrivesDisplay || goingX11 || ozoneX11inArgv || session === 'x11') {
      process.env.__NV_PRIME_RENDER_OFFLOAD = process.env.__NV_PRIME_RENDER_OFFLOAD || '1';
      process.env.__GLX_VENDOR_LIBRARY_NAME = process.env.__GLX_VENDOR_LIBRARY_NAME || 'nvidia';
    }

    if (!iGpuDrivesDisplay) {
      const nvNode = nvidiaRenderNode(cards);
      if (nvNode) {
        process.env.VAAPI_DRM_DEVICE = nvNode;
        console.log(`[GPU] VA-API H.265 decode -> ${nvNode} (NVIDIA); presentation stays on display GPU`);
      } else {
        console.warn('[GPU] NVIDIA card has no render node (nvidia_drm?) - leaving VA-API device automatic');
      }
    }
  } else if (displayGpu !== 'discrete' || config.forcePrimeOffload === true) {
    process.env.DRI_PRIME = process.env.DRI_PRIME || '1';
    if (hasAmdDiscreteGpu) {
      process.env.RADV_DEBUG = ['RADV_DEBUG', 'nodcc'].filter(Boolean).join(',');
      process.env.AMD_DEBUG = ['AMD_DEBUG', 'nodcc'].filter(Boolean).join(',');
    }
  }
}

global.__hasNvidiaHardware = hasNvidia;
global.__hasNvidiaDrm = hasNvidiaDrm();
global.__iGpuDrivesDisplay = iGpuDrivesDisplay;
global.__isWayland = session === 'wayland';
global.__isX11 = session === 'x11';
global.__isHybrid = isHybrid;
global.__gpuPrimeReady = Promise.resolve();

let relaunched = false;
if (goingX11) {
  console.log('[GPU] iGPU display + NVIDIA on Wayland -> relaunching under X11 (XWayland)');
  try {
    const { spawn } = require('child_process');
    // Child: core-silent during init (TRAP recovers, core trips popups).
    const child = spawn('/bin/sh', ['-c', 'ulimit -c 0; exec "$0" "$@"',
      process.execPath, '--ozone-platform=x11', ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: process.env,
    });
    relaunched = true;
    child.on('error', (e) => {
      console.error('[GPU] X11 relaunch failed, continuing on Wayland:', e);
      relaunched = false;
      boot();
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  } catch (e) {
    console.error('[GPU] X11 relaunch failed, continuing on Wayland:', e);
    relaunched = false;
  }
}

function boot() {
  if (process.argv.includes('--diagnose')) {
    require('./scripts/gpu-diagnose.js');
  } else {
    require('./main.js');
  }
}
if (!relaunched) boot();