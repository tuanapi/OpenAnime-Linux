const { ipcRenderer } = require('electron');

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

  // Read current premid state and video state, send via IPC if present
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

  // Attach play/pause/seeked listeners to the current video element
  function syncVideoListeners() {
    const vid = document.querySelector('video');
    if (!vid || vid === watchedVideo) return;
    watchedVideo = vid;
    ['play', 'pause', 'seeked'].forEach(evt => vid.addEventListener(evt, readAndSend));
  }

  // Watch the page body for DOM changes, debounced
  new MutationObserver(() => {
    syncVideoListeners();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(readAndSend, 250);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  syncVideoListeners();
  setInterval(readAndSend, 10000); // fallback poll
}

window.addEventListener('DOMContentLoaded', () => {
  if (isChildWindow) return;
  watchPremid();
});
