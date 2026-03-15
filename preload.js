const { contextBridge, ipcRenderer } = require('electron');

// Force WebGPU enabled — overrides the site's stored user preference
localStorage.setItem('settings.useWebGPU', 'true');

window.addEventListener('DOMContentLoaded', () => {

  // Read config from main process using a synchronous IPC, or just check localStorage since it's renderer context?
  // Actually, we can just use an IPC or we can check localStorage if we sync it.
  // We'll read the same config.json directly from preload if nodeIntegration/fs is available? No, contextIsolation is true.
  // So we will request config via IPC. Let's do it simply by sending an IPC sync message.
  const customFrameEnabled = ipcRenderer.sendSync('get-config', 'useCustomFrame');

  if (!customFrameEnabled) {
    return; // Do nothing if custom frame is not enabled
  }

  const style = document.createElement('style');
  style.textContent = `
    #custom-titlebar {
      position: fixed;
      top: 0;
      right: 60px; /* Shifted left to avoid overlapping with top-right buttons on the website */
      display: flex;
      pointer-events: none; /* Container is transparent to clicks */
      padding: 10px;
      gap: 8px;
      transition: opacity 0.3s;
    }
    #custom-titlebar.hidden {
      opacity: 0;
    }
    #custom-titlebar.auto-hidden {
      opacity: 0;
    }
    .win-btn {
      pointer-events: auto; /* Buttons are clickable */
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.2s ease;
      background-color: rgba(128, 128, 128, 0.3); /* Passive gray/transparent */
      opacity: 0.8;
    }
    .win-btn:hover { opacity: 1; transform: scale(1.1); }
    .win-btn svg { width: 8px; height: 8px; fill: #333; opacity: 0; transition: opacity 0.2s; }
    .win-btn:hover svg { opacity: 1; }
    
    /* MacOS Style Colors (Only on Hover) - Pastel/Soluk */
    .btn-close:hover { background-color: #ff8888; }   /* Pastel Red */
    .btn-minimize:hover { background-color: #ffe088; } /* Pastel Yellow */
    .btn-maximize:hover { background-color: #88ff88; } /* Pastel Green */
  `;
  document.head.appendChild(style);

  const titlebar = document.createElement('div');
  titlebar.id = 'custom-titlebar';
  titlebar.innerHTML = `
    <button class="win-btn btn-minimize" title="Minimize">
      <svg viewBox="0 0 10 2"><path d="M0 0h10v2H0z"/></svg>
    </button>
    <button class="win-btn btn-maximize" title="Maximize">
      <svg viewBox="0 0 10 10"><path d="M0 0h10v10H0V0zm2 2v6h6V2H2z"/></svg>
    </button>
    <button class="win-btn btn-close" title="Close">
      <svg viewBox="0 0 10 10"><path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z"/></svg>
    </button>
  `;
  document.body.appendChild(titlebar);

  // IPC Event Handlers
  titlebar.querySelector('.btn-minimize').addEventListener('click', (e) => {
    e.target.closest('button').blur(); // Remove focus
    ipcRenderer.send('window-control', 'minimize');
  });
  titlebar.querySelector('.btn-maximize').addEventListener('click', (e) => {
    e.target.closest('button').blur(); // Remove focus
    ipcRenderer.send('window-control', 'maximize');
  });
  titlebar.querySelector('.btn-close').addEventListener('click', (e) => {
    e.target.closest('button').blur(); // Remove focus
    ipcRenderer.send('window-control', 'close');
  });

  // Auto-hide on mouse inactivity (2s)
  let hideTimer = null;
  const AUTO_HIDE_DELAY = 2100;

  function showTitlebar() {
    titlebar.classList.remove('auto-hidden');
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      titlebar.classList.add('auto-hidden');
    }, AUTO_HIDE_DELAY);
  }

  document.addEventListener('mousemove', () => {
    showTitlebar();
    scheduleHide();
  });

  // Start the initial hide timer
  scheduleHide();

  // Keep titlebar visible during HTML5 Web Fullscreen (like the video player)
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      document.fullscreenElement.appendChild(titlebar);
    } else {
      document.body.appendChild(titlebar);
    }
  });
});
