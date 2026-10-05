const { execFile, spawn } = require('child_process');

const PKG = 'openanime';

const TERMINALS = [
  ['x-terminal-emulator', ['-e']],
  ['gnome-terminal', ['--']],
  ['konsole', ['-e']],
  ['xfce4-terminal', ['-e']],
  ['alacritty', ['-e']],
  ['wezterm', ['start', '--']],
  ['foot', []],
  ['kitty', []],
  ['st', ['-e']],
  ['xterm', ['-e']]
];

const MANAGERS = [
  {
    name: 'apt',
    probe: ['dpkg-query', ['-W', '-f=${db:Status-Status}', PKG]],
    accepts: (out) => out.trim() === 'installed',
    run: 'apt-get update && apt-get install --only-upgrade -y ' + PKG,
    alt: { probe: ['apt-get'], run: null }
  },
  {
    name: 'dnf',
    probe: ['rpm', ['-q', PKG]],
    accepts: (out) => out.trim().startsWith(PKG),
    run: 'dnf upgrade -y ' + PKG,
    alt: { probe: ['yum'], run: 'yum upgrade -y ' + PKG }
  },
  {
    name: 'pacman',
    probe: ['pacman', ['-Qq', PKG]],
    accepts: (out) => out.trim() === PKG,
    run: 'pacman -Sy --noconfirm ' + PKG
  }
];

function which(bin) {
  if (!bin) return Promise.resolve('');
  return new Promise((resolve) => {
    execFile('/usr/bin/which', [bin], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve('');
      resolve(String(stdout).trim().split('\n')[0] || '');
    });
  });
}

function probe(entry, cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(false);
      try {
        resolve(entry.accepts(String(stdout)));
      } catch (e) {
        resolve(false);
      }
    });
  });
}

let cached;

async function detect() {
  if (cached !== undefined) return cached;
  cached = (await Promise.all(MANAGERS.map(async (entry) => {
    const path = await which(entry.probe[0]);
    if (!path) return null;
    return (await probe(entry, path, entry.probe[1])) ? entry : null;
  }))).find(Boolean) || null;
  return cached;
}

function detach(cmd, args, waitExit) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => done(false));
    if (waitExit) {
      child.on('close', (code) => { child.unref(); done(code === 0); });
    } else {
      child.on('spawn', () => { child.unref(); done(true); });
    }
  });
}

function inTerminal(command) {
  return (async () => {
    const pause = '; printf "\\nclosed, press Enter\\n"; read -r _';
    const order = process.env.TERMINAL
      ? [[process.env.TERMINAL, ['-e']], ...TERMINALS]
      : TERMINALS;
    for (const [term, flag] of order) {
      const path = await which(term);
      if (!path) continue;
      if (await detach(path, [...flag, 'sh', '-c', command + pause])) return true;
    }
    return false;
  })();
}

async function privileged(manager) {
  const pkexec = await which('pkexec');
  if (pkexec) {
    try {
      return await detach(pkexec, ['sh', '-c', manager.run], true);
    } catch (e) {
      // fall through to a terminal
    }
  }
  return inTerminal(manager.run);
}

async function run() {
  const appimage = process.env.APPIMAGE;
  if (appimage && appimage.endsWith('.AppImage')) {
    const updater = await which('openanime-update');
    if (updater) {
      await detach(updater, [appimage]);
      return { handled: true, via: 'appimage' };
    }
    return { handled: false, via: null };
  }

  const manager = await detect();
  if (!manager) return { handled: false, via: null };

  let chosen = manager;
  if (manager.alt) {
    const altPath = await which(manager.alt.probe[0]);
    if (!altPath && manager.alt.run) chosen = { ...manager, run: manager.alt.run };
  }

  return { handled: await privileged(chosen), via: chosen.name };
}

module.exports = { run, detect, MANAGERS };
