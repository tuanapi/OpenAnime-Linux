const { ipcRenderer, contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

// Force WebGPU on unless disabled in config
const forceWebGPU = ipcRenderer.sendSync('get-config', 'forceWebGPU');
if (forceWebGPU !== false) {
  localStorage.setItem('settings.useWebGPU', 'true');
}

// Whether this is a popup/child window
const isChildWindow = process.argv.includes('--child-window');

// Watch the page for Discord Rich Presence data and pushes updates to main
function watchPremid() {
  let watchedVideo = null;
  let debounceTimer = null;

  function readAndSend() {
    const el = document.querySelector('premid-announcer');
    if (!el) return;
    let parsed;
    try {
      let clean = el.textContent.trim();
      if (clean.startsWith('"') && clean.endsWith('"')) clean = JSON.parse(clean);
      parsed = typeof clean === 'string' ? JSON.parse(clean) : clean;
    } catch (e) {
      return;
    }
    const vid = document.querySelector('video');
    if (vid && parsed && parsed.video) {
      parsed.video.currentTime = vid.currentTime;
      parsed.video.paused = vid.paused;
    }
    ipcRenderer.send('premid-update', parsed);
  }

  function syncVideoListeners() {
    const vid = document.querySelector('video');
    if (!vid || vid === watchedVideo) return;
    watchedVideo = vid;
    ['play', 'pause', 'seeked'].forEach(evt => vid.addEventListener(evt, readAndSend));
  }

  new MutationObserver(() => {
    syncVideoListeners();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(readAndSend, 250);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  syncVideoListeners();
  setInterval(readAndSend, 10000); // fallback poll
}

contextBridge.exposeInMainWorld('openanime', {
  getConfig: (key) => ipcRenderer.sendSync('get-config', key),
  setRpcEnabled: (enabled) => ipcRenderer.send('rpc-set-enabled', enabled),
  setConfig: (key, value) => ipcRenderer.send('config-set', key, value)
});

function injectMainWorld() {
  try {
    const code = fs.readFileSync(path.join(__dirname, 'injected.js'), 'utf8');
    const s = document.createElement('script');
    s.textContent = code;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  } catch (e) {
    console.error('injectMainWorld failed:', e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (isChildWindow) return;
  watchPremid();
  injectMainWorld();
});