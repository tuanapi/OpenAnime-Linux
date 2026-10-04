'use strict';

const { app, dialog } = require('electron');

const REPO = 'tuanapi/OpenAnime-Linux';
const ENDPOINT = `https://api.github.com/repos/${REPO}/releases/latest`;
const FIRST_CHECK_DELAY_MS = 8000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

// Only the core triple is compared. Tags carry a packaging counter
// (v1.1.6-2) that app.getVersion() can never express, so comparing it would
// re-prompt every launch for a rebuild of the version already installed.
function coreVersion(value) {
  if (value === null || value === undefined) return null;
  const m = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(String(value));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function isNewerThan(remote, local) {
  if (!remote || !local) return false;
  for (let i = 0; i < 3; i += 1) {
    if (remote[i] !== local[i]) return remote[i] > local[i];
  }
  return false;
}

async function fetchLatestRelease() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OpenAnime'
      }
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body || body.draft || body.prerelease || !body.tag_name) return null;
    return {
      tag: String(body.tag_name),
      url: String(body.html_url || ''),
      name: String(body.name || body.tag_name)
    };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function askAboutRelease(release, win, openExternal, onDismiss) {
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Güncelleme',
    message: 'Yeni sürüm available!',
    detail: `${release.name} yayımlandı. Şu an ${app.getVersion()} kullanıyorsunuz.`,
    buttons: ['Şimdi güncelle', 'Daha sonra'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  });
  if (response === 0) openExternal(release.url);
  else onDismiss(release.tag);
}

function start(options) {
  const { getWindow, openExternal, getDismissed, setDismissed } = options;
  if (!app.isPackaged) return () => {};

  let stopped = false;
  let inFlight = false;

  const check = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const release = await fetchLatestRelease();
      if (stopped || !release) return;
      if (!isNewerThan(coreVersion(release.tag), coreVersion(app.getVersion()))) return;
      if (getDismissed() === release.tag) return;
      const win = getWindow();
      if (!win || win.isDestroyed()) return;
      await askAboutRelease(release, win, openExternal, setDismissed);
    } catch (e) {
      console.error('Update check failed:', e);
    } finally {
      inFlight = false;
    }
  };

  const firstRun = setTimeout(() => {
    check();
    setInterval(check, CHECK_INTERVAL_MS);
  }, FIRST_CHECK_DELAY_MS);

  return () => {
    stopped = true;
    clearTimeout(firstRun);
  };
}

module.exports = { start, coreVersion, isNewerThan, fetchLatestRelease };
