'use strict';

/**
 * Hybrid-GPU detection: classifies every DRM card by PCI vendor + device ID,
 * falling back to the bus heuristic (bus 00 = integrated fails on AM4/AM5
 * desktops whose iGPU sits on a non-zero bus). Sysfs-only, no tools.
 * Self-test: node scripts/gpu-detect.js --self-test
 */

const fs = require('fs');
const path = require('path');

const DRM_DIR = '/sys/class/drm';
const DRI_DIR = '/dev/dri';

const VENDOR = Object.freeze({
  NVIDIA: 0x10de,
  AMD: 0x1002,
  INTEL: 0x8086,
});

/** AMD APU PCI IDs (amdgpu CHIP_* tables); unknown parts use bus/VRAM fallback. */
const AMD_APU_DEVICES = new Set([
  0x15d8, // Picasso
  0x15dd, // Raven Ridge
  0x1636, // Renoir / Lucienne
  0x1638, // Cezanne / Barcelo
  0x163f, // Van Gogh
  0x164c, // Mendocino
  0x164e, // Raphael / Dragon Range (AM5 desktops — non-zero bus!)
  0x1681, // Rembrandt / Dragon Range
]);

/** VRAM below which an unknown AMD part counts as integrated (APUs ≤512 MiB). */
const AMD_VRAM_INTEGRATED_BYTES = 2 * 1024 * 1024 * 1024;

function parseIntSafe(hex) {
  if (typeof hex !== 'string') return null;
  const n = parseInt(hex.trim(), 16);
  return Number.isNaN(n) ? null : n;
}

