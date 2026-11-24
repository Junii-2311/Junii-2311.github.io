/* =========================================================
   Junaid Zaheer — portfolio script
   1. helpers   2. nav   3. giant word   4. agent swarm
   5. project filter   6. demos
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 1. helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CANCEL = Symbol('cancel');

  // A cancellable run: starting a new one makes the old one's sleeps reject.
  function runner() {
    let token = 0;
    return () => {
      const mine = ++token;
      const alive = () => mine === token;
      const sleep = (ms) => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(CANCEL)), ms));
      return { alive, sleep };
    };
  }
  const swallow = (e) => { if (e !== CANCEL) throw e; };

  const yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();
  window.addEventListener('load', () => root.classList.add('smooth'));

  /* ---------- 2. nav ---------- */
  const nav = $('#nav');
  const menuBtn = $('#menuBtn');
  const panel = $('#menuPanel');
  const setMenu = (open) => {
    panel.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
  };
  menuBtn.addEventListener('click', () => setMenu(panel.hidden));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setMenu(false); menuBtn.focus(); } });
  document.addEventListener('click', (e) => { if (!panel.hidden && !nav.contains(e.target)) setMenu(false); });
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 3. giant outlined word: fills the content width ---------- */
  const giant = $('.giant');
  function fitGiant() {
    const box = giant.parentElement;
    giant.style.fontSize = '200px';
    const w = giant.scrollWidth;
    if (w) giant.style.fontSize = `${(200 * box.clientWidth) / w}px`;
  }
  fitGiant();
  addEventListener('resize', fitGiant);
  if (document.fonts) document.fonts.ready.then(fitGiant);

  /* ---------- 4. agent swarm ----------
     The page loads as a grey draft. A crew of named agents builds it layer by layer
     as each part scrolls into view: frame it, type its text, fill its colour. */
  const CREW = [
    ['planner', '#ff6b6b'], ['tokenizer', '#3ec5ff'], ['embedder', '#ffb020'], ['retriever', '#3ddc84'],
    ['reranker', '#c084fc'], ['scheduler', '#a78bfa'], ['critic', '#ff9f43'], ['guard', '#2ee6a6'],
    ['indexer', '#f472b6'], ['summarizer', '#a3e635'], ['executor', '#fb7185'], ['router', '#60a5fa'],
    ['vision', '#e879f9'], ['tracker', '#38bdf8'],
  ];
  const arrowSvg = (c) => `<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 1.5v12l3.4-3 2.4 4.6 2-1-2.3-4.5h4.6z" fill="${c}" stroke="#0a0a0b" stroke-width="1"/></svg>`;
  const ibeamSvg = (c) => `<svg class="ibeam" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5h6M5 14.5h6M8 1.5v13" fill="none" stroke="${c}" stroke-width="2"/></svg>`;

  const swarm = (() => {
    const layers = $$('[data-layer]');
    const total = layers.length;
    let endTimer = 0, layerEl, hud, agents = [], built = 0, edits = 0, gen = 0, raf = 0, tick = 0, io = null, themed = false, active = false;
    const visible = new Set();
    const building = new Set();
    const seenAt = new Map();

    const isBuilt = (el) => el.classList.contains('is-built');
    const docRect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
    const shown = (el) => el.getClientRects().length > 0;
    const ready = (el) => { const p = el.parentElement && el.parentElement.closest('[data-layer]'); return !p || isBuilt(p); };

    function mount() {
      layerEl = document.createElement('div');
      layerEl.id = 'swarm';
      layerEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layerEl);
      const n = innerWidth < 700 ? 7 : CREW.length;
      agents = CREW.slice(0, n).map(([name, color]) => {
        const el = document.createElement('div');
        el.className = 'agent';
        el.innerHTML = `${arrowSvg(color)}${ibeamSvg(color)}<span class="tagname" style="background:${color}">${name}</span>`;
        layerEl.appendChild(el);
        const x = scrollX + rand(40, innerWidth - 120), y = scrollY + rand(80, innerHeight - 80);
        return { name, color, el, tag: el.querySelector('.tagname'), x, y, tx: x, ty: y, busy: false, wander: 0 };
      });
      hud = document.createElement('div');
      hud.className = 'hud';
      hud.setAttribute('role', 'status');
      hud.innerHTML = `<span class="dots">${agents.map((a) => `<i style="background:${a.color}"></i>`).join('')}</span>
        <span><b>${agents.length}</b> agents</span><span class="hl"><b id="hudBuilt">0</b>/${total} layers</span>
        <span><b id="hudEdits">0</b> edits</span><span class="prog"><i></i></span><button type="button">Skip build</button>`;
      hud.querySelector('button').addEventListener('click', skip);
      document.body.appendChild(hud);
    }

    function updateHud() {
      if (!hud) return;
      const b = $('#hudBuilt', hud), e = $('#hudEdits', hud);
      if (b) b.textContent = Math.min(built, total);
      if (e) e.textContent = edits;
      $('.prog i', hud).style.width = `${(built / total) * 100}%`;
    }

    const setTask = (a, t) => { a.tag.textContent = t ? `${a.name} · ${t}` : a.name; };
    const go = (a, x, y) => { a.tx = x; a.ty = y; };
    function moveTo(a, x, y, sleep) {
      go(a, x, y);
      return new Promise((res, rej) => {
        const t0 = performance.now();
        const check = () => {
          if (gen !== a.gen) return rej(CANCEL);
          if (Math.abs(a.x - a.tx) + Math.abs(a.y - a.ty) < 4 || performance.now() - t0 > 900) return res();
          requestAnimationFrame(check);
        };
        check();
      });
    }

    function frameLoop(now) {
      for (const a of agents) {
        // an agent far off-screen re-enters from the nearest edge instead of crawling across the page
        const top = scrollY - 40, bottom = scrollY + innerHeight + 40;
        if (!a.busy) { if (a.y < top - 200) a.y = top; else if (a.y > bottom + 200) a.y = bottom; }
        if (!a.busy) {
          const offscreen = a.ty < scrollY || a.ty > scrollY + innerHeight;
          if (now > a.wander || offscreen) {
            go(a, scrollX + rand(30, innerWidth - 110), scrollY + rand(70, innerHeight - 60));
            a.wander = now + rand(1400, 3200);
          }
        }
        const k = a.busy ? 0.22 : 0.05;
        a.x += (a.tx - a.x) * k;
        a.y += (a.ty - a.y) * k;
        a.el.style.transform = `translate(${a.x}px, ${a.y}px)`;
      }
      raf = requestAnimationFrame(frameLoop);
    }

    // overlays
    function overlay(cls, html = '') {
      const o = document.createElement('div');
      o.className = cls;
      o.innerHTML = html;
      layerEl.appendChild(o);
      return o;
    }
    const place = (o, x, y, w, h) => { o.style.left = `${x}px`; o.style.top = `${y}px`; if (w != null) { o.style.width = `${w}px`; o.style.height = `${h}px`; } };
    const fadeOut = (o) => { o.style.opacity = '0'; setTimeout(() => o.remove(), 400); };

    // the selection box grows from the cursor with a live W × H badge
    async function frameBox(a, el, sleep, hatch) {
      const r = docRect(el);
      const box = overlay(`sel${hatch ? ' hatch' : ''}`, '<i></i><b></b>');
      const badge = box.querySelector('b');
      const t0 = performance.now(), dur = 420;
      await new Promise((res, rej) => {
        const step = (now) => {
          if (gen !== a.gen) { box.remove(); return rej(CANCEL); }
          const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          const w = Math.max(2, r.w * e), h = Math.max(2, r.h * e);
          place(box, r.x, r.y, w, h);
          badge.textContent = `${Math.round(w)} × ${Math.round(h)}`;
          go(a, r.x + w, r.y + h);
          k < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      });
      return box;
    }

    // visible text nodes that belong to this layer (not to a nested layer)
    function textNodes(el) {
      const out = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.data.trim() && n.parentElement.closest('[data-layer]') === el ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      while (w.nextNode()) out.push(w.currentNode);
      return out;
    }
    function blank(el) {
      el._orig = textNodes(el).map((n) => [n, n.data]);
      el.style.minHeight = `${el.offsetHeight}px`;
      el._orig.forEach(([n]) => { n.data = ''; });
    }
    function restore(el) {
      if (el._orig) { el._orig.forEach(([n, t]) => { n.data = t; }); delete el._orig; }
      el.style.minHeight = '';
    }
    const KEYS = 'qwertyuiopasdfghjklzxcvbnm';
    const slip = (ch) => { const i = KEYS.indexOf(ch.toLowerCase()); return i < 0 ? 'x' : KEYS[(i + (Math.random() < 0.5 ? 1 : KEYS.length - 1)) % KEYS.length]; };

    async function typeText(a, el, sleep) {
      const segs = el._orig || [];
      const total = segs.reduce((s, [, t]) => s + t.length, 0);
      const range = document.createRange();
      const show = (k, extra = '') => {
        let rem = k, cur = segs.length ? segs[0][0] : null, placed = false;
        for (const [n, t] of segs) {
          if (placed) { n.data = ''; continue; }
          if (rem >= t.length) { n.data = t; rem -= t.length; cur = n; if (rem === 0 && !extra) placed = true; continue; }
          n.data = t.slice(0, rem) + extra; cur = n; placed = true; rem = 0;
        }
        if (cur && cur.parentElement) {
          range.setStart(cur, cur.data.length); range.collapse(true);
          let r = range.getBoundingClientRect();
          if (!r.height) r = cur.parentElement.getBoundingClientRect();
          go(a, r.right + scrollX + 1, r.top + scrollY);
        }
      };
      a.el.classList.add('typing');
      const hand = Math.min(total, 24);
      for (let k = 1; k <= hand; k++) {
        const ch = flatChar(segs, k - 1);
        if (/[a-z]/i.test(ch) && Math.random() < 0.06) {
          show(k - 1, slip(ch)); await sleep(rand(90, 150)); show(k - 1); await sleep(70);
        }
        show(k); await sleep(rand(16, 40));
      }
      // the long tail is pasted in a few chunks
      let k = hand;
      while (k < total) { k = Math.min(total, k + Math.ceil((total - hand) / 3)); show(k); await sleep(80); }
      a.el.classList.remove('typing');
    }
    function flatChar(segs, i) {
      for (const [, t] of segs) { if (i < t.length) return t[i]; i -= t.length; }
      return '';
    }

    function hexOf(el) {
      const target = el.matches('.name') ? el.firstElementChild : el;
      const m = getComputedStyle(target).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m || (m.length === 4 && +m[3] === 0)) return '#FF2D2D';
      return `#${m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    }

    function finishLayer(el) {
      restore(el);
      if (isBuilt(el)) return;
      el.classList.remove('is-building');
      el.classList.add('is-built');
      built++; edits++;
      updateHud();
      if (!themed) themeSwitch();
      if (built >= total) done();
    }

    async function build(a, el) {
      a.busy = true; a.gen = gen;
      building.add(el);
      const { sleep } = { sleep: (ms) => new Promise((res, rej) => setTimeout(() => (gen === a.gen ? res() : rej(CANCEL)), ms)) };
      const kind = el.dataset.layer || 'style';
      let box;
      // safety net: whatever happens to this agent, the layer is shown within 6 s
      const guard = setTimeout(() => { if (!isBuilt(el)) finishLayer(el); }, 6000);
      try {
        const r = docRect(el);
        setTask(a, { type: 'type', fill: 'fill colour', image: 'place image' }[kind] || 'apply styles');
        await moveTo(a, r.x, r.y, sleep);
        if (kind === 'image') {
          box = await frameBox(a, el, sleep, true);
          const label = overlay('imglabel', '▣ portrait.webp');
          place(label, r.x + r.w / 2 - 50, r.y + r.h / 2 - 8);
          await sleep(650);
          label.remove();
          el.classList.add('is-building');
          await sleep(200);
        } else {
          el.classList.add('is-building');
          if (kind === 'type') blank(el);
          box = await frameBox(a, el, sleep, false);
          if (kind === 'type') await typeText(a, el, sleep);
          else if (kind === 'fill') {
            const hex = hexOf(el);
            const chip = overlay('chipbadge', `<i style="background:${hex}"></i>${hex}`);
            place(chip, a.x + 14, a.y - 26);
            edits++;
            await sleep(420);
            chip.remove();
          } else await sleep(260);
        }
        finishLayer(el);
      } catch (e) {
        swallow(e);
      } finally {
        clearTimeout(guard);
        if (box) fadeOut(box);
        a.el.classList.remove('typing');
        setTask(a, null);
        a.busy = false;
        building.delete(el);
      }
    }

    // One agent switches the page from the grey draft canvas to the dark theme.
    async function themeSwitch() {
      themed = true;
      const a = agents.find((x) => !x.busy) || agents[0];
      const wasBusy = a.busy;
      a.busy = true; a.gen = gen;
      try {
        setTask(a, 'theme');
        const r = docRect(nav);
        await moveTo(a, r.x + r.w / 2, r.y + r.h + 18);
        const chip = overlay('chipbadge', '<i style="background:#0A0A0B"></i>theme: dark · --bg #0A0A0B');
        place(chip, a.x + 16, a.y + 4);
        await new Promise((res) => setTimeout(res, 550));
        root.classList.remove('draft');
        edits++; updateHud();
        setTimeout(() => chip.remove(), 700);
      } catch (e) { swallow(e); root.classList.remove('draft'); }
      finally { if (!wasBusy) { setTask(a, null); a.busy = false; } }
    }

    function buildNow(el) {
      if (isBuilt(el)) return;
      el.classList.add('is-built');
      finishLayerInstant(el);
    }
    function finishLayerInstant(el) {
      restore(el);
      el.classList.remove('is-building');
      el.classList.add('is-built');
      built++;
      updateHud();
      if (built >= total) done();
    }

    // One dispatch per tick, top-most waiting layer first, to the nearest free agent.
    function dispatch() {
      const now = performance.now();
      const waiting = [...visible].filter((el) => !isBuilt(el) && !building.has(el) && ready(el) && shown(el));
      if (!waiting.length) return;
      // never leave content hidden for long if every agent is busy
      for (const el of waiting) {
        if (!seenAt.has(el)) seenAt.set(el, now);
        else if (now - seenAt.get(el) > 3200) { buildNow(el); return; }
      }
      waiting.sort((p, q) => p.getBoundingClientRect().top - q.getBoundingClientRect().top || p.getBoundingClientRect().left - q.getBoundingClientRect().left);
      const el = waiting[0];
      const r = docRect(el);
      const free = agents.filter((a) => !a.busy);
      if (!free.length) return;
      free.sort((p, q) => ((p.x - r.x) ** 2 + (p.y - r.y) ** 2) - ((q.x - r.x) ** 2 + (q.y - r.y) ** 2));
      const a = free[0];
      if (a.y < scrollY - 240) a.y = scrollY - 40; else if (a.y > scrollY + innerHeight + 240) a.y = scrollY + innerHeight + 40;
      build(a, el);
    }

    // A fast jump (anchor link, scrollbar drag) can skip layers without them ever
    // intersecting. Anything left above the viewport is built at once.
    function sweep() {
      if (!active) return;
      for (const el of layers) {
        if (!isBuilt(el) && !building.has(el) && shown(el) && el.getBoundingClientRect().bottom < 0) buildNow(el);
      }
    }

    function start() {
      clearTimeout(endTimer);
      active = true; built = 0; edits = 0; themed = false; gen++;
      visible.clear(); seenAt.clear();
      root.classList.add('swarm-on', 'draft');
      if (!layerEl) mount(); else { layerEl.style.display = ''; hud.classList.remove('gone'); agents.forEach((a) => { a.el.style.opacity = '1'; }); }
      $('.hl', hud).innerHTML = `<b id="hudBuilt">0</b>/${total} layers`;
      updateHud();
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      }, { rootMargin: '0px 0px -6% 0px' });
      layers.forEach((el) => io.observe(el));
      tick = setInterval(dispatch, 110);
      raf = requestAnimationFrame(frameLoop);
    }

    function done() {
      if (!active) return;
      active = false;
      clearInterval(tick);
      io && io.disconnect();
      root.classList.remove('draft');
      $('.hl', hud).innerHTML = `✓ <b id="hudBuilt">${total}</b>/${total} layers built`;
      updateHud();
      clearTimeout(endTimer);
      endTimer = setTimeout(() => {
        hud.classList.add('gone');
        agents.forEach((a) => { a.el.style.opacity = '0'; });
        setTimeout(() => {
          cancelAnimationFrame(raf);
          layerEl.style.display = 'none';
          $$('.sel, .chipbadge, .imglabel', layerEl).forEach((o) => o.remove());
          root.classList.remove('swarm-on');
        }, 600);
      }, 1400);
    }

    function skip() {
      gen++;
      $$('.sel, .chipbadge, .imglabel', layerEl).forEach((o) => o.remove());
      layers.forEach((el) => { if (!isBuilt(el)) { building.delete(el); finishLayerInstant(el); } });
      root.classList.remove('draft');
    }

    function replay() {
      if (reduced) return;
      gen++;
      clearInterval(tick); cancelAnimationFrame(raf); io && io.disconnect();
      building.clear();
      layers.forEach((el) => { restore(el); el.classList.remove('is-built', 'is-building'); });
      root.classList.remove('smooth');
      scrollTo(0, 0);
      root.classList.add('smooth');
      agents.forEach((a) => { a.busy = false; setTask(a, null); });
      start();
    }

    // keyboard users tabbing into an unbuilt layer see it at once
    document.addEventListener('focusin', (e) => {
      if (!active) return;
      const el = e.target.closest && e.target.closest('[data-layer]');
      if (el && !isBuilt(el) && !building.has(el)) buildNow(el);
    });
    addEventListener('scroll', () => requestAnimationFrame(sweep), { passive: true });

    return { start, replay, isActive: () => active };
  })();

  if (root.classList.contains('swarm-on')) {
    const begin = () => swarm.start();
    // measure text with the real fonts; don't wait forever for them
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(begin);
  }
  $('#replay').addEventListener('click', () => (reduced ? scrollTo(0, 0) : swarm.replay()));

  /* ---------- 5. project matrix filter ---------- */
  const filterBtns = $$('.filters button');
  filterBtns.forEach((b) => b.addEventListener('click', () => {
    filterBtns.forEach((x) => x.classList.toggle('is-on', x === b));
    const f = b.dataset.filter;
    $$('.proj').forEach((p) => p.classList.toggle('is-hidden', f !== 'all' && p.dataset.cat !== f));
  }));

  /* ---------- 6. demos ----------
     Every demo is a simulation with sample data. Each plays by itself once it is on
     screen (and built), unless the visitor has already pressed an example. */
  function shell(el, title, examples, steps) {
    el.innerHTML = `<div class="demo-bar"><i></i><i></i><i></i><b>${esc(title)}</b><em>Simulation</em></div>
      <div class="demo-body">
        <div class="examples">${examples.map((x, i) => `<button type="button" data-i="${i}">${esc(x)}</button>`).join('')}</div>
        <div class="steps">${steps.map((s, i) => `<div class="step"><b>${i + 1}</b><span>${esc(s)}</span></div>`).join('')}</div>
        <div class="stage"></div>
        <div class="result idle" aria-live="polite"></div>
      </div>`;
    const ui = { root: el, stage: $('.stage', el), result: $('.result', el), steps: $$('.step', el), buttons: $$('.examples button', el) };
    ui.setStep = (k) => ui.steps.forEach((s, i) => {
      s.classList.toggle('done', i < k); s.classList.toggle('on', i === k);
      s.querySelector('b').textContent = i < k ? '✓' : i + 1;
    });
    ui.working = (t) => { ui.result.className = 'result'; ui.result.innerHTML = `<span class="work"><i class="spin"></i>${esc(t)}</span>`; };
    return ui;
  }
  function mountDemo(el, title, examples, steps, play) {
    const ui = shell(el, title, examples, steps);
    const next = runner();
    let touched = false, played = false;
    const run = (i, byUser) => {
      if (byUser) touched = true;
      played = true;
      ui.buttons.forEach((b, j) => b.classList.toggle('is-on', j === i));
      const ctl = next();
      play(ui, i, ctl).catch(swallow);
    };
    ui.buttons.forEach((b, i) => b.addEventListener('click', () => run(i, true)));
    if (reduced) { run(0, false); return; }
    // autoplay once it is on screen and its card is built
    const card = el.closest('[data-layer]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || touched || played) return;
        const tryRun = () => {
          if (touched || played) return;
          if (card && root.classList.contains('swarm-on') && !card.classList.contains('is-built')) return setTimeout(tryRun, 400);
          run(0, false);
          io.disconnect();
        };
        tryRun();
      });
    }, { threshold: 0.12 });
    io.observe(el);
  }

  async function typeWords(el, html, sleep, ms = 45) {
    const parts = html.split(/(\s+)/);
    let out = '';
    for (const p of parts) { out += p; el.innerHTML = `${out}<i class="caret-b"></i>`; if (p.trim()) await sleep(ms); }
    el.innerHTML = out;
  }

  /* --- SYS_01: RAG --- */
  const FILES = [
    ['pdf', 'Refund SOP'], ['doc', 'Fare rules'], ['xls', 'Bus partners'], ['pdf', 'Hotel policy'],
    ['doc', 'Payments FAQ'], ['ppt', 'Agent training'], ['pdf', 'Cancellations'], ['doc', 'Support macros'],
    ['xls', 'Event T&Cs'], ['pdf', 'Baggage rules'], ['doc', 'Visa guide'], ['ppt', 'Onboarding'],
  ];
  const RAG = [
    { q: 'How are cancelled flights refunded?', hits: [[0, 0.92], [1, 0.84], [4, 0.77]],
      a: 'Refunds for a cancelled flight go back to the original payment method once the airline confirms the cancellation; timing follows that fare\'s rules.',
      cites: ['Refund SOP', 'Fare rules', 'Payments FAQ'] },
    { q: 'Steps to change a bus booking?', hits: [[2, 0.9], [7, 0.83], [6, 0.71]],
      a: 'Check the operator\'s change rules, rebook through the partner, then send the customer the new e-ticket using the change macro.',
      cites: ['Bus partners', 'Support macros', 'Cancellations'] },
    { q: 'What is the CEO\'s salary?', hits: [],
      a: 'That isn\'t in the documents I can search, so I won\'t guess.', cites: [] },
  ];
  const ragEl = $('[data-demo="rag"]');
  if (ragEl) mountDemo(ragEl, 'Ask Bookie · sample docs', RAG.map((x) => x.q === RAG[2].q ? 'Not in the docs' : x.q), ['Embeds the question', 'Searches the docs', 'Answers with sources'], async (ui, i, { sleep }) => {
    const ex = RAG[i];
    ui.stage.innerHTML = `<div class="ask"><span>${esc(ex.q)}</span></div><div class="files">${FILES.map(([t, n]) => `<div class="file"><em class="${t}">${t.toUpperCase()}</em><div>${esc(n)}</div></div>`).join('')}</div>`;
    const tiles = $$('.file', ui.stage);
    ui.setStep(0); ui.working('Embedding the question with BGE-M3…');
    await sleep(800);
    ui.setStep(1); ui.working('Searching every document…');
    for (const t of tiles) { t.classList.add('scan'); await sleep(55); t.classList.remove('scan'); }
    const hitIdx = new Map(ex.hits);
    tiles.forEach((t, j) => {
      if (hitIdx.has(j)) { t.classList.add('hit'); t.insertAdjacentHTML('beforeend', `<span class="score">${hitIdx.get(j).toFixed(2)}</span>`); }
      else t.classList.add('dim');
    });
    await sleep(700);
    ui.setStep(2);
    ui.result.className = 'result';
    ui.result.innerHTML = '<div class="ans"></div>';
    const ans = $('.ans', ui.result);
    await typeWords(ans, esc(ex.a), sleep, 40);
    ans.insertAdjacentHTML('beforeend', ex.cites.map((_, k) => ` <span class="cite">[${k + 1}]</span>`).join(''));
    if (ex.cites.length) ui.result.insertAdjacentHTML('beforeend', `<div class="src">${ex.cites.map((c, k) => `<span>[${k + 1}] ${esc(c)}</span>`).join('')}</div>`);
    ui.setStep(3);
  });

  /* --- SYS_02: fare direction --- */
  const FARE = [
    { route: 'LHE → KHI · 21 days out', feats: [['Days to departure', '21', 30], ['Seats sold', '58%', 58], ['Day of week', 'Fri', 80], ['7-day fare trend', '+3.1%', 62], ['Holiday window', 'No', 10]],
      series: [100, 101, 99, 102, 103, 102, 105, 106, 108, 109], probs: { up: 0.71, flat: 0.2, down: 0.09 } },
    { route: 'ISB → DXB · 3 days out', feats: [['Days to departure', '3', 95], ['Seats sold', '91%', 91], ['Day of week', 'Sun', 70], ['7-day fare trend', '+6.4%', 85], ['Holiday window', 'Yes', 90]],
      series: [100, 102, 104, 103, 107, 110, 112, 115, 118, 121], probs: { up: 0.84, flat: 0.12, down: 0.04 } },
    { route: 'KHI → ISB · 45 days out', feats: [['Days to departure', '45', 12], ['Seats sold', '22%', 22], ['Day of week', 'Tue', 25], ['7-day fare trend', '−2.8%', 30], ['Holiday window', 'No', 10]],
      series: [108, 107, 108, 105, 104, 104, 102, 101, 100, 99], probs: { up: 0.1, flat: 0.24, down: 0.66 } },
  ];
  function sparkPath(vals, W = 300, H = 100, P = 8) {
    const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
    const pts = vals.map((v, i) => [P + (i * (W - 2 * P)) / (vals.length - 1), P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${P},${H} Z` };
  }
  const fareEl = $('[data-demo="fare"]');
  if (fareEl) mountDemo(fareEl, 'Fare direction · sample data', FARE.map((x) => x.route), ['Builds features', 'Runs the model', 'Predicts direction'], async (ui, i, { sleep }) => {
    const ex = FARE[i];
    const p = sparkPath(ex.series);
    ui.stage.innerHTML = `<div class="fare-grid">
      <div>${ex.feats.map(([n, v]) => `<div class="feat"><span>${esc(n)}</span><span class="bar"><i></i></span><b>${esc(v)}</b></div>`).join('')}</div>
      <div><svg class="spark" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2d2d" stop-opacity=".25"/><stop offset="1" stop-color="#ff2d2d" stop-opacity="0"/></linearGradient></defs>
        <path class="area" d="${p.area}"/><path class="line" d="${p.line}"/><text x="8" y="108">last 10 days · fare index</text></svg>
        <div class="verdict-box"></div></div></div>`;
    ui.setStep(0); ui.working('Building features for this flight…');
    const bars = $$('.feat .bar i', ui.stage);
    for (let k = 0; k < bars.length; k++) { bars[k].style.width = `${ex.feats[k][2]}%`; await sleep(190); }
    ui.setStep(1); ui.working('Scoring with the classifier…');
    $('.spark', ui.stage).classList.add('drawn');
    await sleep(1100);
    ui.setStep(2);
    const top = Object.entries(ex.probs).sort((a, b) => b[1] - a[1])[0][0];
    const label = { up: '↑ Likely to rise', flat: '→ Likely flat', down: '↓ Likely to drop' }[top];
    $('.verdict-box', ui.stage).innerHTML = `<p class="verdict ${top}">${label}</p><div class="probs">${['up', 'flat', 'down'].map((k) => `<div class="prob${k === top ? ' top' : ''}"><span>${k}</span><span class="bar"><i></i></span><span>${Math.round(ex.probs[k] * 100)}%</span></div>`).join('')}</div>`;
    await sleep(30);
    $$('.prob .bar i', ui.stage).forEach((b, k) => { b.style.width = `${ex.probs[['up', 'flat', 'down'][k]] * 100}%`; });
    ui.result.className = 'result';
    ui.result.innerHTML = '<span class="ans">Sample numbers. The model predicts the direction of the fare, not the price itself.</span>';
    ui.setStep(3);
  });

  /* --- SYS_03: LLM serving --- */
  const SERVE = [
    { label: 'Gemma · summarise a ticket', model: 'gemma', prompt: 'Summarise this support ticket in one line.',
      out: 'Customer wants to move a Lahore–Karachi bus booking to Friday and asks for the fare difference.', ttft: 180, tps: 74, batch: 1 },
    { label: 'Qwen · extract JSON', model: 'qwen', prompt: 'Extract the booking fields as JSON.',
      out: '{ "from": "LHE", "to": "KHI", "date": "2026-12-05", "passengers": 2 }', ttft: 210, tps: 68, batch: 1 },
    { label: 'Burst · 8 requests', model: 'gemma', prompt: '8 apps call the same endpoint at once.',
      out: 'All 8 requests were batched together on the GPU and streamed back in parallel.', ttft: 340, tps: 410, batch: 8 },
  ];
  const serveEl = $('[data-demo="serve"]');
  if (serveEl) mountDemo(serveEl, 'POST /v1/chat/completions · sample', SERVE.map((x) => x.label), ['Receives the request', 'Batches on the GPU', 'Streams tokens'], async (ui, i, { sleep }) => {
    const ex = SERVE[i];
    ui.stage.innerHTML = `<div class="serve-grid">
      <div>
        <div class="pipe"><span class="node">client</span><span class="wire"></span><span class="node">vLLM</span></div>
        <div class="queue"></div>
        <div class="meter">GPU utilisation <span class="gpu">4%</span><div class="bar"><i></i></div></div>
        <div class="metrics"><div><b class="m-ttft">—</b><span>first token</span></div><div><b class="m-tps">—</b><span>tokens / s</span></div><div><b class="m-batch">—</b><span>batch</span></div></div>
      </div>
      <div><div class="req"></div><div class="stream"></div></div></div>`;
    const wire = $('.wire', ui.stage), vnode = $$('.node', ui.stage)[1], q = $('.queue', ui.stage);
    const gpuBar = $('.meter .bar i', ui.stage), gpuTxt = $('.gpu', ui.stage);
    ui.setStep(0); ui.working('Request received…');
    $('.req', ui.stage).innerHTML = `{ <span class="k">"model"</span>: <span class="s">"${ex.model}"</span>,\n  <span class="k">"messages"</span>: [{ <span class="k">"role"</span>: <span class="s">"user"</span>,\n    <span class="k">"content"</span>: <span class="s">"${esc(ex.prompt)}"</span> }],\n  <span class="k">"stream"</span>: true }`;
    wire.classList.add('flow');
    await sleep(700);
    ui.setStep(1); ui.working('Batching on the GPU…');
    vnode.classList.add('hot');
    for (let k = 1; k <= ex.batch; k++) { q.insertAdjacentHTML('beforeend', `<span>R${k}</span>`); await sleep(90); }
    $$('span', q).forEach((s) => s.classList.add('run'));
    const util = ex.batch > 1 ? 94 : 62;
    gpuBar.style.width = `${util}%`; gpuTxt.textContent = `${util}%`;
    $('.m-batch', ui.stage).textContent = ex.batch;
    await sleep(500);
    $('.m-ttft', ui.stage).textContent = `${ex.ttft}ms`;
    ui.setStep(2); ui.working('Streaming tokens…');
    const out = $('.stream', ui.stage);
    const words = ex.out.split(' ');
    let text = '';
    for (let k = 0; k < words.length; k++) {
      text += (k ? ' ' : '') + words[k];
      out.innerHTML = `${esc(text)}<i class="caret-b"></i>`;
      $('.m-tps', ui.stage).textContent = Math.round(ex.tps * (0.85 + Math.random() * 0.2));
      if (ex.batch > 1 && k % 2 === 1) { const s = $('span.run', q); if (s) { s.classList.remove('run'); s.classList.add('ok'); } }
      await sleep(70);
    }
    $$('span.run', q).forEach((s) => { s.classList.remove('run'); s.classList.add('ok'); });
    $('.m-tps', ui.stage).textContent = ex.tps;
    out.innerHTML = esc(text);
    wire.classList.remove('flow'); vnode.classList.remove('hot');
    gpuBar.style.width = '6%'; gpuTxt.textContent = '6%';
    ui.result.className = 'result';
    ui.result.innerHTML = `<span class="ans">Done: ${ex.batch} request${ex.batch > 1 ? 's' : ''} · ${ex.ttft}ms to first token · sample figures.</span>`;
    ui.setStep(3);
  });

  /* --- SYS_04: scrum automation --- */
  const PEOPLE = { a: ['Ayesha', 'who-a'], b: ['Bilal', 'who-b'], c: ['Hamza', 'who-c'] };
  const SCRUM = [
    { label: 'Daily stand-up · 3 people',
      lines: [['a', 'Finished the fare-alert API, tests are green.'], ['b', 'Still on the hotel images bug, I need access to the CDN logs.'], ['c', 'Starting the refund report today.'], ['a', 'Next I\'ll wire the alerts into the app.']],
      upd: { a: ['Fare-alert API', 'Wire alerts into the app', 'None'], b: ['—', 'Hotel images bug', 'Needs CDN log access'], c: ['—', 'Refund report', 'None'] } },
    { label: 'Sprint review · 2 people',
      lines: [['a', 'Demoed the search filters, product signed off.'], ['b', 'Payment retries shipped, but we saw two timeouts in staging.'], ['b', 'I\'ll add alerts before the release.']],
      upd: { a: ['Search filters signed off', 'Pick the next ticket', 'None'], b: ['Payment retries', 'Add alerts before release', 'Two staging timeouts'] } },
  ];
  const scrumEl = $('[data-demo="scrum"]');
  if (scrumEl) mountDemo(scrumEl, 'stand-up.wav · sample meeting', SCRUM.map((x) => x.label), ['Transcribes audio', 'Splits speakers', 'Writes updates'], async (ui, i, { sleep, alive }) => {
    const ex = SCRUM[i];
    ui.stage.innerHTML = `<div class="wave">${'<i></i>'.repeat(48)}</div><div class="lines"></div><div class="updates"></div>`;
    const wave = $('.wave', ui.stage), bars = $$('i', wave), lines = $('.lines', ui.stage);
    ui.setStep(0); ui.working('Transcribing the recording…');
    wave.classList.add('live');
    const wobble = setInterval(() => { if (!alive()) return clearInterval(wobble); bars.forEach((b) => { b.style.height = `${rand(12, 100)}%`; }); }, 140);
    try {
      for (const [, t] of ex.lines) { lines.insertAdjacentHTML('beforeend', `<p><b style="background:#555">??</b>${esc(t)}</p>`); await sleep(420); }
    } finally { clearInterval(wobble); }
    wave.classList.remove('live'); bars.forEach((b) => { b.style.height = '10%'; });
    ui.setStep(1); ui.working('Working out who said what…');
    const ps = $$('p b', lines);
    for (let k = 0; k < ps.length; k++) {
      const [name, cls] = PEOPLE[ex.lines[k][0]];
      ps[k].textContent = name; ps[k].removeAttribute('style'); ps[k].className = cls;
      await sleep(260);
    }
    ui.setStep(2); ui.working('Writing each person\'s update…');
    const box = $('.updates', ui.stage);
    for (const [who, [doneTxt, nextTxt, block]] of Object.entries(ex.upd)) {
      const [name, cls] = PEOPLE[who];
      box.insertAdjacentHTML('beforeend', `<div class="upd"><h4><i class="${cls}"></i>${name}</h4><p><span>Done</span>${esc(doneTxt)}</p><p><span>Next</span>${esc(nextTxt)}</p><p><span>Blockers</span>${esc(block)}</p></div>`);
      await sleep(380);
    }
    ui.result.className = 'result';
    ui.result.innerHTML = '<span class="ans">Summary and per-person updates ready. Sample meeting, made-up names.</span>';
    ui.setStep(3);
  });
})();
