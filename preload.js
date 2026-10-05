const { ipcRenderer, contextBridge, webFrame } = require('electron');

const forceWebGPU = ipcRenderer.sendSync('get-config', 'forceWebGPU');
try {
  if (forceWebGPU === true && localStorage.getItem('settings.useWebGPU') !== 'true') {
    localStorage.setItem('settings.useWebGPU', 'true');
  } else if (forceWebGPU === false && localStorage.getItem('settings.useWebGPU') === 'true') {
    localStorage.setItem('settings.useWebGPU', 'false');
  }
} catch (e) {}

const isChildWindow = process.argv.includes('--child-window');

function watchPremid() {
  let watchedVideo = null;
  let debounceTimer = null;
  let announcer = null;
  let discoveryActive = false;

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
    if (watchedVideo) ['play', 'pause', 'seeked'].forEach(evt => watchedVideo.removeEventListener(evt, readAndSend));
    watchedVideo = vid;
    ['play', 'pause', 'seeked'].forEach(evt => vid.addEventListener(evt, readAndSend));
  }

  function attachAnnouncer(el) {
    if (announcer === el && announcer.isConnected) return;
    announcerObserver.disconnect();
    announcer = el;
    announcerObserver.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function detachAnnouncer() {
    announcerObserver.disconnect();
    announcer = null;
  }

  function armDiscovery() {
    if (discoveryActive) return;
    discoveryActive = true;
    discoveryObserver.observe(document.body, { childList: true, subtree: true });
  }

  function disarmDiscovery() {
    if (!discoveryActive) return;
    discoveryActive = false;
    discoveryObserver.disconnect();
  }

  function reconcile() {
    const el = document.querySelector('premid-announcer');
    if (el) {
      attachAnnouncer(el);
    } else if (announcer) {
      detachAnnouncer();
    }
    syncVideoListeners();
    if (announcer && announcer.isConnected && document.querySelector('video')) {
      disarmDiscovery();
    } else {
      armDiscovery();
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(readAndSend, 250);
  }

  const announcerObserver = new MutationObserver(reconcile);
  const discoveryObserver = new MutationObserver(reconcile);
  const detachTripwire = new MutationObserver(() => {
    if (announcer && !announcer.isConnected) reconcile();
  });
  detachTripwire.observe(document.body, { childList: true, subtree: true });

  armDiscovery();
  reconcile();
}

contextBridge.exposeInMainWorld('openanime', {
  getConfig: (key) => ipcRenderer.sendSync('get-config', key),
  getConfigAll: () => ipcRenderer.sendSync('get-config-all'),
  setRpcEnabled: (enabled) => ipcRenderer.send('rpc-set-enabled', enabled),
  setConfig: (key, value) => ipcRenderer.send('config-set', key, value)
});

if (!isChildWindow) {
  const source = ipcRenderer.sendSync('get-injected-source');
  if (source) webFrame.executeJavaScript(source).catch(() => {});
}

window.addEventListener('DOMContentLoaded', () => {
  if (isChildWindow) return;
  watchPremid();
});