/** amdgpu mem_info_* files are DECIMAL byte counts — radix 10, never 16. */
function readDecimalBytes(file) {
  try {
    const n = Number(fs.readFileSync(file, 'utf8').trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function readHex(file) {
  try {
    return parseIntSafe(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function vendorName(id) {
  if (id === VENDOR.NVIDIA) return 'nvidia';
  if (id === VENDOR.AMD) return 'amd';
  if (id === VENDOR.INTEL) return 'intel';
  return id === null ? 'unknown' : `0x${id.toString(16)}`;
}

function pciBusOf(pciAddr) {
  if (typeof pciAddr !== 'string') return null;
  const m = pciAddr.match(/^[0-9a-fA-F]{4}:([0-9a-fA-F]{2}):/);
  return m ? parseInt(m[1], 16) : null;
}

/**
 * Classify one card: 'integrated' | 'discrete' | 'unknown'.
 * Signals, strongest first: vendor+device table, AMD VRAM size, bus number.
 */
function classifyGpuCard({ vendorId, deviceId, pciAddr, vramTotal }) {
  const bus = pciBusOf(pciAddr);

  if (vendorId === VENDOR.NVIDIA) return 'discrete';

  if (vendorId === VENDOR.AMD) {
    if (AMD_APU_DEVICES.has(deviceId)) return 'integrated';
    // Unknown AMD part: <2 GiB VRAM BAR = stolen APU memory, not a dGPU.
    if (vramTotal !== undefined && vramTotal !== null && vramTotal < AMD_VRAM_INTEGRATED_BYTES) {
      return 'integrated';
    }
    // Unknown AMD part: bus 00 strongly implies an iGPU.
    if (bus === 0) return 'integrated';
    return 'discrete';
  }

  if (vendorId === VENDOR.INTEL) {
    // Intel iGPU = bus 00 (0:2.0 on laptops). Arc discrete sits elsewhere.
    return bus === 0 ? 'integrated' : 'discrete';
  }

  // Unknown vendor: fall back to the bus heuristic.
  if (vendorId === null && bus === 0) return 'integrated';
  return 'unknown';
}

/**
 * Enumerate DRM cards with PCI identity + connector status. Never throws.
 */
function enumerateDrmCards(drmDir = DRM_DIR) {
  const cards = [];
  if (!fs.existsSync(drmDir)) return cards;

  for (const entry of fs.readdirSync(drmDir)) {
    if (!/^card\d+$/.test(entry)) continue;

    const cardDir = path.join(drmDir, entry);
    const deviceDir = path.join(cardDir, 'device');

    let pciAddr = null;
    try {
      pciAddr = fs.realpathSync(deviceDir).split('/').pop();
    } catch {
      /* not a PCI device (e.g. vkms) — skip address */
    }

    // Connected when any `cardN-<connector>` child reports status connected.
    let connected = false;
    try {
      for (const child of fs.readdirSync(cardDir)) {
        if (!/^card\d+-/.test(child)) continue;
        const status = readHexStatus(path.join(cardDir, child, 'status'));
        if (status === 'connected') {
          connected = true;
          break;
        }
      }
    } catch {
      /* ignore */
    }

    cards.push({
      card: entry,
      pciAddr,
      vendorId: readHex(path.join(deviceDir, 'vendor')),
      deviceId: readHex(path.join(deviceDir, 'device')),
      vendor: null, // filled below
      connected,
      // amdgpu-only sysfs: dedicated VRAM in bytes (iGPU APUs report their
      // small stolen memory here, often 512 MiB; null on NVIDIA/Intel).
      vramTotal: readDecimalBytes(path.join(deviceDir, 'mem_info_vram_total')),
    });
  }

  for (const c of cards) c.vendor = vendorName(c.vendorId);
  return cards;
}

function readHexStatus(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Which GPU drives the display: 'integrated' | 'discrete' | 'mixed' | null.
 * NVIDIA-elimination rule: in any NVIDIA hybrid the single non-NVIDIA card
 * is the iGPU by construction, regardless of table/bus/VRAM signals.
 */
function displayGpuClassification(cards, override = null) {
  if (override === 'integrated' || override === 'discrete') return override;

  const connected = cards.filter((c) => c.connected);
  if (connected.length === 0) return null;

  const nvidiaPresent = cards.some((c) => c.vendorId === VENDOR.NVIDIA);
  const nonNvidiaConnected = connected.filter((c) => c.vendorId !== VENDOR.NVIDIA);

  let classes;
  if (nvidiaPresent && nonNvidiaConnected.length === 1 && connected.length <= 2) {
    // NVIDIA + one other card: that card drives the display -> integrated.
    classes = connected.map((c) => (c.vendorId === VENDOR.NVIDIA ? 'discrete' : 'integrated'));
  } else {
    classes = connected.map((c) => classifyGpuCard(c));
  }

  if (classes.every((c) => c === 'integrated')) return 'integrated';
  if (classes.every((c) => c === 'discrete')) return 'discrete';
  if (classes.some((c) => c === 'integrated') && classes.some((c) => c === 'discrete')) return 'mixed';
  return null;
}

/** Number of usable render nodes (/dev/dri/renderD*) — hybrid GPUs expose 2+. */
function renderNodeCount(driDir = DRI_DIR) {
  try {
    return fs.readdirSync(driDir).filter((f) => f.startsWith('renderD')).length;
  } catch {
    return 0;
  }
}

/**
 * Render node (/dev/dri/renderDN) for a PCI address, or null.
 * Bridge: /sys/class/drm/renderDN symlinks into <pci addr>/drm/, so the
 * address appears in the resolved path.
 */
function renderNodeForPci(pciAddr) {
  if (typeof pciAddr !== 'string' || !pciAddr) return null;
  try {
    for (const f of fs.readdirSync(DRM_DIR)) {
      if (!/^renderD\d+$/.test(f)) continue;
      const real = fs.realpathSync(path.join(DRM_DIR, f));
      if (real.includes(`/${pciAddr}/`)) return `/dev/dri/${f}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Render node of the NVIDIA card, if any (for single-device pinning). */
function nvidiaRenderNode(cards) {
  const nv = cards.find((c) => c.vendorId === VENDOR.NVIDIA);
  return nv ? renderNodeForPci(nv.pciAddr) : null;
}

/** True when the NVIDIA kernel module is loaded. */
function hasNvidiaModule() {
  return fs.existsSync('/sys/module/nvidia/version') || fs.existsSync('/proc/driver/nvidia/version');
}

/** True when the NVIDIA DRM driver is present (PRIME/dma-buf support). */
function hasNvidiaDrm() {
  try {
    return fs.readdirSync('/sys/module').includes('nvidia_drm');
  } catch {
    return false;
  }
}

/** Any AMD *discrete* card present (for RADV_DEBUG/AMD_DEBUG tweaks). */
function hasAmdDiscrete(cards) {
  return cards.some((c) => c.vendorId === VENDOR.AMD && classifyGpuCard(c) === 'discrete');
}

function summarize(cards, config = {}) {
  const cls = displayGpuClassification(cards, config.gpuDisplayOverride);
  return {
    cards: cards.map((c) => ({
      card: c.card,
      pci: c.pciAddr,
      vendor: c.vendor,
      vendorId: c.vendorId === null ? null : `0x${c.vendorId.toString(16)}`,
      deviceId: c.deviceId === null ? null : `0x${c.deviceId.toString(16)}`,
      classification: classifyGpuCard(c),
      connected: c.connected,
    })),
    displayGpu: cls,
    renderNodes: renderNodeCount(),
    hasNvidia: hasNvidiaModule(),
    hasNvidiaDrm: hasNvidiaDrm(),
  };
}

// ---------------------------------------------------------------------------
// Self-test: run against the live sysfs + synthetic hybrid-topology fixtures.
//   node scripts/gpu-detect.js --self-test
// ---------------------------------------------------------------------------
function selfTest() {
  const live = enumerateDrmCards();
  const liveSummary = summarize(live);

  // Synthetic fixtures covering the topologies we must distinguish:
  // (approximations of real machines)
  const fixtures = {
    'AMD AM5 desktop (7800X3D + RTX 5070 Ti, monitor on iGPU)': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x10de, deviceId: 0x2c05, pciAddr: '0000:01:00.0' },
        { connected: false, vendorId: 0x1002, deviceId: 0x164e, pciAddr: '0000:0f:00.0' },
      ]),
      expect: 'discrete',
    },
    'AMD AM5 desktop, monitor plugged into the iGPU (Raphael, bus 0f)': {
      report: displayGpuClassification([
        { connected: false, vendorId: 0x10de, deviceId: 0x2c05, pciAddr: '0000:01:00.0' },
        { connected: true, vendorId: 0x1002, deviceId: 0x164e, pciAddr: '0000:0f:00.0' },
      ]),
      expect: 'integrated',
    },
    'Intel laptop (iGPU bus 00 + NVIDIA dGPU), monitor on iGPU': {
      report: displayGpuClassification([
        { connected: false, vendorId: 0x10de, deviceId: 0x25a0, pciAddr: '0000:01:00.0' },
        { connected: true, vendorId: 0x8086, deviceId: 0x9a49, pciAddr: '0000:00:02.0' },
      ]),
      expect: 'integrated',
    },
    'AMD laptop (Renoir bus 00 + NVIDIA dGPU)': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x1002, deviceId: 0x1636, pciAddr: '0000:00:08.1/0000:00:00.0' },
        { connected: false, vendorId: 0x10de, deviceId: 0x1f95, pciAddr: '0000:01:00.0' },
      ]),
      expect: 'integrated',
    },
    'Single NVIDIA desktop': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x10de, deviceId: 0x2c05, pciAddr: '0000:01:00.0' },
      ]),
      expect: 'discrete',
    },
    'Single AMD desktop (discrete only)': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x1002, deviceId: 0x744c, pciAddr: '0000:0c:00.0' },
      ]),
      expect: 'discrete',
    },
    'Intel iGPU (bus 00) + Intel Arc dGPU (bus 01), monitor on Arc': {
      report: displayGpuClassification([
        { connected: false, vendorId: 0x8086, deviceId: 0x9a49, pciAddr: '0000:00:02.0' },
        { connected: true, vendorId: 0x8086, deviceId: 0x56a0, pciAddr: '0000:01:00.0' },
      ]),
      expect: 'discrete',
    },
    'AMD future APU (unknown device ID, AM5 bus 0f, 512 MiB stolen VRAM)': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x1002, deviceId: 0x9999, pciAddr: '0000:0f:00.0', vramTotal: 512 * 1024 * 1024 },
      ]),
      expect: 'integrated',
    },
    'AMD dGPU only (RX 7900 XTX, 24 GiB VRAM, bus 0c)': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x1002, deviceId: 0x744c, pciAddr: '0000:0c:00.0', vramTotal: 24 * 1024 * 1024 * 1024 },
      ]),
      expect: 'discrete',
    },
    'NVIDIA + unknown-vendor ARM iGPU (elimination rule), monitor on unknown': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x13b5, deviceId: 0x1234, pciAddr: '0000:02:00.0' },
        { connected: false, vendorId: 0x10de, deviceId: 0x2c05, pciAddr: '0000:01:00.0' },
      ]),
      expect: 'integrated',
    },
    'AMD iGPU (Raphael) + AMD dGPU (RX 7900 XTX), monitors on both (mixed)': {
      report: displayGpuClassification([
        { connected: true, vendorId: 0x1002, deviceId: 0x164e, pciAddr: '0000:0f:00.0' },
        { connected: true, vendorId: 0x1002, deviceId: 0x744c, pciAddr: '0000:0c:00.0' },
      ]),
      expect: 'mixed',
    },
  };

  let failures = 0;
  for (const [name, f] of Object.entries(fixtures)) {
    const ok = f.report === f.expect;
    if (!ok) failures++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${name}\n      got: ${f.report}   expect: ${f.expect}`
    );
  }

  console.log('\n--- live system ---');
  console.log(JSON.stringify(liveSummary, null, 2));

  const legacy = live
    .filter((c) => c.connected)
    .every((c) => {
      const m = c.pciAddr ? c.pciAddr.match(/^[0-9a-fA-F]{4}:([0-9a-fA-F]{2}):/) : null;
      return !m || m[1].toLowerCase() !== '00';
    });
  console.log('\nlegacy bus==00 verdict on this machine (display integrated?):', legacy ? 'false' : 'true');

  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

if (require.main === module && process.argv.includes('--self-test')) {
  selfTest();
}

module.exports = {
  DRM_DIR,
  DRI_DIR,
  VENDOR,
  AMD_APU_DEVICES,
  classifyGpuCard,
  enumerateDrmCards,
  displayGpuClassification,
  renderNodeCount,
  renderNodeForPci,
  nvidiaRenderNode,
  hasNvidiaModule,
  hasNvidiaDrm,
  hasAmdDiscrete,
  summarize,
};