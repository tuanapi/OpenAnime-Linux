const { contextBridge, ipcRenderer } = require('electron');

// Force WebGPU on - ignores the site's own settings for better Linux support
localStorage.setItem('settings.useWebGPU', 'true');

window.addEventListener('DOMContentLoaded', () => {

  // Grab config from the main process
  const customFrameEnabled = ipcRenderer.sendSync('get-config', 'useCustomFrame');

  if (!customFrameEnabled) {
    return; // Do nothing if custom frame is not enabled
  }

  // Load titlebar specific config
  const tbConfig = ipcRenderer.sendSync('get-config', 'titlebar') || {};
  const cfg = {
    right: tbConfig.right !== undefined ? tbConfig.right : '85px',
    top: tbConfig.top !== undefined ? tbConfig.top : '12px',
    gap: tbConfig.gap !== undefined ? tbConfig.gap : '15px',
    btnSize: tbConfig.btnSize !== undefined ? tbConfig.btnSize : '16px',
    btnOpacity: tbConfig.btnOpacity !== undefined ? tbConfig.btnOpacity : '0.8',
    debug: tbConfig.debug === true
  };

  const style = document.createElement('style');
  style.id = 'custom-titlebar-styles';
  style.textContent = `
    #custom-titlebar {
      position: fixed;
      top: ${cfg.top};
      right: ${cfg.right};
      display: flex;
      flex-direction: row;
      pointer-events: auto !important; /* Allow container to receive events */
      background: transparent;
      z-index: 2147483647 !important;
      transition: opacity 0.3s;
      gap: ${cfg.gap};
      padding: 5px;
      ${cfg.debug ? 'outline: 1px solid red !important;' : ''}
    }
    #custom-titlebar.hidden, #custom-titlebar.auto-hidden {
      opacity: 0;
      pointer-events: none !important;
    }
    .win-btn {
      pointer-events: auto !important;
      width: ${cfg.btnSize};
      height: ${cfg.btnSize};
      border-radius: 50%;
      border: none;
      cursor: pointer !important;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.2s ease;
      background-color: rgba(128, 128, 128, 0.4);
      opacity: ${cfg.btnOpacity};
      -webkit-app-region: no-drag;
    }
    .win-btn:hover { opacity: 1; transform: scale(1.15); }
    .win-btn svg { 
      width: calc(${cfg.btnSize} * 0.6); 
      height: calc(${cfg.btnSize} * 0.6); 
      fill: #333; 
      opacity: 0; 
      transition: opacity 0.2s; 
      pointer-events: none; 
    }
    .win-btn:hover svg { opacity: 1; }
    
    /* MacOS button colors on hover */
    .btn-close:hover { background-color: #ff5f56 !important; }
    .btn-minimize:hover { background-color: #ffbd2e !important; }
    .btn-maximize:hover { background-color: #27c93f !important; }
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

  // Mousedown is way more reliable for these controls
  const handleControl = (action) => {
    console.log('[Titlebar] Action:', action);
    ipcRenderer.send('window-control', action);
  };

  titlebar.querySelector('.btn-minimize').addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleControl('minimize');
  });
  titlebar.querySelector('.btn-maximize').addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleControl('maximize');
  });
  titlebar.querySelector('.btn-close').addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleControl('close');
  });

  // Auto-hide on mouse inactivity (2.1s)
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

  // Keep it visible in HTML5 fullscreen (for the player)
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      document.fullscreenElement.appendChild(titlebar);
    } else {
      document.body.appendChild(titlebar);
    }
  });
});
