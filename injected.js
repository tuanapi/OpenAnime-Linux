// Runs in the PAGE main world (injected by preload.js). IPC via window.openanime.

(function () {
  const bridge = window.openanime;
  if (!bridge) return;

  (function cards() {
    const RPC_ID = 'oa-rpc-settings-card';
    const WIN_ID = 'oa-window-settings-card';
    const STORE = 'openanime-rpc-enabled';
    const CHUNK_KEY = 'oa-expander-chunk';
    if (window.__oaCardsBooted) return;
    window.__oaCardsBooted = true;

    const rid = () => Math.random().toString(36).slice(2, 14);
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

    const FALLBACK = {
      itemHeader: 'item-header svelte-ndcra2',
      tbBody: 'text-block type-body svelte-9tjxrp',
      item: 'item svelte-ndcra2',
      control: 'expander-control svelte-ndcra2',
      toggleWrap: 'toggle-switch-container svelte-wpiyrh',
      toggle: 'toggle-switch svelte-wpiyrh',
      combo: 'combo-box svelte-wggw9f',
      comboBtn: 'button style-standard combo-box-button svelte-nqc07q',
      comboLabel: 'combo-box-label svelte-wggw9f',
      comboIcon: 'combo-box-icon svelte-wggw9f',
      comboMenu: 'combo-box-dropdown direction-top svelte-wggw9f acrylic',
      comboItem: 'combo-box-item svelte-rf2sr5',
      comboItemInner: 'svelte-rf2sr5',
      contentAnchor: 'expander-content-anchor svelte-1b1dfzj',
      content: 'expander-content svelte-1b1dfzj',
      contentInner: 'expander-content svelte-ndcra2'
    };

    function hashes(refCard) {
      const C = Object.assign({}, FALLBACK);
      const q = (s) => document.querySelector(s);
      const full = (el) => el ? el.className : '';
      const ih = refCard.querySelector('.expander-header-title > *');
      if (ih) C.itemHeader = full(ih);
      const row = q('.expander-content .item');
      if (row) {
        C.item = full(row);
        const lab = row.querySelector(':scope > span');
        if (lab) C.tbBody = full(lab);
        const ctl = row.querySelector(':scope > div');
        if (ctl) C.control = full(ctl);
      }
      const tgl = q('.expander-content .toggle-switch');
      if (tgl) { C.toggle = full(tgl); if (tgl.parentElement) C.toggleWrap = full(tgl.parentElement); }
      const cb = q('.expander-content .combo-box');
      if (cb) {
        C.combo = full(cb);
        const b = cb.querySelector('button');
        if (b) C.comboBtn = full(b);
        const l = cb.querySelector('[class*="combo-box-label"]');
        if (l) C.comboLabel = full(l);
        const ic = cb.querySelector('svg');
        if (ic) C.comboIcon = ic.getAttribute('class') || C.comboIcon;
      }
      return C;
    }

    const DISCORD_ICON = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" slot="icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
    const WINDOW_ICON = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" slot="icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4ZM4 7.5v10A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-10h-16ZM4.5 5.5a1 1 0 0 0-1 1V6h17v-.5a1 1 0 0 0-1-1h-15Z"/></svg>';
    const COMBO_ICON_D = 'M8.36612 16.1161C7.87796 16.6043 7.87796 17.3957 8.36612 17.8839L23.1161 32.6339C23.6043 33.122 24.3957 33.122 24.8839 32.6339L39.6339 17.8839C40.122 17.3957 40.122 16.6043 39.6339 16.1161C39.1457 15.628 38.3543 15.628 37.8661 16.1161L24 29.9822L10.1339 16.1161C9.64573 15.628 8.85427 15.628 8.36612 16.1161Z';
    const MIN_OPTS = [1, 2, 3, 5, 10, 15, 30, 60].map((m) => ({ val: String(m), label: m + ' dk' }));
    const VIS_OPTS = [{ val: 'all', label: 'Her şey' }, { val: 'watch_only', label: 'İzlenen' }];

    const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
    let CFG = null;
    const curVis = () => CFG && CFG.rpcVisibility === 'watch_only' ? 'watch_only' : 'all';
    const curMins = () => String(Number(CFG ? CFG.pauseDropMinutes : 5) || 5);
    const rpcOn = () => lsGet(STORE) !== 'false';

    function toggleRow(C, key, label, checked) {
      const row = el('div', C.item);
      row.dataset.key = key;
      const lab = el('span', C.tbBody);
      const labId = 'oa-tgl-' + rid();
      lab.id = labId;
      lab.textContent = label;
      const ctl = el('div', C.control);
      const st = el('span', C.tbBody);
      st.setAttribute('data-status', '');
      st.textContent = checked ? 'Etkin' : 'Devre Dışı';
      const wrap = el('label', C.toggleWrap);
      const inp = document.createElement('input');
      inp.className = C.toggle;
      inp.type = 'checkbox';
      inp.checked = checked;
      inp.setAttribute('aria-labelledby', labId);
      wrap.appendChild(inp);
      ctl.appendChild(st);
      ctl.appendChild(wrap);
      row.appendChild(lab);
      row.appendChild(ctl);
      return row;
    }
    function comboRow(C, kind, label, btnLabel) {
      const row = el('div', C.item);
      const lab = el('span', C.tbBody);
      const labId = 'oa-cbo-' + rid();
      lab.id = labId;
      lab.textContent = label;
      const ctl = el('div', C.control);
      const combo = el('div', C.combo);
      combo.dataset.kind = kind;
      const bid = 'fds-combo-box-button-' + rid();
      const did = 'fds-combo-box-dropdown-' + rid();
      const lid = 'fds-combo-box-label-' + rid();
      const btn = document.createElement('button');
      btn.className = C.comboBtn;
      btn.tabIndex = 0;
      btn.type = 'button';
      btn.id = bid;
      btn.setAttribute('aria-labelledby', labId + ' ' + lid);
      btn.setAttribute('aria-controls', did);
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      const bl = el('span', C.comboLabel);
      bl.id = lid;
      bl.setAttribute('data-label', '');
      bl.textContent = btnLabel;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('class', C.comboIcon);
      svg.setAttribute('width', '48');
      svg.setAttribute('height', '48');
      svg.setAttribute('viewBox', '0 0 48 48');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('d', COMBO_ICON_D);
      svg.appendChild(path);
      btn.appendChild(bl);
      btn.appendChild(document.createTextNode(' '));
      btn.appendChild(svg);
      combo.appendChild(btn);
      combo.appendChild(document.createTextNode(' '));
      ctl.appendChild(combo);
      row.appendChild(lab);
      row.appendChild(ctl);
      return row;
    }
    function rpcRows(C) {
      const vis = curVis();
      const mins = curMins();
      return [
        toggleRow(C, 'rpc', 'Discord RPC Durumu', rpcOn()),
        comboRow(C, 'vis', 'RPC Görünürlüğü', vis === 'watch_only' ? 'İzlenen' : 'Her şey'),
        comboRow(C, 'mins', 'Zaman Aşımı', mins + ' dk')
      ];
    }
    function windowRows(C) {
      return [
        toggleRow(C, 'useCustomFrame', 'Özel Pencere Çerçevesi', CFG && CFG.useCustomFrame === true),
        toggleRow(C, 'persistFullscreen', 'Tam Ekranı Koru', CFG && CFG.persistFullscreen === true),
        toggleRow(C, 'isMaximized', 'Açılışta Pencereyi Büyüt', CFG && CFG.isMaximized === true)
      ];
    }

    let closeOpenMenu = null;
    function openComboMenu(C, btn, options, selVal, onPick) {
      const wrapper = btn.closest('[class*="combo-box"]:not([class*="dropdown"])') || btn.parentElement;
      const bid = btn.id;
      const did = btn.getAttribute('aria-controls') || ('fds-combo-dropdown-' + rid());
      btn.setAttribute('aria-controls', did);
      const menuOf = () => document.getElementById(did);
      const close = (restore) => {
        const old = menuOf();
        const ae = document.activeElement;
        const owned = !!(old && ae && old.contains(ae));
        if (old) old.remove();
        if (wrapper) wrapper.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', onDoc, true);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('focusin', onFocusIn, true);
        if (closeOpenMenu === close) closeOpenMenu = null;
        if (restore !== false && (owned || !ae || ae === document.body)) {
          try { btn.focus({ preventScroll: true }); } catch (e) {}
        }
      };
      const orphan = () => { if (!btn.isConnected) { close(false); return true; } return false; };
      const onDoc = (ev) => {
        if (orphan()) return;
        if (ev.target.closest && (ev.target === btn || btn.contains(ev.target))) return;
        const m = menuOf();
        if (m && (ev.target === m || m.contains(ev.target))) return;
        close();
      };
      const onFocusIn = (ev) => {
        if (orphan()) return;
        if (ev.target === btn || (ev.target.closest && btn.contains(ev.target))) return;
        const m = menuOf();
        if (m && (ev.target === m || m.contains(ev.target))) return;
        close(false);
      };
      let onKey = (ev) => { if (orphan()) return; if (ev.key === 'Escape') close(); };
      if (closeOpenMenu) closeOpenMenu(false);
      const ul = document.createElement('ul');
      ul.id = did;
      ul.setAttribute('role', 'listbox');
      ul.setAttribute('aria-labelledby', btn.getAttribute('aria-labelledby') || bid);
      const mid = Math.floor(options.length / 2);
      const selIdx = options.findIndex((opt) => opt.val === selVal);
      const dir = selIdx < 0 || selIdx === mid ? 'center' : selIdx < mid ? 'top' : 'bottom';
      ul.className = /\bdirection-\S+/.test(C.comboMenu) ? C.comboMenu.replace(/\bdirection-\S+/, 'direction-' + dir) : C.comboMenu + ' direction-' + dir;
      let z = -(selIdx >= 0 ? selIdx : mid) * 36;
      const w = (btn.offsetWidth || 0) + 8;
      ul.style.setProperty('--fds-menu-offset', z + 'px');
      ul.style.setProperty('position', 'absolute', 'important');
      ul.style.setProperty('display', 'block', 'important');
      ul.style.setProperty('overflow-y', 'auto', 'important');
      ul.style.setProperty('max-height', '256px', 'important');
      ul.style.setProperty('z-index', '100', 'important');
      ul.style.setProperty('margin', '-6px 0px 0px -5px', 'important');
      ul.style.setProperty('padding', '1px', 'important');
      ul.style.setProperty('border-radius', '8px', 'important');
      ul.style.setProperty('width', w + 'px', 'important');
      ul.style.setProperty('min-width', w + 'px', 'important');
      options.forEach((opt, idx) => {
        const li = document.createElement('li');
        li.tabIndex = opt.val === selVal ? 0 : -1;
        li.setAttribute('role', 'option');
        li.id = did + '-item-' + idx;
        li.className = C.comboItem + (opt.val === selVal ? ' selected' : '');
        li.setAttribute('aria-selected', opt.val === selVal ? 'true' : 'false');
        const sp = el('span', C.comboItemInner);
        sp.textContent = opt.label + ' ';
        li.appendChild(sp);
        li.addEventListener('click', (e) => { e.stopPropagation(); onPick(opt); close(); });
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(opt); close(); }
        });
        ul.appendChild(li);
      });
      const items = Array.from(ul.children);
      if (!items.some((x) => x.tabIndex >= 0) && items[0]) items[0].tabIndex = 0;
      const setRove = (i) => {
        items.forEach((x, j) => { x.tabIndex = j === i ? 0 : -1; });
        if (items[i]) items[i].focus({ preventScroll: true });
      };
      onKey = (ev) => {
        if (ev.key === 'Escape') { close(); return; }
        const cur = items.indexOf(document.activeElement);
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          const nx = ev.key === 'ArrowDown' ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
          setRove(cur < 0 ? (ev.key === 'ArrowDown' ? 0 : items.length - 1) : nx);
        } else if (ev.key === 'Home') { ev.preventDefault(); setRove(0); }
        else if (ev.key === 'End') { ev.preventDefault(); setRove(items.length - 1); }
      };
      if (wrapper) wrapper.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      if (wrapper) wrapper.appendChild(ul);
      else document.body.appendChild(ul);
      const anchor = wrapper || btn;
      const sel = items.find((li) => li.classList.contains('selected')) || items[0];
      const anchorTop = anchor.getBoundingClientRect().top;
      const selTop = sel.getBoundingClientRect().top;
      const vh = window.innerHeight;
      z += anchorTop - selTop;
      ul.style.setProperty('--fds-menu-offset', z + 'px');
      const mr = ul.getBoundingClientRect();
      let mTop = mr.top;
      let mBottom = mr.bottom;
      if (mBottom > vh - 8) { const d = mBottom - (vh - 8); z -= d; mTop -= d; mBottom -= d; }
      if (mTop < 8) z += 8 - mTop;
      ul.style.setProperty('--fds-menu-offset', z + 'px');
      if (sel) sel.focus({ preventScroll: true });
      document.addEventListener('click', onDoc, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('focusin', onFocusIn, true);
      closeOpenMenu = close;
    }

    function wireRows(C, box) {
      Array.from(box.querySelectorAll('[data-key]')).forEach((row) => {
        const key = row.dataset.key;
        const input = row.querySelector('input[type="checkbox"]');
        const status = row.querySelector('[data-status]');
        if (!input) return;
        const setStatus = () => { if (status) status.textContent = input.checked ? 'Etkin' : 'Devre Dışı'; };
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('change', () => {
          if (key === 'rpc') {
            lsSet(STORE, input.checked ? 'true' : 'false');
            setStatus();
            bridge.setRpcEnabled(input.checked);
          } else {
            setStatus();
            bridge.setConfig(key, input.checked);
            if (key === 'useCustomFrame' && input.checked && status) status.textContent = 'Yeniden başlatılıyor…';
          }
        });
      });
      Array.from(box.querySelectorAll('[data-kind]')).forEach((combo) => {
        const kind = combo.dataset.kind;
        const btn = combo.querySelector('button');
        const labelEl = combo.querySelector('[data-label]');
        if (!btn) return;
        const open = () => {
          if (kind === 'vis') openComboMenu(C, btn, VIS_OPTS, curVis(), (opt) => {
            if (labelEl) labelEl.textContent = opt.label;
            if (CFG) CFG.rpcVisibility = opt.val;
            bridge.setConfig('rpcVisibility', opt.val);
          });
          else openComboMenu(C, btn, MIN_OPTS, curMins(), (opt) => {
            if (labelEl) labelEl.textContent = opt.label;
            const mins = parseInt(opt.val, 10);
            if (CFG) CFG.pauseDropMinutes = mins;
            bridge.setConfig('pauseDropMinutes', mins);
          });
        };
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.getAttribute('aria-expanded') === 'true') {
            if (closeOpenMenu) closeOpenMenu();
            return;
          }
          open();
        });
        btn.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          if (btn.getAttribute('aria-expanded') !== 'true') open();
        });
      });
    }

    const blk = (nodes) => ({
      c() {}, l() {},
      m(t, a) { for (const n of nodes) t.insertBefore(n, a || null); },
      p() {}, i() {}, o() {},
      d(det) { if (det) for (const n of nodes) n.remove(); }
    });
    function titleNode(C, refCard, title, caption) {
      const src = refCard.querySelector('.expander-header-title > *') || refCard.querySelector('.expander-header-title');
      const node = src.cloneNode(true);
      const spans = node.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = title;
      if (spans[1]) spans[1].textContent = caption;
      return node;
    }
    function iconNode(svgHTML) {
      const w = document.createElement('div');
      w.innerHTML = svgHTML;
      return w.firstChild;
    }

    let modPromise = null;
    const usable = async (u) => {
      try {
        const m = await import(u);
        if (!m || typeof m.E !== 'function') return null;
        const probe = document.createElement('div');
        const inst = new m.E({ target: probe, props: { expanded: false, $$slots: {}, $$scope: { ctx: [] } } });
        try {
          if (inst && typeof inst.$destroy === 'function') inst.$destroy();
          else if (typeof m.unmount === 'function') m.unmount(inst);
        } catch (e) {}
        probe.remove();
        return m;
      } catch (e) { return null; }
    };
    async function loadExpander() {
      const cached = lsGet(CHUNK_KEY);
      if (cached) { const m = await usable(cached); if (m) return m; }
      const urls = [...new Set(performance.getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.includes('/__openanime/immutable/openanime-') && u.endsWith('.js'))
        .map((u) => new URL(u).pathname))];
      const texts = await Promise.all(urls.map((u) => fetch(u).then((r) => r.text()).catch(() => '')));
      for (let i = 0; i < urls.length; i++) {
        if (!texts[i].includes('expander-content-anchor')) continue;
        const m = await usable(urls[i]);
        if (m) { lsSet(CHUNK_KEY, urls[i]); return m; }
      }
      return null;
    }

    function mountReal(E, C, refCard, anchorNode, spec) {
      const title = titleNode(C, refCard, spec.title, spec.caption);
      const icon = iconNode(spec.icon);
      const box = el('div');
      spec.rows.forEach((r) => box.appendChild(r));
      wireRows(C, box);
      const rows = Array.from(box.childNodes);
      const comp = new E({
        target: refCard.parentNode,
        anchor: anchorNode || null,
        props: {
          expanded: false,
          $$slots: { default: [() => blk([title])], icon: [() => blk([icon])], content: [() => blk(rows)] },
          $$scope: { ctx: [] }
        }
      });
      let root = anchorNode ? anchorNode.previousSibling : refCard.parentNode.lastChild;
      if (!root || !root.classList || !root.classList.contains('expander')) {
        const all = refCard.parentNode.querySelectorAll(':scope > .expander');
        root = all[all.length - 1];
      }
      root.id = spec.id;
      root.__oaComp = comp;
      return root;
    }

    const baseCls = (c) => c.split(' ')[0];
    const findBy = (root, base) => { try { return root.querySelector('.' + CSS.escape(base)); } catch (e) { return null; } };
    function legacyContentHTML(C, rows) {
      return '<div class="' + C.contentAnchor + '"><div class="' + C.content + '"><div class="' + C.contentInner + '">' +
        rows.map((r) => r.outerHTML).join('') + '</div></div></div>';
    }
    function mountLegacy(C, refCard, anchorNode, spec) {
      const root = refCard.cloneNode(true);
      root.id = spec.id;
      const oldHeader = findBy(root, baseCls(FALLBACK.itemHeader)) || root.querySelector('.expander-header-title');
      const header = root.querySelector('.expander-header');
      const chevron = root.querySelector('.expander-chevron');
      const oldAnchor = root.querySelector('.expander-content-anchor');
      const hid = 'fds-expander-header-' + rid();
      const cid = 'fds-expander-content-' + rid();
      if (oldHeader) {
        const spans = oldHeader.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = spec.title;
        if (spans[1]) spans[1].textContent = spec.caption;
      }
      if (header) {
        header.id = hid;
        header.setAttribute('aria-controls', cid);
        header.setAttribute('aria-expanded', 'false');
        header.tabIndex = 0;
        const icon = header.querySelector('.expander-icon');
        if (icon) icon.innerHTML = spec.icon;
      }
      if (chevron) { chevron.id = cid; chevron.setAttribute('aria-label', spec.title); }
      if (oldAnchor) oldAnchor.remove();
      const frag = document.createElement('template');
      frag.innerHTML = legacyContentHTML(C, spec.rows);
      const anchor = frag.content.firstChild;
      anchor.style.display = 'none';
      root.appendChild(anchor);
      if (anchorNode) anchorNode.before(root);
      else refCard.parentNode.appendChild(root);
      const toggleExpand = () => {
        const expanded = root.classList.contains('expanded');
        if (expanded) {
          root.classList.remove('expanded');
          if (header) header.setAttribute('aria-expanded', 'false');
          anchor.style.setProperty('height', anchor.scrollHeight + 'px', 'important');
          anchor.offsetHeight;
          anchor.style.setProperty('height', '0px', 'important');
          setTimeout(() => { if (!root.classList.contains('expanded')) anchor.style.display = 'none'; }, 260);
        } else {
          anchor.style.display = 'block';
          anchor.style.setProperty('height', '0px', 'important');
          anchor.style.setProperty('overflow', 'hidden', 'important');
          anchor.offsetHeight;
          root.classList.add('expanded');
          if (header) header.setAttribute('aria-expanded', 'true');
          anchor.style.setProperty('height', anchor.scrollHeight + 'px', 'important');
          setTimeout(() => {
            if (root.classList.contains('expanded')) {
              anchor.style.setProperty('height', 'auto', 'important');
              anchor.style.setProperty('overflow', 'visible', 'important');
            }
          }, 280);
        }
      };
      const onHeaderKey = (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        toggleExpand();
      };
      if (header) {
        header.addEventListener('click', (e) => { e.stopPropagation(); toggleExpand(); });
        header.addEventListener('keydown', onHeaderKey);
      }
      if (chevron) {
        chevron.addEventListener('click', (e) => { e.stopPropagation(); toggleExpand(); });
        if (!chevron.hasAttribute('tabindex')) chevron.setAttribute('tabindex', '0');
        chevron.addEventListener('keydown', onHeaderKey);
      }
      wireRows(C, root);
      return root;
    }

    let observer = null;
    let injecting = false;
    let lastPath = '';
    let tick = null;
    let modFailedAt = 0;
    function stopObserver() {
      if (closeOpenMenu) closeOpenMenu(false);
      if (tick) { clearTimeout(tick); tick = null; }
      if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
    }
    function onUrl() {
      const p = location.pathname;
      if (p === lastPath) return;
      lastPath = p;
      if (closeOpenMenu) closeOpenMenu(false);
      if (p.includes('/settings')) { armObserver(); inject(); }
      else stopObserver();
    }
    function armObserver() {
      if (observer) return;
      observer = new MutationObserver(() => {
        if (location.pathname !== lastPath) { onUrl(); return; }
        if (!location.pathname.includes('/settings')) return;
        if (document.getElementById(RPC_ID) && document.getElementById(WIN_ID)) return;
        if (tick) return;
        tick = setTimeout(() => { tick = null; inject(); }, 400);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    function findRef() {
      const targets = ['Kişiselleştirilmiş öneriler', 'NSFW uyarılarını sıfırla'];
      const exact = new Array(targets.length).fill(null);
      const loose = new Array(targets.length).fill(null);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const v = node.nodeValue.trim();
        const card = v && node.parentElement ? node.parentElement.closest('.expander') : null;
        if (card) {
          for (let i = 0; i < targets.length; i++) {
            if (v === targets[i]) {
              if (!exact[i]) exact[i] = card;
            } else if (!loose[i] && v.indexOf(targets[i]) !== -1) {
              loose[i] = card;
            }
          }
        }
        node = walker.nextNode();
      }
      for (let i = 0; i < targets.length; i++) {
        if (exact[i]) return exact[i];
      }
      for (let i = 0; i < targets.length; i++) {
        if (loose[i]) return loose[i];
      }
      return null;
    }
    async function inject() {
      if (injecting) return;
      if (closeOpenMenu) closeOpenMenu(false);
      if (document.getElementById(RPC_ID) && document.getElementById(WIN_ID)) return;
      const refCard = findRef();
      if (!refCard) return;
      injecting = true;
      try {
        CFG = bridge.getConfigAll();
        if (!modPromise) {
          if (Date.now() - modFailedAt < 3000) return;
          modPromise = loadExpander().catch(() => null);
        }
        const mod = await modPromise;
        if (!mod) { modFailedAt = Date.now(); modPromise = null; } else modFailedAt = 0;
        if (location.pathname.indexOf('/settings') === -1 || !refCard.isConnected || !refCard.parentNode) return;
        const C = hashes(refCard);
        if (lsGet(STORE) === null) lsSet(STORE, CFG.discordRPC !== false ? 'true' : 'false');
        const specs = [
          { id: RPC_ID, title: 'Discord RPC', caption: 'Durumunuzu (izlediğiniz anime, bölüm vb.) Discord profilinizde gösterir.', icon: DISCORD_ICON, rows: rpcRows(C) },
          { id: WIN_ID, title: 'Pencere', caption: 'Uygulama penceresinin çerçeve, tam ekran ve boyut davranışını ayarlayın.', icon: WINDOW_ICON, rows: windowRows(C) }
        ];
        let anchor = refCard;
        for (const spec of specs) {
          const existing = document.getElementById(spec.id);
          if (existing) { anchor = existing; continue; }
          let root = null;
          if (mod && mod.E) {
            try { root = mountReal(mod.E, C, refCard, anchor.nextSibling, spec); } catch (e) { root = null; }
          }
          if (!root) {
            try { root = mountLegacy(C, refCard, anchor.nextSibling, spec); } catch (e) { root = null; }
          }
          if (!root) break;
          anchor = root;
        }
      } finally {
        injecting = false;
      }
    }

    function start() {
      lastPath = location.pathname;
      const _push = history.pushState;
      history.pushState = function () { const r = _push.apply(this, arguments); onUrl(); return r; };
      const _rep = history.replaceState;
      history.replaceState = function () { const r = _rep.apply(this, arguments); onUrl(); return r; };
      addEventListener('popstate', () => { onUrl(); });
      addEventListener('hashchange', () => { onUrl(); });
      armObserver();
      if (location.pathname.includes('/settings')) inject();
      else stopObserver();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  })();
})();
